(function() {
  'use strict';

  // Find the script tag and get API Key
  var scripts = document.getElementsByTagName('script');
  var currentScript = document.currentScript || scripts[scripts.length - 1];
  var apiKey = currentScript ? currentScript.getAttribute('data-api-key') : null;
  var apiUrl = currentScript ? currentScript.getAttribute('data-api-url') || 'https://nodalx.in/api/inquiries' : 'https://nodalx.in/api/inquiries';

  if (!apiKey) {
    console.warn('[NodalX Widget] Missing data-api-key attribute on script tag.');
  }

  function initWidget() {
    // Find form by id="nodalx-form" or data-nodalx-form attribute
    var form = document.getElementById('nodalx-form') || document.querySelector('[data-nodalx-form]') || document.querySelector('form');
    if (!form) return;

    // Prevent attaching twice
    if (form.getAttribute('data-nodalx-attached')) return;
    form.setAttribute('data-nodalx-attached', 'true');
    var isSubmitting = false;

    form.addEventListener('submit', async function(e) {
      e.preventDefault();
      if (isSubmitting) return;
      isSubmitting = true;

      var submitBtn = form.querySelector('[type="submit"]') || form.querySelector('button');
      var originalBtnText = submitBtn ? submitBtn.innerText : '';
      var originalBtnDisabled = submitBtn ? submitBtn.disabled : false;
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerText = 'Submitting...';
      }

      try {
        // Collect form inputs dynamically
        var formData = new FormData(form);
        var payload = {};

        // Map form fields smartly
        formData.forEach(function(value, key) {
          var k = key.toLowerCase();
          if (k.includes('name')) payload.name = value;
          else if (k.includes('email')) payload.email = value;
          else if (k.includes('company') || k.includes('org')) payload.company = value;
          else if (k.includes('message') || k.includes('inquiry') || k.includes('comment') || k.includes('note')) payload.message = value;
          else payload[key] = value;
        });

        // Fallbacks
        if (!payload.name) payload.name = form.querySelector('[name*="name"], [id*="name"]')?.value || 'Website Visitor';
        if (!payload.email) payload.email = form.querySelector('[name*="email"], [id*="email"]')?.value || '';
        if (!payload.company) payload.company = form.querySelector('[name*="company"], [id*="company"]')?.value || '';
        if (!payload.message) payload.message = form.querySelector('textarea')?.value || form.querySelector('[name*="message"]')?.value || 'Inquiry submitted via website form';

        var headers = {
          'Content-Type': 'application/json'
        };
        if (apiKey) {
          headers['X-API-Key'] = apiKey;
        }

        var res = await fetch(apiUrl, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify(payload)
        });
        if (!res.ok) {
          throw new Error('Server responded with status: ' + res.status);
        }
        var data = await res.json();
        if (data && data.success === false) {
          throw new Error(data.error || data.message || 'Submission failed');
        }

        // Show Toast / Banner
        showToast('Inquiry submitted successfully! We will get back to you soon.', 'success');
        form.reset();
      } catch (err) {
        console.error('[NodalX Widget Error]', err);
        showToast('Submission failed. Your entries have been kept. Please try again.', 'error');
      } finally {
        isSubmitting = false;
        if (submitBtn) {
          submitBtn.disabled = originalBtnDisabled;
          submitBtn.innerText = originalBtnText;
        }
      }
    });
  }

  function showToast(message, type) {
    var toast = document.createElement('div');
    toast.setAttribute('role', type === 'success' ? 'status' : 'alert');
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.right = '20px';
    toast.style.padding = '12px 20px';
    toast.style.borderRadius = '12px';
    toast.style.backgroundColor = type === 'success' ? '#0f766e' : '#b91c1c';
    toast.style.color = '#ffffff';
    toast.style.fontSize = '14px';
    toast.style.fontWeight = '600';
    toast.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.3)';
    toast.style.zIndex = '999999';
    toast.style.fontFamily = 'system-ui, -apple-system, sans-serif';
    toast.style.transition = 'all 0.3s ease';
    toast.innerText = message;

    document.body.appendChild(toast);

    setTimeout(function() {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(function() {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    }, 4000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWidget);
  } else {
    initWidget();
  }
})();
