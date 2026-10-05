const {test} = require("node:test");
const assert = require("node:assert/strict");
const {
  FREQUENCIES_MIN,
  isValidTimeZone,
  budgetDay,
  assertMapping,
  assertSourceIdColumn,
  assertRowCap,
  assertDailyCreditCap,
  assertFrequency,
  assertInitialPolicy,
  assertMode,
  assertTimeZone,
  assertName,
  approvalKey,
  schemaFingerprint,
} = require("./recipes");

const limits = {batchRows: 100, credits: 500};

test("budgetDay uses the recipe timezone, not the host zone", () => {
  // 2026-03-09 03:30 UTC: UTC says Mar 9, but New York (UTC-4 after the
  // March 8 spring-forward) is still Mar 8 23:30 local. Same instant, two
  // different budget days — exactly the boundary a fixed timezone protects.
  const instant = Date.UTC(2026, 2, 9, 3, 30);
  assert.equal(budgetDay(instant, "UTC"), "2026-03-09");
  assert.equal(budgetDay(instant, "America/New_York"), "2026-03-08");
  assert.equal(budgetDay(instant, "Asia/Kolkata"), "2026-03-09");
});

test("budgetDay is correct across a DST spring-forward boundary", () => {
  // US DST spring forward: 2026-03-08 02:00 local becomes 03:00.
  const before = Date.UTC(2026, 2, 8, 6, 59, 0); // 01:59 EST
  const after = Date.UTC(2026, 2, 8, 7, 1, 0); // 03:01 EDT
  assert.equal(budgetDay(before, "America/New_York"), "2026-03-08");
  assert.equal(budgetDay(after, "America/New_York"), "2026-03-08");
  // One minute later in UTC crosses midnight local -> next budget day.
  const next = Date.UTC(2026, 2, 9, 4, 1, 0); // 00:01 EDT Mar 9
  assert.equal(budgetDay(next, "America/New_York"), "2026-03-09");
});

test("budgetDay handles Asia/Kolkata's non-hour offset", () => {
  const nearMidnightUtc = Date.UTC(2026, 0, 1, 18, 30); // midnight IST
  assert.equal(budgetDay(nearMidnightUtc, "Asia/Kolkata"), "2026-01-02");
  assert.equal(budgetDay(nearMidnightUtc, "UTC"), "2026-01-01");
});

test("timezones accept IANA names and reject junk and injection characters", () => {
  assert.ok(isValidTimeZone("UTC"));
  assert.ok(isValidTimeZone("America/New_York"));
  assert.ok(isValidTimeZone("Asia/Kolkata"));
  assert.equal(isValidTimeZone("Mars/Olympus_Mons"), false);
  assert.equal(isValidTimeZone("../../etc/passwd"), false);
  assert.equal(isValidTimeZone(""), false);
  assert.equal(isValidTimeZone(123), false);
});

test("assertMapping enforces message mapping, known headers and single-use columns", () => {
  const headers = ["Name", "Email", "Company", "Message", "ID"];
  const ok = assertMapping(
      {name: "Name", email: "Email", company: "Company", message: "Message"},
      headers,
  );
  assert.deepEqual(ok, {name: "Name", email: "Email", company: "Company", message: "Message"});
  assert.throws(() => assertMapping({message: "Nope"}, headers), /message/i);
  assert.throws(() => assertMapping({}, headers), /message/i);
  assert.throws(() => assertMapping({name: "Message", message: "AlsoMissing"}, headers), /source/i);
  assert.throws(
      () => assertMapping({name: "Message", message: "Message"}, headers),
      /only one field/i,
  );
  // Unknown server-side field names are rejected outright.
  assert.throws(
      () => assertMapping({message: "Message", evil: "Name"}, headers),
      /Unknown mapping field/i,
  );
});

test("empty optional fields can be omitted from the mapping", () => {
  const headers = ["Message", "Email"];
  assert.deepEqual(assertMapping({message: "Message", email: "Email", name: ""}, headers), {
    message: "Message",
    email: "Email",
  });
});

test("assertSourceIdColumn demands an existing header and exists as a header", () => {
  const headers = ["Message", "Order ID"];
  assert.equal(assertSourceIdColumn("Order ID", headers), "Order ID");
  assert.throws(() => assertSourceIdColumn("row", headers), /stable record-ID/i);
  assert.throws(() => assertSourceIdColumn("", headers), /stable record-ID/i);
});

test("row and credit caps are bounded by the plan and hard ceilings", () => {
  assert.equal(assertRowCap(50, limits), 50);
  assert.throws(() => assertRowCap(101, limits), /plan/i); // over batchRows
  assert.throws(() => assertRowCap(0, limits), /plan/i);
  assert.throws(() => assertRowCap("lots", limits), /plan/i);
  assert.equal(assertDailyCreditCap(0, limits), 0);
  assert.equal(assertDailyCreditCap(500, limits), 500);
  assert.throws(() => assertDailyCreditCap(501, limits), /budget/i);
  assert.throws(() => assertDailyCreditCap(-1, limits), /budget/i);
});

test("enum validations reject out-of-band values", () => {
  assert.equal(assertFrequency(15), 15);
  assert.throws(() => assertFrequency(7), /Frequency/);
  assert.equal(assertMode("import"), "import");
  assert.throws(() => assertMode("delete-everything"), /import only/i);
  assert.equal(assertInitialPolicy("baseline"), "baseline");
  assert.throws(() => assertInitialPolicy("surprise"), /future additions/i);
  assert.equal(assertTimeZone("UTC"), "UTC");
  assert.throws(() => assertTimeZone("nowhere"), /valid timezone/i);
  assert.throws(() => assertName("   "), /name/i);
  assert.throws(() => assertName("x".repeat(200)), /names/i);
  assert.ok(FREQUENCIES_MIN.every((f) => typeof f === "number"));
});

test("approval key changes when identity columns move but not on budget edits", () => {
  const base = {
    spreadsheetId: "sheet1",
    tabId: 0,
    mapping: {message: "Message"},
    sourceIdColumn: "Order ID",
    headersHash: schemaFingerprint(["Message", "Order ID"]),
    dailyCreditCap: 10,
  };
  const before = approvalKey(base);
  // Editing the daily budget alone must NOT invalidate approval.
  assert.equal(approvalKey({...base, dailyCreditCap: 5, name: "Renamed"}), before);
  // Changing identity-adjacent fields MUST invalidate approval.
  assert.notEqual(approvalKey({...base, sourceIdColumn: "Row"}), before);
  assert.notEqual(approvalKey({...base, mapping: {message: "Body"}}), before);
  assert.notEqual(approvalKey({...base, tabId: 3}), before);
  assert.notEqual(
      approvalKey({...base, headersHash: schemaFingerprint(["Different"])}),
      before,
  );
});

test("schemaFingerprint varies with header set and schema version", () => {
  assert.notEqual(
      schemaFingerprint(["A", "B"]),
      schemaFingerprint(["B", "A"]),
  );
  assert.equal(
      schemaFingerprint(["A", "B"]),
      schemaFingerprint(["A", "B"]),
  );
});
