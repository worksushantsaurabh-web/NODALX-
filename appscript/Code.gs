/**
 * ═══════════════════════════════════════════════════════════════
 * NODALxAI — Inquiry Pipeline (Apps Script Backend)
 * ═══════════════════════════════════════════════════════════════
 * 
 * Replaces n8n with Google Apps Script + Google Sheets
 * Uses EMBEDDED TEXT rules for classification (no external AI API)
 * 
 * Deploy as Web App:
 *   1. Copy this code into script.google.com
 *   2. Run setupSheet() once
 *   3. Deploy → New Deployment → Web App → Anyone
 *   4. Paste the Web App URL into your frontend
 */

// ═══════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════

const CONFIG = {
  // Your Google Sheet ID (from the URL between /d/ and /edit)
  SPREADSHEET_ID: '1djfUM9Qe0BrVZGdqucu36knltLnycKc4gULz8Sh7Xdk',

  SHEET_NAME: 'NODALxAI_Inquiries',
  ALLOWED_ORIGIN: '*', // Change to your domain in production
  OWNER_EMAIL: 'thesushantsaurabh@gmail.com',
  SEND_OWNER_EMAIL: true,
  SEND_USER_CONFIRMATION: true,
};

// ═══════════════════════════════════════════════════════════════
// EMBEDDED CLASSIFICATION RULES (no external API needed)
// ═══════════════════════════════════════════════════════════════

// Keywords mapped to classification categories
const KEYWORD_MAP = {
  // Intent classification
  intent: {
    purchase: ['buy', 'purchase', 'quote', 'pricing', 'price', 'cost', 'budget', 'pay', 'order', 'invest', 'spend', 'proposal', 'roi', 'deal', 'acquire', 'get'],
    partnership: ['partner', 'partnership', 'collaborate', 'collaboration', 'joint venture', 'reseller', 'distributor', 'affiliate', 'integration partner', 'strategic'],
    support: ['support', 'help', 'issue', 'problem', 'bug', 'fix', 'troubleshoot', 'error', 'not working', 'broken', 'assist', 'guidance'],
    spam: ['viagra', 'crypto', 'bitcoin', 'lottery', 'winner', 'prize', 'free money', 'click here', 'act now', 'limited time', '100% free', 'guaranteed'],
  },

  // Urgency classification
  urgency: {
    high: ['asap', 'urgent', 'immediately', 'emergency', 'critical', 'deadline', 'today', 'tomorrow', 'this week', 'rush', 'quick', 'fast', 'as soon as possible', 'right away'],
    medium: ['soon', 'next week', 'upcoming', 'planned', 'scheduled', 'quarter', 'monthly'],
    low: ['exploring', 'research', 'information', 'curious', 'interested', 'considering', 'future', 'later', 'sometime', 'when ready'],
  },

  // Business category
  category: {
    enterprise: ['enterprise', 'fortune', '500', 'corporation', 'multinational', 'global', 'subsidiary', 'subsidiaries', 'department', 'teams', 'divisions', '1000+', 'large scale'],
    smb: ['small business', 'startup', 'sme', 'mid-size', 'growing', 'scale', 'local', 'regional', 'boutique', 'agency', 'consulting firm'],
    individual: ['freelancer', 'solo', 'individual', 'personal', 'myself', 'i need', 'i want', 'sole proprietor', 'one person'],
  },
};

// Action suggestions based on intent + category
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

// ═══════════════════════════════════════════════════════════════
// CLASSIFICATION ENGINE (Rule-based, zero API calls)
// ═══════════════════════════════════════════════════════════════

function classifyInquiry(data) {
  const text = (
    (data.name || '') + ' ' +
    (data.company || '') + ' ' +
    (data.industry || '') + ' ' +
    (data.message || '')
  ).toLowerCase();

  // 1. Detect intent
  let intent = 'general';
  let intentScore = 0;
  for (const [key, keywords] of Object.entries(KEYWORD_MAP.intent)) {
    const score = keywords.reduce((sum, kw) => sum + (text.includes(kw.toLowerCase()) ? 1 : 0), 0);
    if (score > intentScore) {
      intent = key;
      intentScore = score;
    }
  }

  // 2. Detect urgency
  let urgency = 'medium';
  let urgencyScore = 0;
  for (const [key, keywords] of Object.entries(KEYWORD_MAP.urgency)) {
    const score = keywords.reduce((sum, kw) => sum + (text.includes(kw.toLowerCase()) ? 1 : 0), 0);
    if (score > urgencyScore) {
      urgency = key;
      urgencyScore = score;
    }
  }

  // 3. Detect category
  let category = 'unknown';
  let categoryScore = 0;
  for (const [key, keywords] of Object.entries(KEYWORD_MAP.category)) {
    const score = keywords.reduce((sum, kw) => sum + (text.includes(kw.toLowerCase()) ? 1 : 0), 0);
    if (score > categoryScore) {
      category = key;
      categoryScore = score;
    }
  }

  // 4. Calculate fit score (1-10)
  // +3 for purchase intent, +2 for partnership, +1 for support
  // +3 for enterprise, +2 for smb, +1 for individual
  // +2 for high urgency, +1 for medium
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

  // 5. Generate summary
  const summary = generateSummary(data, intent, category);

  // 6. Suggested action
  const actionKey = intent + ',' + category;
  const suggestedAction = ACTION_TEMPLATES[actionKey] || ACTION_TEMPLATES['general,unknown'];

  return {
    intent: intent,
    urgency: urgency,
    fit_score: fitScore,
    summary: summary,
    suggested_action: suggestedAction,
    category: category,
  };
}

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

// ═══════════════════════════════════════════════════════════════
// SHEET SETUP
// ═══════════════════════════════════════════════════════════════

function setupSheet() {
  let ss;
  try {
    if (CONFIG.SPREADSHEET_ID) {
      ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    } else {
      const files = DriveApp.getFilesByName(CONFIG.SHEET_NAME);
      if (files.hasNext()) {
        ss = SpreadsheetApp.open(files.next());
      } else {
        ss = SpreadsheetApp.create(CONFIG.SHEET_NAME);
      }
    }
  } catch (e) {
    ss = SpreadsheetApp.create(CONFIG.SHEET_NAME);
  }
  
  const sheet = ss.getSheets()[0];
  
  if (sheet.getLastRow() === 0) {
    const headers = [
      'Timestamp', 'Name', 'Email', 'Phone', 'Company', 'Industry',
      'Message', 'Source', 'Intent', 'Urgency', 'Fit Score',
      'Summary', 'Suggested Action', 'Category', 'Status', 'Row ID'
    ];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#1a1a2e')
      .setFontColor('#ffffff');
    sheet.autoResizeColumns(1, headers.length);
    sheet.setFrozenRows(1);
  }
  
  return ss;
}

// ═══════════════════════════════════════════════════════════════
// WEBHOOK: POST (submit inquiry)
// ═══════════════════════════════════════════════════════════════

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  
  try {
    let payload;
    try {
      payload = JSON.parse(e.postData.contents);
    } catch (err) {
      return jsonResponse({ success: false, message: 'Invalid JSON' }, 400);
    }

    // Validate
    if (!payload.name || !payload.email) {
      return jsonResponse({ success: false, message: 'Name and email are required' }, 400);
    }

    // Classify (embedded rules — zero API calls)
    const classification = classifyInquiry(payload);

    // Store in sheet
    const rowId = storeInquiry(payload, classification);

    // Send email notifications
    sendEmailNotifications(payload, classification);

    return jsonResponse({
      success: true,
      message: 'Inquiry received and classified!',
      classification: classification,
      rowId: rowId,
    }, 201);

  } catch (err) {
    Logger.log('Error in doPost: ' + err.toString());
    return jsonResponse({ success: false, message: 'Server error: ' + err.toString() }, 500);
  } finally {
    lock.releaseLock();
  }
}

// ═══════════════════════════════════════════════════════════════
// WEBHOOK: GET (fetch inquiries for dashboard)
// ═══════════════════════════════════════════════════════════════

function doGet(e) {
  try {
    const action = e.parameter.action || 'list';

    if (action === 'list') {
      const inquiries = getAllInquiries();
      return jsonResponse({ success: true, customers: inquiries, count: inquiries.length });
    }

    if (action === 'stats') {
      return jsonResponse({ success: true, stats: getStats() });
    }

    return jsonResponse({ success: false, message: 'Unknown action. Use ?action=list or ?action=stats' }, 400);

  } catch (err) {
    Logger.log('Error in doGet: ' + err.toString());
    return jsonResponse({ success: false, message: 'Server error' }, 500);
  }
}

// ═══════════════════════════════════════════════════════════════
// STORAGE
// ═══════════════════════════════════════════════════════════════

function storeInquiry(payload, classification) {
  const ss = setupSheet();
  const sheet = ss.getSheets()[0];
  const rowId = Utilities.getUuid();
  const timestamp = new Date().toISOString();

  const row = [
    timestamp,
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
  ];

  sheet.appendRow(row);
  const lastRow = sheet.getLastRow();

  // Color by urgency
  const colors = {
    high: '#ffebee',
    medium: '#fff8e1',
    low: '#e8f5e9',
  };
  sheet.getRange(lastRow, 1, 1, row.length).setBackground(colors[classification.urgency] || '#ffffff');

  return rowId;
}

function getAllInquiries() {
  const ss = setupSheet();
  const sheet = ss.getSheets()[0];
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  const values = sheet.getRange(2, 1, lastRow - 1, 16).getValues();
  return values.map((row, idx) => ({
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

function getStats() {
  const inquiries = getAllInquiries();
  const stats = { total: inquiries.length, byIntent: {}, byUrgency: {}, byCategory: {}, avgFitScore: 0 };
  let totalFit = 0;

  inquiries.forEach(i => {
    stats.byIntent[i.intent] = (stats.byIntent[i.intent] || 0) + 1;
    stats.byUrgency[i.urgency] = (stats.byUrgency[i.urgency] || 0) + 1;
    stats.byCategory[i.category] = (stats.byCategory[i.category] || 0) + 1;
    totalFit += Number(i.fit_score) || 0;
  });

  stats.avgFitScore = inquiries.length > 0 ? (totalFit / inquiries.length).toFixed(1) : '0';
  return stats;
}

// ═══════════════════════════════════════════════════════════════
// EMAIL NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════

function sendEmailNotifications(payload, classification) {
  try {
    if (CONFIG.SEND_OWNER_EMAIL && CONFIG.OWNER_EMAIL) {
      const ownerSubject = '🔥 New Inquiry from ' + (payload.name || 'Unknown') + ' (' + classification.intent + ' / ' + classification.urgency + ' urgency)';
      const ownerBody = 'New inquiry received on NODALxAI:\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
        'CONTACT DETAILS\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
        'Name: ' + (payload.name || '') + '\n' +
        'Email: ' + (payload.email || '') + '\n' +
        'Phone: ' + (payload.phone || 'Not provided') + '\n' +
        'Company: ' + (payload.company || '') + '\n' +
        'Industry: ' + (payload.industry || 'Not specified') + '\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
        'MESSAGE\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
        (payload.message || '') + '\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
        'AI CLASSIFICATION\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
        'Intent: ' + classification.intent + '\n' +
        'Urgency: ' + classification.urgency + '\n' +
        'Fit Score: ' + classification.fit_score + '/10\n' +
        'Category: ' + classification.category + '\n' +
        'Summary: ' + classification.summary + '\n' +
        'Suggested Action: ' + classification.suggested_action + '\n\n' +
        'Reply directly to this lead: ' + (payload.email || '');

      MailApp.sendEmail({
        to: CONFIG.OWNER_EMAIL,
        subject: ownerSubject,
        body: ownerBody,
        replyTo: payload.email || '',
      });
      Logger.log('Owner notification sent to: ' + CONFIG.OWNER_EMAIL);
    }

    if (CONFIG.SEND_USER_CONFIRMATION && payload.email) {
      var serviceBlock = getServiceFollowUp(payload.service);
      var userSubject = serviceBlock.subject;
      var userBody = 'Hi ' + (payload.name || 'there') + ',\n\n' +
        'Thank you for reaching out to NODALxAI! We\'ve received your inquiry and our team is reviewing it.\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
        'YOUR INQUIRY SUMMARY\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
        'Company: ' + (payload.company || '') + '\n' +
        'Service: ' + (serviceBlock.label || 'General') + '\n' +
        'Message: ' + (payload.message || '') + '\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
        serviceBlock.heading + '\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
        serviceBlock.body + '\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
        'NEXT STEP\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
        serviceBlock.nextStep + '\n\n' +
        'Simply reply to this email with your answers and we\'ll get started.\n\n' +
        'Best regards,\nThe NODALxAI Team\nhttps://nodalxai.com';

      MailApp.sendEmail({
        to: payload.email,
        subject: userSubject,
        body: userBody,
        name: 'NODALxAI',
      });
      Logger.log('User confirmation sent to: ' + payload.email);
    }
  } catch (emailError) {
    Logger.log('Email notification error: ' + emailError.toString());
  }
}

// ═══════════════════════════════════════════════════════════════
// SERVICE-SPECIFIC FOLLOW-UP TEMPLATES
// ═══════════════════════════════════════════════════════════════

function getServiceFollowUp(service) {
  var templates = {
    'ai-automation': {
      label: 'AI Workflow Automation',
      subject: 'Let\'s scope your automation — NODALxAI',
      heading: 'TO BUILD YOUR AUTOMATION PROPOSAL, WE NEED',
      body:
        'To prepare a tailored automation proposal, please reply with:\n\n' +
        '1. What process do you want to automate? (e.g., lead intake, invoice processing, support triage)\n' +
        '2. What tools do you already use? (e.g., CRM, email, spreadsheets, Slack)\n' +
        '3. Roughly how many requests/leads/tasks per day?\n' +
        '4. What does the current manual process look like?',
      nextStep: 'Once we have your answers, we\'ll deliver an automation proposal within 48 hours — or schedule a setup call if you prefer a walkthrough.',
    },
    'lead-scoring': {
      label: 'Intelligent Lead Scoring',
      subject: 'Let\'s build your scoring model — NODALxAI',
      heading: 'TO DESIGN YOUR LEAD SCORING FRAMEWORK, WE NEED',
      body:
        'To build a scoring model that fits your business, please reply with:\n\n' +
        '1. Where do your leads come from? (e.g., website forms, ads, referrals, cold outbound)\n' +
        '2. What makes a lead "qualified" for your team? (e.g., budget, company size, urgency)\n' +
        '3. Who currently reviews incoming leads, and how?\n' +
        '4. What happens after a lead is qualified? (e.g., sales call, demo, proposal)',
      nextStep: 'We\'ll deliver a lead scoring framework + implementation plan within 48 hours.',
    },
    'custom-integration': {
      label: 'Custom CRM Integration',
      subject: 'Let\'s scope your integration — NODALxAI',
      heading: 'TO ESTIMATE YOUR INTEGRATION, WE NEED',
      body:
        'To scope the integration accurately, please reply with:\n\n' +
        '1. Which CRM are you using? (e.g., HubSpot, Salesforce, Pipedrive, Zoho)\n' +
        '2. What forms or sources feed into it? (e.g., website, landing pages, third-party tools)\n' +
        '3. What should happen after a lead comes in? (e.g., auto-assign, notify, enrich, score)\n' +
        '4. What other systems must stay in sync? (e.g., billing, support, marketing tools)',
      nextStep: 'We\'ll deliver an integration scope document + implementation estimate within 48 hours.',
    },
    'consulting': {
      label: 'Strategy & Consulting',
      subject: 'Let\'s understand your workflow — NODALxAI',
      heading: 'TO PREPARE YOUR AUDIT CALL, WE NEED',
      body:
        'To make the most of our discovery call, please reply with:\n\n' +
        '1. What\'s your biggest bottleneck right now?\n' +
        '2. What does your current workflow look like end-to-end?\n' +
        '3. What\'s the business goal you\'re trying to hit? (e.g., faster response time, more conversions, less manual work)\n' +
        '4. How urgent is this? (e.g., exploring vs. need it this month)',
      nextStep: 'We\'ll schedule a 30-minute audit call and deliver a roadmap within one week.',
    },
  };

  if (service && templates[service]) {
    return templates[service];
  }

  return {
    label: 'General',
    subject: 'We received your inquiry — NODALxAI',
    heading: 'WHAT HAPPENS NEXT',
    body:
      'Our AI has analyzed your inquiry and routed it to the right specialist. ' +
      'You can expect a response within 15 minutes during business hours.',
    nextStep: 'If you have any urgent questions, reply directly to this email.',
  };
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function jsonResponse(data, statusCode) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  // CORS headers must be set on the response object
  return output;
}

function doOptions(e) {
  return ContentService.createTextOutput('').setMimeType(ContentService.MimeType.TEXT);
}

// ═══════════════════════════════════════════════════════════════
// TEST FUNCTIONS (run these from the Apps Script editor)
// ═══════════════════════════════════════════════════════════════

function testClassify() {
  const test = {
    name: 'John Doe',
    email: 'john@acme.com',
    company: 'Acme Corp',
    industry: 'SaaS',
    message: 'We need to buy your AI automation solution ASAP for our enterprise team.',
  };
  const result = classifyInquiry(test);
  Logger.log(JSON.stringify(result, null, 2));
  // Expected: intent=purchase, urgency=high, category=enterprise, fit_score=10
}

function testStore() {
  const payload = {
    name: 'Test User',
    email: 'test@example.com',
    phone: '555-0000',
    company: 'Test Inc',
    industry: 'Finance',
    message: 'Looking for pricing info on your lead scoring tool.',
    source: 'https://nodalxai.com/contact',
  };
  const classification = classifyInquiry(payload);
  const id = storeInquiry(payload, classification);
  Logger.log('Stored row ID: ' + id);
}

function testGetAll() {
  const all = getAllInquiries();
  Logger.log('Total: ' + all.length);
  Logger.log(JSON.stringify(all[0], null, 2));
}
