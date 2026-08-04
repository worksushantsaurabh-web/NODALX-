const {google} = require("googleapis");

let sheetsClient = null;
let authClient = null;

/** Get or create Google Sheets API client. */
async function getSheetsClient() {
  if (sheetsClient) return sheetsClient;

  authClient = new google.auth.GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  sheetsClient = google.sheets({version: "v4", auth: authClient});
  return sheetsClient;
}

/** Get the service account email for error reporting. */
async function getServiceAccountEmail() {
  try {
    const auth = new google.auth.GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const client = await auth.getClient();
    const email = client.email || client.credentials?.client_email;
    return email || "282855451102-compute@developer.gserviceaccount.com";
  } catch {
    return "282855451102-compute@developer.gserviceaccount.com";
  }
}

/**
 * Appends a row of data to the specified Google Sheet.
 * @param {string} spreadsheetId The spreadsheet ID.
 * @param {Object} data The row data to append.
 * @return {Promise<Object>} Success status.
 */
async function appendRow(spreadsheetId, data) {
  try {
    const sheets = await getSheetsClient();

    const row = [
      data.createdAt || new Date().toISOString(),
      data.name || "",
      data.email || "",
      data.company || "",
      data.message || "",
      data.intent || "",
      data.urgency || "",
      data.fit_score || "",
      data.category || "",
      data.summary || "",
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "Sheet1!A:J",
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [row],
      },
    });

    return {success: true};
  } catch (error) {
    console.error("[Google Sheets API Append Error]:", error.message);
    throw new Error("Failed to write to Google Sheet: " + error.message);
  }
}

/**
 * Verifies if the service account can read the specified Google Sheet.
 * @param {string} spreadsheetId The spreadsheet ID.
 * @return {Promise<Object>} Sheet metadata.
 */
async function verifyAccess(spreadsheetId) {
  try {
    const sheets = await getSheetsClient();
    const res = await sheets.spreadsheets.get({spreadsheetId});
    return {success: true, title: res.data.properties.title};
  } catch (error) {
    console.error("[Google Sheets API Verify Raw Error]:", error);
    const serviceEmail = await getServiceAccountEmail();
    const rawMsg = error.response?.data?.error?.message || error.message;
    const msg = `Google Sheets API Error: ${rawMsg}. Service Account: ${serviceEmail}`;
    throw new Error(msg);
  }
}

/**
 * Reads all rows from Sheet1.
 * @param {string} spreadsheetId The spreadsheet ID.
 * @return {Promise<Object>} Headers and rows from the sheet.
 */
async function readSheetRows(spreadsheetId) {
  try {
    const sheets = await getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Sheet1!A1:Z500",
    });

    const values = res.data.values || [];
    if (values.length === 0) return {headers: [], rows: []};

    const headers = values[0].map((h) => String(h || "").trim());
    const rawRows = values.slice(1);

    const rows = rawRows.map((row, index) => {
      const obj = {_rowIndex: index + 2};
      headers.forEach((h, i) => {
        obj[h] = row[i] || "";
      });
      return obj;
    });

    return {headers, rows, rawValues: values};
  } catch (error) {
    console.error("[Google Sheets Read Error]:", error.message);
    throw new Error("Failed to read Google Sheet rows: " + error.message);
  }
}

/**
 * Writes AI classification columns back to Google Sheet.
 * @param {string} spreadsheetId The spreadsheet ID.
 * @param {Array} classifications The classification results to write.
 * @return {Promise<Object>} Success status and row count.
 */
async function writeClassificationsToSheet(spreadsheetId, classifications) {
  try {
    const sheets = await getSheetsClient();

    const currentData = await readSheetRows(spreadsheetId);
    const headers = currentData.headers;

    const aiCols = ["AI_Intent", "AI_Urgency", "AI_Fit_Score", "AI_Summary"];
    const updatedHeaders = [...headers];

    aiCols.forEach((col) => {
      if (!updatedHeaders.includes(col)) {
        updatedHeaders.push(col);
      }
    });

    if (updatedHeaders.length > headers.length) {
      const colCount = Math.min(updatedHeaders.length, 26);
      const endCol = String.fromCharCode(64 + colCount);
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `Sheet1!A1:${endCol}1`,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [updatedHeaders],
        },
      });
    }

    const updateValues = classifications.map((c) => [
      c.intent || "",
      c.urgency || "",
      c.fit_score || "",
      c.summary || "",
    ]);

    const startColIndex = updatedHeaders.indexOf("AI_Intent");
    const startColLetter = String.fromCharCode(65 + startColIndex);
    const endColLetter = String.fromCharCode(65 + startColIndex + 3);
    const endRow = updateValues.length + 1;

    if (updateValues.length > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `Sheet1!${startColLetter}2:${endColLetter}${endRow}`,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: updateValues,
        },
      });
    }

    return {success: true, rowsUpdated: updateValues.length};
  } catch (error) {
    console.error("[Google Sheets Writeback Error]:", error.message);
    const msg = "Failed to write classifications back to Google Sheet: " + error.message;
    throw new Error(msg);
  }
}

module.exports = {
  appendRow,
  verifyAccess,
  readSheetRows,
  writeClassificationsToSheet,
  getServiceAccountEmail,
};
