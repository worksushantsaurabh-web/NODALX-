/**
 * ═══════════════════════════════════════════════════════════════
 * NodalX — Inquiry Intake (Apps Script, single file)
 * ═══════════════════════════════════════════════════════════════
 *
 * Replaces the previous Code.gs / InquiryPipeline.gs pair. Everything lives in
 * this one file, so there is nothing else to paste and nothing to keep in sync.
 *
 * SECURITY
 * A web app deployed as "Anyone" has no authentication of its own. The web app
 * URL is therefore a bearer credential for your customer data, and a previous
 * deployment URL was published in a public git repository.
 *
 * Every request is gated on a shared secret read from Script Properties. This
 * check FAILS CLOSED: if INTAKE_SECRET is not set, all requests are rejected.
 *
 * Script Properties required (Project Settings → Script Properties):
 *   INTAKE_SECRET   random string, e.g. output of `openssl rand -hex 32`
 *   SHEET_ID        the 44-char ID from your Sheet URL between /d/ and /edit
 *
 * The Sheet ID is deliberately NOT hardcoded here, so this file can be
 * committed to a public repository without leaking it.
 *
 * Deploy: Deploy → New Deployment → Web App → Execute as Me, Who has access
 * Anyone. Configure the URL and secret only on the server-side contact proxy.
 * ═══════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════
// PROPERTIES
// ═══════════════════════════════════════════════════════════════

/**
 * Read a Script Property by name.
 * @param {string} name Property name.
 * @return {string} The value, or an empty string when unset.
 */
function prop(name) {
  return PropertiesService.getScriptProperties().getProperty(name) || '';
}

/**
 * Shared secret for inbound requests.
 * @return {string} The configured secret, or '' when unset.
 */
function getIntakeSecret() {
  return prop('INTAKE_SECRET');
}

/**
 * ID of the target spreadsheet.
 * @return {string} The Sheet ID from Script Properties.
 */
function getSheetId() {
  return prop('SHEET_ID');
}

/**
 * Owner notification address from Script Properties (OWNER_EMAIL). Returns ''
 * when unset or malformed so notifications are skipped, never intake.
 * @return {string}
 */
function getOwnerEmail_() {
  const value = prop('OWNER_EMAIL').trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? value : '';
}

const CONFIG = {
  SHEET_NAME: 'NodalX_Inquiries',
  SEND_OWNER_EMAIL: true,
  SEND_USER_CONFIRMATION: true,
};

/** Sheet columns, in order. Changing this breaks existing rows. */
const HEADERS = [
  'Timestamp', 'Name', 'Email', 'Phone', 'Company', 'Industry',
  'Message', 'Source', 'Intent', 'Urgency', 'Fit Score',
  'Summary', 'Suggested Action', 'Category', 'Status', 'Row ID',
  'Service', 'Payload Hash',
];

// ═══════════════════════════════════════════════════════════════
// AUTHORIZATION
// ═══════════════════════════════════════════════════════════════

/**
 * Verify the shared secret on an inbound request.
 *
 * Uses a constant-time comparison so a wrong secret cannot be recovered by
 * timing responses. Apps Script web-app events provide the `secret` query
 * parameter; do not rely on arbitrary request headers being available.
 *
 * @param {GoogleAppsScript.Events.DoGet|GoogleAppsScript.Events.DoPost} e Event.
 * @return {boolean} True only when a matching secret was supplied.
 */
function isAuthorized(e) {
  const expected = getIntakeSecret();
  // Fail closed. An unconfigured deployment must never accept traffic.
  if (!expected) return false;

  const fromHeader = e && e.headers && e.headers['x-nodalx-secret'];
  const fromParam = e && e.parameter && e.parameter.secret;
  const provided = String(fromHeader || fromParam || '');

  if (provided.length !== expected.length) return false;

  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  }
  return mismatch === 0;
}

// ═══════════════════════════════════════════════════════════════
// CLASSIFICATION RULES (no external API, no cost)
// ═══════════════════════════════════════════════════════════════

const KEYWORD_MAP = {
  intent: {
    purchase: ['buy', 'purchase', 'quote', 'pricing', 'price', 'cost', 'budget', 'pay', 'order', 'invest', 'spend', 'proposal', 'roi', 'deal', 'acquire', 'get'],
    partnership: ['partner', 'partnership', 'collaborate', 'collaboration', 'joint venture', 'reseller', 'distributor', 'affiliate', 'integration partner', 'strategic'],
    support: ['support', 'help', 'issue', 'problem', 'bug', 'fix', 'troubleshoot', 'error', 'not working', 'broken', 'assist', 'guidance'],
    spam: ['viagra', 'crypto', 'bitcoin', 'lottery', 'winner', 'prize', 'free money', 'click here', 'act now', 'limited time', '100% free', 'guaranteed'],
  },
  urgency: {
    high: ['asap', 'urgent', 'immediately', 'emergency', 'critical', 'deadline', 'today', 'tomorrow', 'this week', 'rush', 'quick', 'fast', 'as soon as possible', 'right away'],
    medium: ['soon', 'next week', 'upcoming', 'planned', 'scheduled', 'quarter', 'monthly'],
    low: ['exploring', 'research', 'information', 'curious', 'interested', 'considering', 'future', 'later', 'sometime', 'when ready'],
  },
  category: {
    enterprise: ['enterprise', 'fortune', '500', 'corporation', 'multinational', 'global', 'subsidiary', 'subsidiaries', 'department', 'teams', 'divisions', '1000+', 'large scale'],
    smb: ['small business', 'startup', 'sme', 'mid-size', 'growing', 'scale', 'local', 'regional', 'boutique', 'agency', 'consulting firm'],
    individual: ['freelancer', 'solo', 'individual', 'personal', 'myself', 'i need', 'i want', 'sole proprietor', 'one person'],
  },
};

const ACTION_TEMPLATES = {
  'purchase,enterprise': 'Schedule executive demo within 24 hours. Prepare enterprise pricing deck.',
  'purchase,smb': 'Send product demo link + SMB pricing. Follow up in 48 hours.',
  'purchase,individual': 'Send self-serve onboarding link. Offer starter plan.',
  'purchase,unknown': 'Qualify budget & timeline. Send pricing overview.',

  'partnership,enterprise': 'Route to partnerships team. Schedule strategy call with VP.',
  'partnership,smb': 'Send partner program overview. Schedule intro call.',
  'partnership,individual': 'Send affiliate/reseller info. Low priority.',
  'partnership,unknown': 'Request company details & partnership goals.',

  'support,enterprise': 'Priority support ticket. Escalate to account manager.',
  'support,smb': 'Create support ticket. Offer screen share if needed.',
  'support,individual': 'Self-serve help docs first. Ticket if unresolved.',
  'support,unknown': 'Gather more info. Create ticket with medium priority.',

  'general,enterprise': 'Qualify use case. Offer discovery call with sales.',
  'general,smb': 'Send case studies + offer free trial.',
  'general,individual': 'Send blog/resources. Nurture via email.',
  'general,unknown': 'Send welcome email with product overview.',

  'spam,enterprise': 'Mark as spam. No action.',
  'spam,smb': 'Mark as spam. No action.',
  'spam,individual': 'Mark as spam. No action.',
  'spam,unknown': 'Mark as spam. No action.',
};

/**
 * Score the text against a keyword group and return the winning key.
 * @param {string} text Lowercased haystack.
 * @param {Object} groups Map of key → keyword array.
 * @param {string} fallback Key used when nothing matches.
 * @return {{key: string, score: number}} Best match and its score.
 */
function bestMatch(text, groups, fallback) {
  let key = fallback;
  let score = 0;
  for (const [name, keywords] of Object.entries(groups)) {
    const hits = keywords.reduce(
        (sum, kw) => sum + (text.includes(kw.toLowerCase()) ? 1 : 0), 0,
    );
    if (hits > score) {
      key = name;
      score = hits;
    }
  }
  return {key, score};
}

/**
 * Build a one-line summary of the lead.
 * @param {Object} data Submitted payload.
 * @param {string} intent Detected intent.
 * @param {string} category Detected category.
 * @return {string} Human-readable summary.
 */
function generateSummary(data, intent, category) {
  const company = data.company || 'Unknown company';
  const industry = data.industry || 'unspecified industry';
  const summaries = {
    purchase: `${company} (${industry}) is evaluating a purchase.`,
    partnership: `${company} (${industry}) is interested in a partnership.`,
    support: `${company} (${industry}) needs technical support.`,
    spam: 'Flagged as potential spam.',
    general: `${company} (${industry}) sent a general inquiry.`,
  };
  return summaries[intent] || summaries.general;
}

/**
 * Classify a lead using the embedded keyword rules.
 * @param {Object} data Submitted payload.
 * @return {{intent: string, urgency: string, fit_score: number, summary: string,
 *           suggested_action: string, category: string}} Classification.
 */
function classifyInquiry(data) {
  const text = (
    (data.name || '') + ' ' +
    (data.company || '') + ' ' +
    (data.industry || '') + ' ' +
    (data.message || '')
  ).toLowerCase();

  const intent = bestMatch(text, KEYWORD_MAP.intent, 'general').key;
  const urgency = bestMatch(text, KEYWORD_MAP.urgency, 'medium').key;
  const category = bestMatch(text, KEYWORD_MAP.category, 'unknown').key;

  let fitScore = 5;
  if (intent === 'purchase') fitScore += 3;
  else if (intent === 'partnership') fitScore += 2;
  else if (intent === 'support') fitScore += 1;
  else if (intent === 'spam') fitScore = 1;

  if (category === 'enterprise') fitScore += 3;
  else if (category === 'smb') fitScore += 2;
  else if (category === 'individual') fitScore += 1;

  if (urgency === 'high') fitScore += 2;
  else if (urgency === 'medium') fitScore += 1;

  fitScore = Math.min(10, Math.max(1, fitScore));

  return {
    intent: intent,
    urgency: urgency,
    fit_score: fitScore,
    summary: generateSummary(data, intent, category),
    suggested_action: ACTION_TEMPLATES[`${intent},${category}`] ||
        ACTION_TEMPLATES[`${intent},unknown`],
    category: category,
  };
}

// ═══════════════════════════════════════════════════════════════
// SHEET ACCESS
// ═══════════════════════════════════════════════════════════════

/**
 * Open the target spreadsheet and ensure the header row exists.
 * @return {GoogleAppsScript.Spreadsheet.Spreadsheet} The spreadsheet.
 */
function setupSheet() {
  const id = getSheetId();
  if (!id) {
    throw new Error('SHEET_ID is not set in Script Properties.');
  }

  const ss = SpreadsheetApp.openById(id);
  const sheet = ss.getSheets()[0];

  if (sheet.getLastRow() === 0) {
    const range = sheet.getRange(1, 1, 1, HEADERS.length);
    range.setValues([HEADERS]);
    range.setFontWeight('bold').setBackground('#1a1a2e').setFontColor('#ffffff');
    sheet.autoResizeColumns(1, HEADERS.length);
    sheet.setFrozenRows(1);
  } else {
    const headings = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
    if (HEADERS.slice(0, 16).some((heading, index) => headings[index] !== heading)) {
      throw new Error('The first tab does not have the expected inquiry headings. Check the configured spreadsheet.');
    }
    for (let column = 16; column < HEADERS.length; column++) {
      if (headings[column] && headings[column] !== HEADERS[column]) {
        throw new Error('The inquiry extension columns contain other data. Review the sheet before upgrading.');
      }
    }
    sheet.getRange(1, 17, 1, 2).setValues([HEADERS.slice(16)]);
  }

  return ss;
}

/**
 * Append a classified inquiry to the sheet.
 * @param {Object} payload Submitted payload.
 * @param {Object} classification Result of classifyInquiry.
 * @return {Object} Stored row ID, duplicate indicator, or conflict indicator.
 */
function storeInquiry(payload, classification) {
  const sheet = setupSheet().getSheets()[0];
  const rowId = payload.requestId || Utilities.getUuid();
  const content = JSON.stringify(['name', 'email', 'phone', 'company', 'industry', 'service', 'message', 'source'].map(field => payload[field] || ''));
  const payloadHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, content, Utilities.Charset.UTF_8)
      .map(value => ((value + 256) % 256).toString(16).padStart(2, '0')).join('');
  if (sheet.getLastRow() > 1) {
    const found = sheet.getRange(2, 16, sheet.getLastRow() - 1, 1).createTextFinder(rowId)
        .matchEntireCell(true).matchCase(true).findNext();
    if (found) {
      const storedHash = sheet.getRange(found.getRow(), 18).getValue();
      if (storedHash !== payloadHash) return {conflict: true};
      return {rowId: rowId, duplicate: true};
    }
  }

  const safeText = value => /^[\s]*[=+@-]/.test(String(value || '')) ? "'" + String(value) : String(value || '');

  sheet.appendRow([
    new Date().toISOString(),
    safeText(payload.name),
    safeText(payload.email),
    safeText(payload.phone),
    safeText(payload.company),
    safeText(payload.industry),
    safeText(payload.message),
    safeText(payload.source),
    classification.intent,
    classification.urgency,
    classification.fit_score,
    safeText(classification.summary),
    safeText(classification.suggested_action),
    classification.category,
    'New',
    rowId,
    safeText(payload.service),
    payloadHash,
  ]);

  const colors = {high: '#ffebee', medium: '#fff8e1', low: '#e8f5e9'};
  sheet.getRange(sheet.getLastRow(), 1, 1, HEADERS.length)
      .setBackground(colors[classification.urgency] || '#ffffff');

  return {rowId: rowId, duplicate: false};
}

/**
 * Read every inquiry, newest first.
 * @return {Array<Object>} Inquiry records.
 */
function getAllInquiries() {
  const sheet = setupSheet().getSheets()[0];
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  return sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues().map((row, idx) => ({
    id: row[15] || String(idx + 1),
    name: row[1] || 'Unknown',
    email: row[2] || '',
    phone: row[3] || '',
    company: row[4] || '',
    industry: row[5] || '',
    message: row[6] || '',
    source: row[7] || '',
    intent: row[8] || '',
    urgency: row[9] || '',
    fit_score: row[10] || 0,
    summary: row[11] || '',
    suggested_action: row[12] || '',
    category: row[13] || '',
    status: row[14] || 'New',
    service: row[16] || '',
    last_active: row[0] || new Date().toISOString(),
  })).reverse();
}

/**
 * Aggregate counts for the dashboard.
 * @return {Object} Totals broken down by intent, urgency, and category.
 */
function getStats() {
  const inquiries = getAllInquiries();
  const stats = {
    total: inquiries.length, byIntent: {}, byUrgency: {}, byCategory: {}, avgFitScore: 0,
  };
  let totalFit = 0;

  inquiries.forEach((i) => {
    stats.byIntent[i.intent] = (stats.byIntent[i.intent] || 0) + 1;
    stats.byUrgency[i.urgency] = (stats.byUrgency[i.urgency] || 0) + 1;
    stats.byCategory[i.category] = (stats.byCategory[i.category] || 0) + 1;
    totalFit += Number(i.fit_score) || 0;
  });

  stats.avgFitScore = inquiries.length > 0 ?
    (totalFit / inquiries.length).toFixed(1) : '0';
  return stats;
}

// ═══════════════════════════════════════════════════════════════
// EMAIL
// ═══════════════════════════════════════════════════════════════

/**
 * Notify the owner and acknowledge the sender.
 * Failures are swallowed so a mail problem never drops a captured lead.
 * @param {Object} payload Submitted payload.
 * @param {Object} classification Result of classifyInquiry.
 * @return {void}
 */
function escapeEmailHtml(value) {
  const entities = {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'};
  return String(value || '').replace(/[&<>"']/g, character => entities[character]);
}

function buildUserConfirmationEmail(payload, rowId) {
  const services = {
    'ai-automation': 'AI Workflow Automation',
    'lead-scoring': 'Intelligent Lead Scoring',
    'custom-integration': 'Custom CRM Integration',
    consulting: 'Strategy & Consulting',
  };
  const service = Object.prototype.hasOwnProperty.call(services, payload.service) ? services[payload.service] : payload.service || 'General inquiry';
  const firstName = String(payload.name || '').trim().split(/\s+/)[0] || 'there';
  const details = [['Company', payload.company], ['Interested in', service], ['Inquiry reference', rowId]].filter(detail => detail[1]);
  const detailHtml = details.map(detail => `<tr><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;"><p style="margin:0 0 4px;font-size:12px;line-height:18px;color:#64748b;">${escapeEmailHtml(detail[0])}</p><p style="margin:0;font-size:14px;line-height:22px;color:#0f172a;overflow-wrap:anywhere;word-break:break-all;">${escapeEmailHtml(detail[1])}</p></td></tr>`).join('');
  const introduction = 'Thanks for reaching out. Your inquiry has been saved, and we will review how NodalX can support your business.';
  const nextSteps = 'We will review your requirements and reply to this email address with relevant next steps. This email confirms receipt; it does not book a call or activate a service.';
  const replyPrompt = 'Want to give us a head start? Reply with the tools you use, your current workflow, and the manual task you would most like to simplify. Please do not send passwords or sensitive customer data.';
  return {
    to: payload.email,
    name: 'NodalX',
    replyTo: getOwnerEmail_() || '',
    subject: 'Your inquiry is received | NodalX',
    body: `Hi ${firstName},\n\n${introduction}\n\nYOUR INQUIRY\n${details.map(detail => detail[0] + ': ' + detail[1]).join('\n')}\n\nWHAT HAPPENS NEXT\n${nextSteps}\n\n${replyPrompt}\n\nExplore NodalX: https://nodalx.in\n\nThe NodalX team\nYou received this confirmation because this email address was used to submit an inquiry at nodalx.in. If that was not you, you can ignore this message.`,
    htmlBody: `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Your NodalX inquiry</title></head>
<body style="margin:0;padding:0;background-color:#f1f5f9;color:#0f172a;font-family:Arial,Helvetica,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">Your inquiry is saved. Here is what happens next, and how to share more context.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f1f5f9;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;table-layout:fixed;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:16px;">
<tr><td style="padding:28px 24px;background-color:#0f172a;border-radius:16px 16px 0 0;"><a href="https://nodalx.in" style="font-size:25px;line-height:32px;font-weight:700;letter-spacing:-1px;color:#ffffff;text-decoration:none;">Nodal<span style="color:#a5b4fc;">X</span></a><p style="margin:8px 0 0;font-size:12px;line-height:18px;color:#cbd5e1;">Less manual work. More clarity.</p></td></tr>
<tr><td style="padding:28px 24px 0;overflow-wrap:anywhere;word-wrap:break-word;"><p style="margin:0 0 12px;font-size:11px;line-height:18px;letter-spacing:2px;font-weight:700;color:#4f46e5;">INQUIRY RECEIVED</p><h1 style="margin:0 0 20px;font-size:28px;line-height:36px;font-weight:700;letter-spacing:-0.5px;color:#0f172a;">Let&#39;s make work simpler.</h1><p style="margin:0 0 12px;font-size:15px;line-height:24px;color:#0f172a;word-break:break-word;">Hi ${escapeEmailHtml(firstName)},</p><p style="margin:0;font-size:15px;line-height:24px;color:#475569;">${introduction}</p></td></tr>
<tr><td style="padding:24px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="table-layout:fixed;background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;"><tr><td style="padding:16px 20px;"><h2 style="margin:0 0 4px;font-size:14px;line-height:22px;color:#0f172a;">Your inquiry at a glance</h2><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="table-layout:fixed;">${detailHtml}</table></td></tr></table></td></tr>
<tr><td style="padding:0 24px 24px;"><h2 style="margin:0 0 10px;font-size:18px;line-height:26px;color:#0f172a;">What happens next?</h2><p style="margin:0 0 16px;font-size:14px;line-height:23px;color:#475569;">${nextSteps}</p><p style="margin:0;font-size:14px;line-height:23px;color:#475569;">${replyPrompt}</p></td></tr>
<tr><td style="padding:0 24px 28px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#4f46e5" style="border-radius:8px;background-color:#4f46e5;"><a href="https://nodalx.in" style="display:inline-block;padding:14px 22px;border:1px solid #4f46e5;border-radius:8px;font-size:14px;line-height:20px;font-weight:700;color:#ffffff;text-decoration:none;">Explore NodalX</a></td></tr></table><p style="margin:20px 0 0;font-size:14px;line-height:22px;color:#475569;">Thank you,<br><strong style="color:#0f172a;">The NodalX team</strong></p></td></tr>
<tr><td style="padding:20px 24px;border-top:1px solid #e2e8f0;"><p style="margin:0;font-size:11px;line-height:18px;color:#64748b;">You received this confirmation because this email address was used to submit an inquiry at <a href="https://nodalx.in" style="color:#64748b;text-decoration:underline;">nodalx.in</a>. If that was not you, you can ignore this message.</p></td></tr>
</table></td></tr></table></body></html>`,
  };
}

function sendEmailNotifications(payload, classification, rowId) {
  if (!payload || !payload.name) return;

  try {
    const ownerEmail = getOwnerEmail_();
    if (CONFIG.SEND_OWNER_EMAIL && ownerEmail) {
      MailApp.sendEmail({
        to: ownerEmail,
        subject: 'New Inquiry from ' + payload.name + ' (' + classification.intent +
          ' / ' + classification.urgency + ' urgency)',
        body:
          'New inquiry received on NodalX:\n\n' +
          'Name: ' + (payload.name || '') + '\n' +
          'Email: ' + (payload.email || '') + '\n' +
          'Phone: ' + (payload.phone || 'Not provided') + '\n' +
          'Company: ' + (payload.company || '') + '\n' +
          'Industry: ' + (payload.industry || '') + '\n' +
          'Message: ' + (payload.message || '') + '\n\n' +
          'Suggested action: ' + classification.suggested_action,
      });
    }
  } catch (error) {
    console.error('Owner notification failed');
  }

  try {
    if (CONFIG.SEND_USER_CONFIRMATION && payload.email) {
      MailApp.sendEmail(buildUserConfirmationEmail(payload, rowId));
    }
  } catch (error) {
    console.error('Confirmation email failed');
  }
}

// ═══════════════════════════════════════════════════════════════
// WEBHOOK ENTRY POINTS
// ═══════════════════════════════════════════════════════════════

/**
 * Serialize a response as JSON.
 * @param {*} data Payload.
 * @return {GoogleAppsScript.ContentService.TextOutput} Response.
 */
function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
      .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Receive a new inquiry.
 * @param {GoogleAppsScript.Events.DoPost} e Event.
 * @return {GoogleAppsScript.ContentService.TextOutput} Response.
 */
function doPost(e) {
  if (!isAuthorized(e)) {
    return jsonResponse({success: false, message: 'Unauthorized'});
  }

  const lock = LockService.getScriptLock();
  let locked = false;

  try {
    let payload;
    try {
      payload = JSON.parse(e.postData.contents);
    } catch (error) {
      return jsonResponse({success: false, message: 'Invalid JSON'});
    }

    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return jsonResponse({success: false, message: 'Invalid inquiry'});
    }
    for (const field of ['name', 'email', 'phone', 'company', 'industry', 'service', 'message', 'source']) {
      if (payload[field] != null && (typeof payload[field] !== 'string' || payload[field].length > (field === 'message' ? 12000 : 500))) {
        return jsonResponse({success: false, message: 'Invalid inquiry field'});
      }
      payload[field] = (payload[field] || '').trim();
    }
    if (['name', 'email', 'company', 'message'].some(field => !payload[field]) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
      return jsonResponse({success: false, message: 'Name, valid email, company, and message are required'});
    }
    if (payload.requestId != null && (typeof payload.requestId !== 'string' || !/^[a-zA-Z0-9_-]{8,100}$/.test(payload.requestId))) {
      return jsonResponse({success: false, message: 'Invalid request ID'});
    }
    lock.waitLock(10000);
    locked = true;

    const classification = classifyInquiry(payload);
    const stored = storeInquiry(payload, classification);
    if (stored.conflict) return jsonResponse({success: false, code: 'IDEMPOTENCY_CONFLICT', message: 'Request ID belongs to different inquiry data'});
    if (!stored.duplicate) sendEmailNotifications(payload, classification, stored.rowId);

    return jsonResponse({
      success: true,
      message: 'Inquiry received and classified!',
      classification: classification,
      rowId: stored.rowId,
      duplicate: stored.duplicate,
    });
  } catch (error) {
    console.error('doPost failed');
    return jsonResponse({success: false, message: 'Server error'});
  } finally {
    if (locked) lock.releaseLock();
  }
}

/**
 * Read inquiries or stats. Returns customer contact details, so it is gated
 * on the same shared secret as intake.
 * @param {GoogleAppsScript.Events.DoGet} e Event.
 * @return {GoogleAppsScript.ContentService.TextOutput} Response.
 */
function doGet(e) {
  if (!isAuthorized(e)) {
    return jsonResponse({success: false, message: 'Unauthorized'});
  }

  try {
    const action = (e && e.parameter && e.parameter.action) || 'list';

    if (action === 'health') {
      const sheet = SpreadsheetApp.openById(getSheetId()).getSheets()[0];
      return jsonResponse({success: true, configured: true, sheetAccessible: true, rows: Math.max(0, sheet.getLastRow() - 1)});
    }

    if (action === 'list') {
      const inquiries = getAllInquiries();
      return jsonResponse({success: true, count: inquiries.length, customers: inquiries});
    }
    if (action === 'stats') {
      return jsonResponse({success: true, stats: getStats()});
    }

    return jsonResponse({success: false, message: 'Unknown action'});
  } catch (error) {
    console.error('doGet failed');
    return jsonResponse({success: false, message: 'Server error'});
  }
}

/**
 * Handle CORS preflight.
 * @return {GoogleAppsScript.ContentService.TextOutput} Empty response.
 */
function doOptions() {
  return ContentService.createTextOutput('')
      .setMimeType(ContentService.MimeType.TEXT);
}

// ═══════════════════════════════════════════════════════════════
// EDITOR HELPERS (run manually, not part of the webhook)
// ═══════════════════════════════════════════════════════════════

/**
 * Create the header row if the sheet is empty. Run once after setting SHEET_ID.
 * @return {string} Confirmation message.
 */
function setupSheetHeaders() {
  const ss = setupSheet();
  const message = 'Sheet ready: ' + ss.getUrl() +
    ' — ' + getAllInquiries().length + ' existing row(s) found.';
  console.log(message);
  return message;
}

/**
 * Report whether the deployment is correctly configured, without exposing the
 * secret itself. Output goes to the Execution log so it is visible after a run.
 * @return {string} A human-readable status report.
 */
function healthCheck() {
  const report = [];
  report.push('INTAKE_SECRET set: ' + (getIntakeSecret() ? 'yes' : 'NO — all requests rejected'));
  report.push('SHEET_ID set: ' + (getSheetId() ? 'yes' : 'NO — intake will error'));

  try {
    report.push('Sheet rows: ' + getAllInquiries().length);
  } catch (error) {
    report.push('Sheet read failed: ' + error);
  }

  const summary = report.join('\n');
  console.log(summary);
  return summary;
}
