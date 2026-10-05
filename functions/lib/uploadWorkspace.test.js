const {test} = require("node:test");
const assert = require("node:assert/strict");
const {readUpload} = require("./uploadWorkspace");

function csvRequest(text) {
  const boundary = "nodalx-test-boundary";
  const body = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="inquiries.csv"\r\nContent-Type: text/csv\r\n\r\n${text}\r\n--${boundary}--\r\n`;
  return {
    headers: {"content-type": `multipart/form-data; boundary=${boundary}`},
    rawBody: Buffer.from(body),
  };
}

test("CSV import preserves headings and data rows", async () => {
  const data = await readUpload(
      csvRequest("Name,Message\r\nMira,Please call me\r\n"),
  );
  assert.deepEqual(data.headers, ["Name", "Message"]);
  assert.equal(data.rows[0].Message, "Please call me");
});

test("CSV import rejects ambiguous or empty column headings", async () => {
  await assert.rejects(
      readUpload(csvRequest("Message,Message\r\none,two\r\n")),
      {status: 400},
  );
  await assert.rejects(readUpload(csvRequest("Name,\r\nMira,Hello\r\n")), {
    status: 400,
  });
});

test("Excel import uses normalized headings without losing mapped values", async () => {
  const XLSX = require("xlsx");
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    [" Name ", " Message "], [], ["Mira", "Original request"],
  ]), "Inquiries");
  const boundary = "nodalx-excel-test";
  const rawBody = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="inquiries.xlsx"\r\nContent-Type: application/octet-stream\r\n\r\n`),
    XLSX.write(workbook, {type: "buffer", bookType: "xlsx"}),
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  const data = await readUpload({headers: {"content-type": `multipart/form-data; boundary=${boundary}`}, rawBody});
  assert.deepEqual(data.headers, ["Name", "Message"]);
  assert.equal(data.rows[0].Message, "Original request");
  assert.equal(data.rows[0].Name, "Mira");
  assert.equal(data.rows[0]._rowIndex, 3);
});
