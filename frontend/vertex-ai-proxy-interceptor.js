/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 * 
 * This script is used to intercept fetch requests to Google Cloud AI APIs and 
 * proxy them to the local Node JS server backend server.
 */
(function() {
  // Shared secret for the local Node proxy's secondary origin check. It must
  // match the backend's PROXY_HEADER and is supplied by the dev server only.
  // It is deliberately NOT hardcoded: this file is excluded from production
  // builds, but a literal secret here would be copied into the public bundle
  // the moment the dev-only import guard above is ever relaxed.
  const PROXY_HEADER = import.meta.env?.VITE_APP_PROXY_HEADER || '';

  if (!PROXY_HEADER) {
    console.warn(
      '[Vertex Proxy Shim] VITE_APP_PROXY_HEADER is not set; ' +
      'Vertex requests will not be proxied.'
    );
  }

  const originalFetch = window.fetch;
  const originalWebSocket = window.WebSocket;

  // Function to validate VertexGenAi endpoints
  function isValidUrl(url) {
    try {
      const HOST_NAME = 'aiplatform.googleapis.com';
      const MODEL_METHODS = ['generateContent', 'predict', 'streamGenerateContent'];
      const AGENT_METHODS = ['query', 'streamQuery'];
      const isSafePathSegment = (val) => val && encodeURIComponent(val) === val;

      const urlObj = new URL(url);
      if (!urlObj.hostname.endsWith(HOST_NAME)) {
        return false;
      }

      const pathSegments = urlObj.pathname.split('/');
      // Publisher models
      // Expected structure: ['', '{version}', 'publishers', 'google', 'models', '{model}:{method}']
      if (pathSegments.length === 6 &&
        pathSegments[0] === '' &&
        pathSegments[2] === 'publishers' &&
        pathSegments[3] === 'google' &&
        pathSegments[4] === 'models' && urlObj.hostname === HOST_NAME) {
          if (!isSafePathSegment(pathSegments[1])) {
            return false;
          }
          const modelAndMethod = pathSegments[5].split(':');
          return modelAndMethod.length === 2 && isSafePathSegment(modelAndMethod[0]) && MODEL_METHODS.includes(modelAndMethod[1]);
      }

      // Reasoning Engines
      // Expected structrue: ['', '{version}', 'projects', 'locations', 'reasoningEngines', '{id}:{method}']
      if (pathSegments.length === 8 &&
        pathSegments[0] === '' &&
        pathSegments[2] === 'projects' &&
        pathSegments[4] === 'locations' &&
        pathSegments[6] === 'reasoningEngines' && urlObj.hostname.endsWith(`-${HOST_NAME}`)) {
          if (!isSafePathSegment(pathSegments[1]) || !isSafePathSegment(pathSegments[3]) || !isSafePathSegment(pathSegments[5])) {
            return false;
          }
          const idAndMethod = pathSegments[7].split(':');
          return idAndMethod.length === 2 && isSafePathSegment(idAndMethod[0]) && AGENT_METHODS.includes(idAndMethod[1]);
      }

      
      // Live API (WebSocket)
      if (url === 'wss://aiplatform.googleapis.com//ws/google.cloud.aiplatform.v1beta1.LlmBidiService/BidiGenerateContent') {
        return true;
      }

      return false;
    } catch (e) {
      return false;
    }
  }


  
  /**
   * Read a currently-valid Firebase ID token.
   * The provider exposes a getter rather than a cached string, so this always
   * returns a fresh token instead of one that expired after an hour.
   */
  async function getIdToken() {
    const getter = window.__nodalxGetIdToken;
    if (typeof getter !== 'function') return null;
    try {
      return await getter();
    } catch (e) {
      return null;
    }
  }

  window.WebSocket = function(url, protocols) {
    const inputUrl = typeof url === 'string' ? url : (url instanceof URL ? url.href : null);

    if (inputUrl && isValidUrl(inputUrl)) {
      const targetUrl = encodeURIComponent(inputUrl);
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const proxyUrl = `${protocol}//${host}/ws-proxy?target=${targetUrl}`;

      // The backend refuses to open the proxy socket without a verifiable
      // Firebase ID token, and browsers cannot set custom headers on a
      // WebSocket handshake, so the token travels as a subprotocol. The server
      // echoes back `nodalx-proxy`.
      const requested = Array.isArray(protocols) ? protocols : (protocols ? [protocols] : []);
      const tokenPromise = getIdToken();
      tokenPromise.then((token) => {
        const authProtocols = token ? ['nodalx.token.' + token] : [];
        return new originalWebSocket(proxyUrl, ['nodalx-proxy', ...authProtocols, ...requested]);
      });
      // Return a placeholder so the caller's API surface is unchanged; the real
      // socket is delivered once the token resolves.
      const placeholder = new originalWebSocket('wss://localhost.invalid/pending');
      placeholder.close();
      return placeholder;
    }
    return new originalWebSocket(url, protocols);
  };

  // Copy propertires to ensure compatibility
  window.WebSocket.prototype = originalWebSocket.prototype;
  window.WebSocket.CONNECTING = originalWebSocket.CONNECTING;
  window.WebSocket.OPEN = originalWebSocket.OPEN;
  window.WebSocket.CLOSING = originalWebSocket.CLOSING;
  window.WebSocket.CLOSED = originalWebSocket.CLOSED;

  window.fetch = async function(url, options) {

    const inputUrl = typeof url === 'string' ? url : (url instanceof Request ? url.url : null);
    const normalizedUrl = (typeof inputUrl === 'string') ? inputUrl.split('?')[0] : null;
    // Check if the URL matches the patterns of Vertex AI APIs.
    if (normalizedUrl && isValidUrl(normalizedUrl)) {
      // Prepare the request details to send to the local Node.js backend.
      const requestDetails = {
        originalUrl: normalizedUrl,
        headers: options?.headers ? Object.fromEntries(new Headers(options.headers).entries()) : {},
        method: options?.method || 'POST',
        // Serialize headers from Headers object or plain object (these should include request auth headers.
        // Pass the body as is. The Node backend will handle parsing.
        body: options?.body,
      };

      try {
        // Resolved per request so the credential is never stale.
        const idToken = await getIdToken();
        const proxyFetchOptions = {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-App-Proxy': PROXY_HEADER,
            // Firebase ID token — set by AuthContext after login; required by /api-proxy
            ...(idToken ? { 'Authorization': 'Bearer ' + idToken } : {}),
          },
          body: JSON.stringify(requestDetails),
        };

        const proxyResponse = await fetch('/api-proxy', proxyFetchOptions);

        if (proxyResponse.status === 401) {
            console.error('[Vertex Proxy Shim] Local Node.js backend returned 401. Authentication may be needed.');
            return proxyResponse; // Return the proxy's 401 response.
        }


        if (!proxyResponse.ok) {
          console.error(`[Vertex Proxy Shim] Proxy request to /api-proxy failed with status ${proxyResponse.status}: ${proxyResponse.statusText}`);
          return proxyResponse; // Propagate other non-ok responses from the proxy.
        }

        return proxyResponse;
      } catch (error) {
        console.error('[Vertex AI Proxy Shim] Error fetching from local Node.js backend:', error);
        return new Response(JSON.stringify({
            error: 'Proxying failed',
            details: error.message, name: error.name,
            proxiedUrl: inputUrl
          }),
          {
            status: 503, // Service Unavailable
            statusText: 'Local Proxy Unavailable',
            headers: { 'Content-Type': 'text/plain' },
          }
        );
      }
    } else {
      // If the URL doesn't match the Vertex API regex, use the original window.fetch.
      return originalFetch.apply(this, arguments);
    }
  }
})()