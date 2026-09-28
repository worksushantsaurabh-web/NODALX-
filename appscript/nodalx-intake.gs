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
 * Anyone. Then copy the URL into frontend/.env (git-ignored).
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

const CONFIG = {
  SHEET_NAME: 'NodalX_Inquiries',
  OWNER_EMAIL: 'thesushantsaurabh@gmail.com',
  SEND_OWNER_EMAIL: true,
  SEND_USER_CONFIRMATION: true,
};

/** Sheet columns, in order. Changing this breaks existing rows. */
const HEADERS = [
  'Timestamp', 'Name', 'Email', 'Phone', 'Company', 'Industry',
  'Message', 'Source', 'Intent', 'Urgency', 'Fit Score',
  'Summary', 'Suggested Action', 'Category', 'Status', 'Row ID',
];

// ═══════════════════════════════════════════════════════════════
// AUTHORIZATION
// ═══════════════════════════════════════════════════════════════

/**
 * Verify the shared secret on an inbound request.
 *
 * Uses a constant-time comparison so a wrong secret cannot be recovered by
 * timing responses. Accepts either an `x-nodalx-secret` header or a `secret`
 * query parameter, because Apps Script does not forward arbitrary headers for
 * every invocation mode.
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
  }

  return ss;
}

/**
 * Append a classified inquiry to the sheet.
 * @param {Object} payload Submitted payload.
 * @param {Object} classification Result of classifyInquiry.
 * @return {string} The generated row ID.
 */
function storeInquiry(payload, classification) {
  const sheet = setupSheet().getSheets()[0];
  const rowId = Utilities.getUuid();

  sheet.appendRow([
    new Date().toISOString(),
    payload.name || '',
    payload.email || '',
    payload.phone || '',
    payload.company || '',
    payload.industry || '',
    payload.message || '',
    payload.source || '',
    classification.intent,
    classification.urgency,
    classification.fit_score,
    classification.summary,
    classification.suggested_action,
    classification.category,
    'New',
    rowId,
  ]);

  const colors = {high: '#ffebee', medium: '#fff8e1', low: '#e8f5e9'};
  sheet.getRange(sheet.getLastRow(), 1, 1, HEADERS.length)
      .setBackground(colors[classification.urgency] || '#ffffff');

  return rowId;
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
function sendEmailNotifications(payload, classification) {
  if (!payload || !payload.name) return;

  try {
    if (CONFIG.SEND_OWNER_EMAIL && CONFIG.OWNER_EMAIL) {
      MailApp.sendEmail({
        to: CONFIG.OWNER_EMAIL,
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
    console.error('Owner notification failed: ' + error);
  }

  try {
    if (CONFIG.SEND_USER_CONFIRMATION && payload.email) {
      MailApp.sendEmail({
        to: payload.email,
        subject: 'Thanks for reaching out to NodalX',
        body: 'Hi ' + payload.name + ',\n\n' +
          'Thanks for your message. We received it and will reply shortly.\n\n' +
          '— The NodalX team',
      });
    }
  } catch (error) {
    console.error('Confirmation email failed: ' + error);
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
  lock.waitLock(10000);

  try {
    let payload;
    try {
      payload = JSON.parse(e.postData.contents);
    } catch (error) {
      return jsonResponse({success: false, message: 'Invalid JSON'});
    }

    if (!payload.name || !payload.email) {
      return jsonResponse({success: false, message: 'Name and email are required'});
    }

    const classification = classifyInquiry(payload);
    const rowId = storeInquiry(payload, classification);
    sendEmailNotifications(payload, classification);

    return jsonResponse({
      success: true,
      message: 'Inquiry received and classified!',
      classification: classification,
      rowId: rowId,
    });
  } catch (error) {
    console.error('doPost failed: ' + error);
    return jsonResponse({success: false, message: 'Server error'});
  } finally {
    lock.releaseLock();
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

    if (action === 'list') {
      const inquiries = getAllInquiries();
      return jsonResponse({success: true, count: inquiries.length, customers: inquiries});
    }
    if (action === 'stats') {
      return jsonResponse({success: true, stats: getStats()});
    }

    return jsonResponse({success: false, message: 'Unknown action'});
  } catch (error) {
    console.error('doGet failed: ' + error);
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
