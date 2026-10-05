const busboy = require("busboy");
const XLSX = require("xlsx");
const {parse} = require("csv-parse/sync");
const {fail} = require("./plans");

async function readUpload(req) {
  const file = await new Promise((resolve, reject) => {
    let parser;
    try {
      parser = busboy({
        headers: req.headers,
        limits: {fileSize: 4 * 1024 * 1024, files: 1, fields: 0, parts: 1},
      });
    } catch {
      reject(fail(400, "Choose a CSV, TSV, or Excel file."));
      return;
    }
    let name = "";
    let truncated = false;
    const chunks = [];
    parser.on("file", (field, stream, info) => {
      name = info.filename || "";
      stream.on("data", (chunk) => chunks.push(chunk));
      stream.on("limit", () => {
        truncated = true;
      });
      stream.on("error", reject);
    });
    parser.on("error", reject);
    parser.on("finish", () =>
      truncated ?
        reject(fail(413, "Files must be 4 MB or smaller.")) :
        resolve({name, buffer: Buffer.concat(chunks)}),
    );
    if (req.rawBody) parser.end(req.rawBody);
    else req.pipe(parser);
  });
  if (!file.buffer.length) throw fail(400, "The file is empty.");
  let rows;
  if (/\.(csv|tsv)$/i.test(file.name)) {
    rows = parse(file.buffer, {
      columns: (headings) => {
        const names = headings.map((name) => name.trim());
        if (
          names.some((name) => !name) ||
          new Set(names).size !== names.length
        ) {
          throw fail(
              400,
              "Column headings must be present and unique. Rename duplicate or empty headings and retry.",
          );
        }
        return names;
      },
      skip_empty_lines: true,
      bom: true,
      trim: true,
      delimiter: /\.tsv$/i.test(file.name) ? "\t" : ",",
      to: 10001,
    });
  } else if (/\.(xlsx|xls)$/i.test(file.name)) {
    const workbook = XLSX.read(file.buffer, {
      type: "buffer",
      sheetRows: 10002,
    });
    const headings =
      XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], {
        header: 1,
        sheetRows: 1,
      })[0] || [];
    const names = headings.map((name) => String(name).trim());
    if (names.some((name) => !name) || new Set(names).size !== names.length) {
      throw fail(
          400,
          "Column headings must be present and unique. Rename duplicate or empty headings and retry.",
      );
    }
    rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], {
      header: names,
      range: 1,
      blankrows: false,
      defval: "",
      raw: false,
    }).map((record) => ({...record, _rowIndex: record.__rowNum__ + 1}));
  } else throw fail(400, "Choose a CSV, TSV, XLSX, or XLS file.");
  if (!rows.length || rows.length > 10000) {
    throw fail(400, "Files must contain between 1 and 10,000 data rows.");
  }
  if (JSON.stringify(rows).length > 600000) {
    throw fail(
        413,
        "This file contains too much text for a preview. Split it into smaller files.",
    );
  }
  return {
    title: file.name.slice(0, 180),
    headers: Object.keys(rows[0]).filter((header) => header !== "_rowIndex"),
    rows,
    snapshot: require("./plans").fingerprint(rows),
    hasMore: false,
  };
}

module.exports = {readUpload};
