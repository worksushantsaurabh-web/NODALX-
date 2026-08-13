/**
 * ═══════════════════════════════════════════════════════════════
 * NODALxAI — Inquiry Pipeline (Apps Script Replacement for n8n)
 * ═══════════════════════════════════════════════════════════════
 * 
 * What this does:
 * 1. Receives inquiry via POST webhook (doPost)
 * 2. Classifies with Google Gemini AI
 * 3. Stores in Google Sheets (free Airtable alternative)
 * 4. Returns classification JSON
 * 5. Provides GET endpoint to fetch all inquiries
 * 
 * Deployment:
 * 1. Go to https://script.google.com → New Project
 * 2. Paste this entire file into Code.gs
 * 3. Run setupSheet() once (from the editor) to create the sheet
 * 4. Deploy → New Deployment → Web App
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 5. Copy the Web App URL and paste it in your frontend
 */

// ═══════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════

const CONFIG = {
  // Get your free API key from: https://aistudio.google.com/app/apikey
  GEMINI_API_KEY: 'YOUR_GEMINI_API_KEY_HERE',

  // Sheet name where inquiries are stored
  SHEET_NAME: 'NODALxAI_Inquiries',

  // Gemini model to use
  GEMINI_MODEL: 'gemini-2.0-flash',

  // CORS allowed origin (your frontend URL)
  // Use '*' for any origin during testing, restrict in production
  ALLOWED_ORIGIN: '*',

  // Email notifications
  OWNER_EMAIL: 'sushant.dravid999@gmail.com',
  SEND_OWNER_EMAIL: true,
  SEND_USER_CONFIRMATION: true,
};

// ═══════════════════════════════════════════════════════════════
// SHEET SETUP
// ═══════════════════════════════════════════════════════════════

function setupSheet() {
  let ss;
  try {
    // Try to get existing sheet by name
    const files = DriveApp.getFilesByName(CONFIG.SHEET_NAME);
    if (files.hasNext()) {
      ss = SpreadsheetApp.open(files.next());
      Logger.log('Found existing sheet: ' + ss.getUrl());
    } else {
      ss = SpreadsheetApp.create(CONFIG.SHEET_NAME);
      Logger.log('Created new sheet: ' + ss.getUrl());
    }
  } catch (e) {
    ss = SpreadsheetApp.create(CONFIG.SHEET_NAME);
    Logger.log('Created new sheet: ' + ss.getUrl());
  }
  
  const sheet = ss.getSheets()[0];
  
  // Set up headers if sheet is empty
  if (sheet.getLastRow() === 0) {
    const headers = [
      'Timestamp',
      'Name',
      'Email',
      'Phone',
      'Company',
      'Industry',
      'Service',
      'Message',
      'Intent',
      'Urgency',
      'Fit Score',
      'Summary',
      'Suggested Action',
      'Category',
      'Status',
      'Row ID'
    ];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    
    // Format header row
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setFontWeight('bold')
               .setBackground('#1a1a2e')
               .setFontColor('#ffffff');
    
    // Auto-resize columns
    sheet.autoResizeColumns(1, headers.length);
    
    // Freeze header row
    sheet.setFrozenRows(1);
    
    Logger.log('Sheet initialized with headers');
  }
  
  return ss;
}

// ═══════════════════════════════════════════════════════════════
// WEBHOOK HANDLER (doPost)
// ═══════════════════════════════════════════════════════════════

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  
  try {
    // Parse the incoming JSON payload
    let payload;
    try {
      payload = JSON.parse(e.postData.contents);
    } catch (parseError) {
      return jsonResponse({
        success: false,
        error: 'Invalid JSON payload'
      }, 400);
    }
    
    // Validate required fields
    const { name, email, company, message } = payload;
    if (!name || !email || !company || !message) {
      return jsonResponse({
        success: false,
        error: 'Missing required fields: name, email, company, message'
      }, 400);
    }
    
    // Step 1: Classify with Gemini AI
    const classification = classifyInquiry(payload);

    // Step 2: Store in Google Sheets
    const rowId = storeInquiry(payload, classification);

    // Step 3: Send email notifications
    sendEmailNotifications(payload, classification);

    // Step 4: Return classification to frontend
    return jsonResponse({
      success: true,
      status: 'classified',
      inquiry: {
        name: payload.name,
        email: payload.email,
        company: payload.company
      },
      classification: classification,
      stored: true,
      rowId: rowId
    }, 201);
    
  } catch (error) {
    Logger.log('Error in doPost: ' + error.toString());
    return jsonResponse({
      success: false,
      error: 'Internal error: ' + error.toString()
    }, 500);
  } finally {
    lock.releaseLock();
  }
}

// ═══════════════════════════════════════════════════════════════
// GET INQUIRIES (doGet)
// ═══════════════════════════════════════════════════════════════

function doGet(e) {
  try {
    const action = e.parameter.action || 'list';
    
    if (action === 'list') {
      const inquiries = getAllInquiries();
      return jsonResponse({
        success: true,
        count: inquiries.length,
        customers: inquiries
      });
    }
    
    if (action === 'stats') {
      const stats = getInquiryStats();
      return jsonResponse({
        success: true,
        stats: stats
      });
    }
    
    return jsonResponse({
      success: false,
      error: 'Unknown action. Use ?action=list or ?action=stats'
    }, 400);
    
  } catch (error) {
    Logger.log('Error in doGet: ' + error.toString());
    return jsonResponse({
      success: false,
      error: 'Internal error: ' + error.toString()
    }, 500);
  }
}

// ═══════════════════════════════════════════════════════════════
// GEMINI AI CLASSIFICATION
// ═══════════════════════════════════════════════════════════════

function classifyInquiry(payload) {
  const prompt = `You are an AI business inquiry classifier for NODALxAI, a B2B AI automation company.

Analyze the following inquiry and return a JSON object.

Inquiry Details:
- Name: ${payload.name}
- Email: ${payload.email}
- Company: ${payload.company}
- Industry: ${payload.industry || 'Not specified'}
- Service Interest: ${payload.service || 'Not specified'}
- Message: ${payload.message}

Return ONLY a valid JSON object with these exact fields:
{
  "intent": "<one of: purchase, partnership, support, general, spam>",
  "urgency": "<one of: high, medium, low>",
  "fit_score": <number 1-10>,
  "summary": "<one sentence summary of the inquiry>",
  "suggested_action": "<what the sales team should do next>",
  "category": "<one of: enterprise, smb, individual, unknown>"
}`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.GEMINI_MODEL}:generateContent?key=${CONFIG.GEMINI_API_KEY}`;
    
    const requestBody = {
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 500
      }
    };
    
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify(requestBody),
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();
    
    if (responseCode !== 200) {
      Logger.log('Gemini API error: ' + responseCode + ' - ' + responseText);
      return getDefaultClassification();
    }
    
    const jsonResponse = JSON.parse(responseText);
    const aiText = jsonResponse.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // Extract JSON from the response
    return parseClassificationResponse(aiText);
    
  } catch (error) {
    Logger.log('Error calling Gemini: ' + error.toString());
    return getDefaultClassification();
  }
}

function parseClassificationResponse(aiText) {
  try {
    // Try to find JSON in the response
    const jsonMatch = aiText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const classification = JSON.parse(jsonMatch[0]);
      return {
        intent: classification.intent || 'general',
        urgency: classification.urgency || 'medium',
        fit_score: Number(classification.fit_score) || 5,
        summary: classification.summary || 'No summary generated',
        suggested_action: classification.suggested_action || 'Manual review required',
        category: classification.category || 'unknown'
      };
    }
  } catch (e) {
    Logger.log('Failed to parse AI response: ' + e.toString());
  }
  
  return getDefaultClassification();
}

function getDefaultClassification() {
  return {
    intent: 'general',
    urgency: 'medium',
    fit_score: 5,
    summary: 'Could not classify inquiry - manual review needed',
    suggested_action: 'Review inquiry manually',
    category: 'unknown'
  };
}

// ═══════════════════════════════════════════════════════════════
// GOOGLE SHEETS STORAGE
// ═══════════════════════════════════════════════════════════════

function storeInquiry(payload, classification) {
  const ss = setupSheet();
  const sheet = ss.getSheets()[0];
  
  const rowId = Utilities.getUuid();
  const timestamp = new Date().toISOString();
  
  const rowData = [
    timestamp,
    payload.name || '',
    payload.email || '',
    payload.phone || '',
    payload.company || '',
    payload.industry || '',
    payload.service || '',
    payload.message || '',
    classification.intent,
    classification.urgency,
    classification.fit_score,
    classification.summary,
    classification.suggested_action,
    classification.category,
    'New',
    rowId
  ];
  
  sheet.appendRow(rowData);
  
  // Color-code the row based on urgency
  const lastRow = sheet.getLastRow();
  const rowRange = sheet.getRange(lastRow, 1, 1, rowData.length);
  
  switch (classification.urgency) {
    case 'high':
      rowRange.setBackground('#ffebee'); // Light red
      break;
    case 'medium':
      rowRange.setBackground('#fff8e1'); // Light yellow
      break;
    case 'low':
      rowRange.setBackground('#e8f5e9'); // Light green
      break;
  }
  
  // Auto-resize if needed
  if (lastRow <= 100) {
    sheet.autoResizeColumns(1, rowData.length);
  }
  
  Logger.log('Stored inquiry with ID: ' + rowId);
  return rowId;
}

function getAllInquiries() {
  const ss = setupSheet();
  const sheet = ss.getSheets()[0];
  
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return []; // Only header row
  
  const dataRange = sheet.getRange(2, 1, lastRow - 1, 16);
  const values = dataRange.getValues();
  
  return values.map((row, index) => ({
    id: row[15] || String(index + 1),
    name: row[1] || 'Unknown',
    email: row[2] || '',
    phone: row[3] || '',
    company: row[4] || '',
    industry: row[5] || '',
    service: row[6] || '',
    message: row[7] || '',
    intent: row[8] || '',
    urgency: row[9] || '',
    fit_score: row[10] || 0,
    summary: row[11] || '',
    suggested_action: row[12] || '',
    category: row[13] || '',
    status: row[14] || 'New',
    last_active: row[0] || new Date().toISOString()
  })).reverse(); // Newest first
}

function getInquiryStats() {
  const inquiries = getAllInquiries();
  
  const stats = {
    total: inquiries.length,
    byIntent: {},
    byUrgency: {},
    byCategory: {},
    byStatus: {},
    avgFitScore: 0
  };
  
  let totalFitScore = 0;
  
  inquiries.forEach(inquiry => {
    stats.byIntent[inquiry.intent] = (stats.byIntent[inquiry.intent] || 0) + 1;
    stats.byUrgency[inquiry.urgency] = (stats.byUrgency[inquiry.urgency] || 0) + 1;
    stats.byCategory[inquiry.category] = (stats.byCategory[inquiry.category] || 0) + 1;
    stats.byStatus[inquiry.status] = (stats.byStatus[inquiry.status] || 0) + 1;
    totalFitScore += Number(inquiry.fit_score) || 0;
  });
  
  stats.avgFitScore = inquiries.length > 0 ? (totalFitScore / inquiries.length).toFixed(1) : 0;
  
  return stats;
}

// ═══════════════════════════════════════════════════════════════
// EMAIL NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════

function sendEmailNotifications(payload, classification) {
  try {
    // Notify the owner about new inquiry
    if (CONFIG.SEND_OWNER_EMAIL && CONFIG.OWNER_EMAIL) {
      const ownerSubject = `🔥 New Inquiry from ${payload.name} (${classification.intent} / ${classification.urgency} urgency)`;
      const ownerBody = `
New inquiry received on NODALxAI:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONTACT DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Name: ${payload.name}
Email: ${payload.email}
Phone: ${payload.phone || 'Not provided'}
Company: ${payload.company}
Industry: ${payload.industry || 'Not specified'}
Service Interest: ${payload.service || 'Not specified'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MESSAGE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${payload.message}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AI CLASSIFICATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Intent: ${classification.intent}
Urgency: ${classification.urgency}
Fit Score: ${classification.fit_score}/10
Category: ${classification.category}
Summary: ${classification.summary}
Suggested Action: ${classification.suggested_action}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Reply directly to this lead: ${payload.email}
`;

      MailApp.sendEmail({
        to: CONFIG.OWNER_EMAIL,
        subject: ownerSubject,
        body: ownerBody,
        replyTo: payload.email,
      });
      Logger.log('Owner notification email sent to: ' + CONFIG.OWNER_EMAIL);
    }

    // Send confirmation to the user who submitted the inquiry
    if (CONFIG.SEND_USER_CONFIRMATION && payload.email) {
      const userSubject = 'We received your inquiry — NODALxAI';
      const userBody = `
Hi ${payload.name},

Thank you for reaching out to NODALxAI! We've received your inquiry and our team is reviewing it.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
YOUR INQUIRY SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Company: ${payload.company}
Service Interest: ${payload.service || 'General'}
Message: ${payload.message}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHAT HAPPENS NEXT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Our AI has analyzed your inquiry and routed it to the right specialist. You can expect a response within 15 minutes during business hours.

If you have any urgent questions, reply directly to this email.

Best regards,
The NODALxAI Team
https://nodalxai.com
`;

      MailApp.sendEmail({
        to: payload.email,
        subject: userSubject,
        body: userBody,
        name: 'NODALxAI',
      });
      Logger.log('User confirmation email sent to: ' + payload.email);
    }
  } catch (emailError) {
    Logger.log('Email notification error: ' + emailError.toString());
  }
}

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

function jsonResponse(data, statusCode) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeaders({
      'Access-Control-Allow-Origin': CONFIG.ALLOWED_ORIGIN,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    });
}

// Handle CORS preflight
function doOptions(e) {
  return ContentService
    .createTextOutput('')
    .setMimeType(ContentService.MimeType.TEXT)
    .setHeaders({
      'Access-Control-Allow-Origin': CONFIG.ALLOWED_ORIGIN,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    });
}

// ═══════════════════════════════════════════════════════════════
// TESTING (Run these from the Apps Script editor)
// ═══════════════════════════════════════════════════════════════

function testClassifyInquiry() {
  const testPayload = {
    name: 'John Doe',
    email: 'john@acme.com',
    company: 'Acme Corp',
    industry: 'technology',
    service: 'ai-automation',
    message: 'We need to automate our lead qualification process. We get about 500 leads per week and our sales team is overwhelmed.'
  };
  
  const result = classifyInquiry(testPayload);
  Logger.log('Classification result: ' + JSON.stringify(result, null, 2));
}

function testStoreInquiry() {
  const testPayload = {
    name: 'Test User',
    email: 'test@example.com',
    company: 'Test Corp',
    industry: 'finance',
    service: 'lead-scoring',
    message: 'Looking for lead scoring automation for our mortgage business.'
  };
  
  const classification = {
    intent: 'purchase',
    urgency: 'high',
    fit_score: 9,
    summary: 'Mortgage company seeking lead scoring automation',
    suggested_action: 'Schedule demo within 24 hours',
    category: 'enterprise'
  };
  
  const rowId = storeInquiry(testPayload, classification);
  Logger.log('Stored with ID: ' + rowId);
}

function testGetAllInquiries() {
  const inquiries = getAllInquiries();
  Logger.log('Total inquiries: ' + inquiries.length);
  Logger.log('First inquiry: ' + JSON.stringify(inquiries[0], null, 2));
}
