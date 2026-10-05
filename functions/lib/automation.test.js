const {test} = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeRecords,
  diffRecords,
} = require("./automation");

const mapping = {name: "Name", email: "Email", company: "Company", message: "Message"};

test("normalizeRecords quarantines missing and duplicate IDs, never loses rows", () => {
  const rows = [
    {_rowIndex: 2, ID: "A-1", Name: "Anna", Email: "A@EXAMPLE.COM", Company: "Acme", Message: "Hi"},
    {_rowIndex: 3, ID: "", Name: "NoID", Email: "b@b.com", Company: "", Message: "Hello"},
    {_rowIndex: 4, ID: "A-2", Name: "Bob", Email: "b@b.com", Company: "BobCo", Message: "Hey"},
    {_rowIndex: 5, ID: "A-1", Name: "Dup", Email: "c@c.com", Company: "", Message: "Again"},
  ];
  const {records, invalid} = normalizeRecords(rows, mapping, "ID");
  assert.equal(records.length, 2);
  assert.equal(invalid.length, 2);
  assert.deepEqual(invalid, [
    {row: 3, kind: "missing_source_id"},
    {row: 5, kind: "duplicate_source_id"},
  ]);
  const first = records.find((entry) => entry.key === "A-1");
  assert.equal(first.record.message, "Hi");
  // Second A-1 was quarantined entirely — no state was overwritten downstream.
  assert.ok(!records.some((entry) => entry.record.message === "Again"));
});

test("normalizeRecords falls back to positional row numbers only for reporting, not identity", () => {
  const {records} = normalizeRecords(
      [{ID: "A-1", Message: "Hi"}],
      {message: "Message"},
      "ID",
  );
  assert.equal(records[0].key, "A-1");
  assert.equal(records[0].rowNumber, 2);
  assert.equal(records[0].record.sourceKey, "A-1");
});

test("contentHash changes when any mapped field changes", () => {
  const one = normalizeRecords([{_rowIndex: 2, ID: "A", Message: "Hi", Email: "A@X.COM"}], mapping, "ID");
  const two = normalizeRecords([{_rowIndex: 2, ID: "A", Message: "Hi", Email: "a@x.com"}], mapping, "ID");
  assert.equal(one.records[0].contentHash, two.records[0].contentHash);
  const three = normalizeRecords([{_rowIndex: 2, ID: "A", Message: "Edit", Email: "a@x.com"}], mapping, "ID");
  assert.notEqual(one.records[0].contentHash, three.records[0].contentHash);
});

test("diffRecords separates added, changed and unchanged records", () => {
  const rows = [
    {_rowIndex: 2, ID: "A-1", Message: "Original"},
    {_rowIndex: 3, ID: "A-2", Message: "Edited"},
    {_rowIndex: 4, ID: "A-3", Message: "New"},
  ];
  const {records} = normalizeRecords(rows, {message: "Message"}, "ID");
  const known = new Map([
    ["A-1", {contentHash: records.find((entry) => entry.key === "A-1").contentHash, state: "imported"}],
    ["A-2", {contentHash: "oldhash", state: "imported", inquiryId: "inquiry-9"}],
  ]);
  const {added, changed, unchanged} = diffRecords(records, known);
  assert.deepEqual(added.map((entry) => entry.key), ["A-3"]);
  assert.equal(changed.length, 1);
  assert.equal(changed[0].key, "A-2");
  assert.equal(changed[0].previous.inquiryId, "inquiry-9");
  assert.equal(unchanged.length, 1);
});
