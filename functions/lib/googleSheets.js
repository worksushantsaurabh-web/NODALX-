const {google} = require("googleapis");

let sheetsClient = null;
let authClient = null;

/**
 * Extracts the spreadsheet ID from a full Google Sheets URL or returns the ID as-is.
 * Supports URLs like:
 *   - https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
 *   - https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit#gid=0
 *   - https://docs.google.com/spreadsheets/d/SPREADSHEET_ID
 * @param {string} input The spreadsheet ID or full URL.
 * @return {string} The extracted spreadsheet ID.
 */
function extractSpreadsheetId(input) {
  if (!input || typeof input !== "string") {
    throw new Error("Spreadsheet ID is required and must be a non-empty string.");
  }

  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Spreadsheet ID is required and must be a non-empty string.");
  }

  const urlPattern = /^https?:\/\/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/;
  const match = trimmed.match(urlPattern);
  if (match) {
    return match[1];
  }

  if (/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    return trimmed;
  }

  throw new Error(
      `Invalid spreadsheet ID format: "${trimmed}". ` +
      "Provide a valid spreadsheet ID or a full Google Sheets URL.",
  );
}

/** Get or create Google Sheets API client. */
async function getSheetsClient() {
  if (sheetsClient) return sheetsClient;

  try {
    authClient = new google.auth.GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    sheetsClient = google.sheets({version: "v4", auth: authClient});
    return sheetsClient;
  } catch (error) {
    throw new Error(
        "Failed to initialize Google Sheets client. " +
        "Ensure GOOGLE_APPLICATION_CREDENTIALS is set or running in a GCP environment. " +
        `Details: ${error.message}`,
    );
  }
}

/** Get the service account email for error reporting. */
async function getServiceAccountEmail() {
  try {
    const auth = new google.auth.GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const credentials = await auth.getCredentials();
    if (!credentials.client_email) throw new Error("Service account email unavailable");
    return credentials.client_email;
  } catch (error) {
    throw new Error(`Unable to identify the Google Sheets service account: ${error.message}`);
  }
}

/**
 * Appends a row of data to the specified Google Sheet.
 * @param {string} spreadsheetId The spreadsheet ID or full URL.
 * @param {Object} data The row data to append.
 * @return {Promise<Object>} Success status.
 */
async function appendRow(spreadsheetId, data) {
  const sheetId = extractSpreadsheetId(spreadsheetId);

  const sheets = await getSheetsClient();

  const row = [
    data.createdAt || new Date().toISOString(),
    data.name || "",
    data.email || "",
    data.company || "",
    data.message || "",
    data.intent || "",
    data.urgency || "",
    data.fit_score ?? "",
    data.category || "",
    data.summary || "",
  ];

  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: "Sheet1!A:J",
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [row],
      },
    });

    return {success: true};
  } catch (error) {
    console.error("[Google Sheets API Append Error]:", error.message);
    const serviceEmail = await getServiceAccountEmail();
    const statusCode = error.response?.status || error.code;

    if (statusCode === 403 || error.message?.includes("permission")) {
      throw new Error(
          `Permission denied: The service account (${serviceEmail}) does not have write access to this spreadsheet. ` +
          "Please share the spreadsheet with the service account email.",
      );
    }
    if (statusCode === 404) {
      throw new Error(
          `Spreadsheet not found: The spreadsheet ID "${sheetId}" does not exist or is not accessible.`,
      );
    }

    throw new Error(`Failed to append row to Google Sheet: ${error.message}`);
  }
}

/**
 * Verifies if the service account can read the specified Google Sheet.
 * @param {string} spreadsheetId The spreadsheet ID or full URL.
 * @return {Promise<Object>} Sheet metadata.
 */
async function verifyAccess(spreadsheetId) {
  const sheetId = extractSpreadsheetId(spreadsheetId);

  const sheets = await getSheetsClient();

  try {
    const res = await sheets.spreadsheets.get({spreadsheetId: sheetId});
    return {success: true, title: res.data.properties.title, spreadsheetId: sheetId};
  } catch (error) {
    console.error("[Google Sheets API Verify Raw Error]:", error);
    const serviceEmail = await getServiceAccountEmail();
    const statusCode = error.response?.status || error.code;
    const rawMsg = error.response?.data?.error?.message || error.message;

    if (statusCode === 403 || rawMsg?.includes("permission")) {
      throw new Error(
          `Permission denied: The service account (${serviceEmail}) does not have access to this spreadsheet. ` +
          "Please share the spreadsheet with the service account email and grant at least Viewer access.",
      );
    }
    if (statusCode === 404) {
      throw new Error(
          `Spreadsheet not found: The spreadsheet ID "${sheetId}" does not exist. ` +
          "Please verify the URL or ID is correct.",
      );
    }

    throw new Error(
        `Google Sheets API Error: ${rawMsg}. Service Account: ${serviceEmail}`,
    );
  }
}

/**
 * Reads all rows from Sheet1.
 * @param {string} spreadsheetId The spreadsheet ID or full URL.
 * @return {Promise<Object>} Headers and rows from the sheet.
 */
async function readSheetRows(spreadsheetId) {
  const sheetId = extractSpreadsheetId(spreadsheetId);

  const sheets = await getSheetsClient();

  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: "Sheet1!1:500",
    });

    const values = res.data.values || [];

    if (values.length === 0) {
      return {headers: [], rows: [], rawValues: [], isEmpty: true};
    }

    const headers = values[0].map((h) => String(h || "").trim());

    if (headers.length === 0 || headers.every((h) => h === "")) {
      return {headers: [], rows: [], rawValues: values, isEmpty: true, hasEmptyHeaders: true};
    }

    const rawRows = values.slice(1);

    const rows = rawRows.map((row, index) => {
      const obj = {_rowIndex: index + 2};
      headers.forEach((h, i) => {
        if (h) {
          obj[h] = row[i] !== undefined ? row[i] : "";
        }
      });
      return obj;
    });

    return {headers, rows, rawValues: values, isEmpty: false};
  } catch (error) {
    console.error("[Google Sheets Read Error]:", error.message);
    const serviceEmail = await getServiceAccountEmail();
    const statusCode = error.response?.status || error.code;

    if (statusCode === 403 || error.message?.includes("permission")) {
      throw new Error(
          `Permission denied: The service account (${serviceEmail}) does not have read access to this spreadsheet. ` +
          "Please share the spreadsheet with the service account email.",
      );
    }
    if (statusCode === 404) {
      throw new Error(
          `Spreadsheet not found: The spreadsheet ID "${sheetId}" does not exist or is not accessible.`,
      );
    }
    if (error.message?.includes("Unable to parse range")) {
      throw new Error(
          "Sheet1 not found in this spreadsheet. Please ensure the sheet is named 'Sheet1' or rename the first sheet.",
      );
    }

    throw new Error(`Failed to read Google Sheet rows: ${error.message}`);
  }
}

/**
 * Writes AI classification columns back to Google Sheet.
 * @param {string} spreadsheetId The spreadsheet ID or full URL.
 * @param {Array} classifications The classification results to write.
 * @return {Promise<Object>} Success status and row count.
 */
async function writeClassificationsToSheet(spreadsheetId, classifications) {
  const sheetId = extractSpreadsheetId(spreadsheetId);

  if (!Array.isArray(classifications)) {
    throw new Error("Classifications must be an array.");
  }

  if (classifications.length === 0) {
    return {success: true, rowsUpdated: 0, message: "No classifications to write."};
  }

  const sheets = await getSheetsClient();

  try {
    const currentData = await readSheetRows(sheetId);
    const headers = currentData.headers;

    if (currentData.isEmpty || headers.length === 0) {
      throw new Error("Sheet1 must contain a header row before analysis.");
    }

    const aiCols = ["AI_Intent", "AI_Urgency", "AI_Fit_Score", "AI_Summary"];
    const updatedHeaders = [...headers];

    aiCols.forEach((col) => {
      if (!updatedHeaders.includes(col)) {
        updatedHeaders.push(col);
      }
    });

    const columnName = (index) => {
      let value = index + 1;
      let name = "";
      while (value > 0) {
        value--;
        name = String.fromCharCode(65 + value % 26) + name;
        value = Math.floor(value / 26);
      }
      return name;
    };

    if (updatedHeaders.length > headers.length) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `Sheet1!A1:${columnName(updatedHeaders.length - 1)}1`,
        valueInputOption: "RAW",
        requestBody: {
          values: [updatedHeaders],
        },
      });
    }

    const fields = ["intent", "urgency", "fit_score", "summary"];
    const endRow = classifications.length + 1;
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: {
        valueInputOption: "RAW",
        data: aiCols.map((column, index) => {
          const columnLetter = columnName(updatedHeaders.indexOf(column));
          return {
            range: `Sheet1!${columnLetter}2:${columnLetter}${endRow}`,
            values: classifications.map((classification) => [classification[fields[index]] ?? ""]),
          };
        }),
      },
    });

    return {success: true, rowsUpdated: classifications.length};
  } catch (error) {
    if (error.message?.includes("Permission denied") ||
        error.message?.includes("Spreadsheet not found") ||
        error.message?.includes("Classifications must be")) {
      throw error;
    }

    console.error("[Google Sheets Writeback Error]:", error.message);
    const serviceEmail = await getServiceAccountEmail();
    const statusCode = error.response?.status || error.code;

    if (statusCode === 403 || error.message?.includes("permission")) {
      throw new Error(
          `Permission denied: The service account (${serviceEmail}) does not have write access to this spreadsheet. ` +
          "Please share the spreadsheet with the service account email and grant Editor access.",
      );
    }

    throw new Error(`Failed to write classifications to Google Sheet: ${error.message}`);
  }
}

module.exports = {
  appendRow,
  verifyAccess,
  readSheetRows,
  writeClassificationsToSheet,
  getServiceAccountEmail,
  extractSpreadsheetId,
};
