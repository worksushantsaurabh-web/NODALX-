const sheets = require("./googleSheets");
const {fail, fingerprint} = require("./plans");

function rangeTitle(title) {
  return `'${String(title).replaceAll("'", "''")}'`;
}

async function inspect(spreadsheetId) {
  const client = await sheets.getSheetsClient();
  const response = await client.spreadsheets.get({
    spreadsheetId,
    fields: "spreadsheetId,properties(title),sheets(properties)",
  });
  return {
    title: response.data.properties.title,
    tabs: response.data.sheets.map((sheet) => ({
      id: sheet.properties.sheetId,
      title: sheet.properties.title,
    })),
  };
}

async function proveAccess(spreadsheetId, token) {
  const client = await sheets.getSheetsClient();
  const response = await client.spreadsheets.values.get({
    spreadsheetId,
    range: "'NodalX Verify'!A1",
  });
  if (response.data.values?.[0]?.[0] !== token) {
    throw fail(
        403,
        "Put the verification code in cell A1 of a tab named NodalX Verify, then retry.",
    );
  }
  return inspect(spreadsheetId);
}

async function read(spreadsheetId, tabId) {
  const metadata = await inspect(spreadsheetId);
  const tab = metadata.tabs.find((item) => item.id === Number(tabId));
  if (!tab) throw fail(400, "Select an existing sheet tab.");
  const client = await sheets.getSheetsClient();
  const response = await client.spreadsheets.values.get({
    spreadsheetId,
    range: `${rangeTitle(tab.title)}!A1:CV1002`,
  });
  const values = response.data.values || [];
  const headers = (values[0] || []).map((header) => String(header).trim());
  const nonEmpty = headers.filter(Boolean);
  if (!nonEmpty.length) {
    throw fail(400, "The selected tab needs column headings in row 1.");
  }
  if (new Set(nonEmpty).size !== nonEmpty.length) {
    throw fail(
        400,
        "Column headings must be unique. Rename duplicate headings and retry.",
    );
  }
  const rows = values.slice(1, 1001).map((values, index) => {
    const row = {_rowIndex: index + 2};
    headers.forEach((header, column) => {
      if (header) row[header] = values[column] ?? "";
    });
    return row;
  });
  return {
    headers: nonEmpty,
    rows,
    title: `${metadata.title} / ${tab.title}`,
    hasMore: values.length > 1001,
    snapshot: fingerprint(values),
  };
}

async function exportResults(spreadsheetId, jobId, rows) {
  const client = await sheets.getSheetsClient();
  const title = `NodalX ${jobId.slice(0, 16)}`;
  const metadata = await inspect(spreadsheetId);
  if (!metadata.tabs.some((tab) => tab.title === title)) {
    try {
      await client.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {requests: [{addSheet: {properties: {title}}}]},
      });
    } catch (error) {
      const refreshed = await inspect(spreadsheetId);
      if (!refreshed.tabs.some((tab) => tab.title === title)) throw error;
    }
  }
  const fields = [
    "row",
    "name",
    "email",
    "company",
    "message",
    "intent",
    "urgency",
    "fit_score",
    "summary",
    "suggested_action",
    "status",
    "error",
  ];
  await client.spreadsheets.values.update({
    spreadsheetId,
    range: `${rangeTitle(title)}!A1`,
    valueInputOption: "RAW",
    requestBody: {
      values: [
        fields,
        ...rows.map((row) => fields.map((field) => row[field] ?? "")),
      ],
    },
  });
  return {
    title,
    url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
  };
}

module.exports = {read, inspect, proveAccess, exportResults, rangeTitle};
