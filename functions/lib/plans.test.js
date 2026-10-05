const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const {
  PLANS,
  trial,
  entitlement,
  validateReservation,
  prepareRows,
  classificationFields,
  validSignature,
} = require("./plans");

test("trial ends after fourteen days; expired plans cannot reserve work", () => {
  const subscription = trial(1000);
  assert.equal(entitlement(subscription, 1001).active, true);
  const access = entitlement(subscription, subscription.periodEnd);
  assert.equal(access.active, false);
  assert.throws(() => validateReservation({}, access, 1, 1), {status: 402});
});

test("reservations count pending credits and active jobs", () => {
  const access = {active: true, limits: PLANS.trial};
  assert.throws(
      () => validateReservation({used: 40, reserved: 10}, access, 0, 1),
      {status: 429},
  );
  assert.throws(() => validateReservation({activeJobs: 1}, access, 0, 0, 1), {
    status: 409,
  });
  assert.throws(() => validateReservation({inquiries: 100}, access, 1, 0), {
    status: 429,
  });
  assert.deepEqual(validateReservation({}, access, 2, 1, 1), {
    inquiries: 2,
    used: 0,
    reserved: 1,
    activeJobs: 1,
  });
});

test("preview maps headers, skips empty messages, and identifies duplicate rows", () => {
  const rows = [
    {Message: "Hello", Email: "A@EXAMPLE.COM"},
    {Message: " Hello ", Email: "a@example.com"},
    {Message: ""},
  ];
  const result = prepareRows(rows, {message: "Message", email: "Email"});
  assert.equal(result.eligible.length, 1);
  assert.equal(result.duplicates, 1);
  assert.equal(result.skipped, 1);
  assert.equal(result.eligible[0].row, 2);
  assert.throws(() => prepareRows(rows, {}), {status: 400});
});

test("classification preserves zero and decimals and rejects invalid output", () => {
  assert.equal(classificationFields({fit_score: 0}).fit_score, "0");
  assert.equal(classificationFields({fit_score: 4.5}).fit_score, "4.5");
  assert.throws(() => classificationFields({}), {status: 502});
  assert.throws(() => classificationFields({summary: {unsafe: true}}), {
    status: 502,
  });
});

test("quality reports safe row references without deleting warning rows", () => {
  const result = prepareRows([
    {_rowIndex: 12, Message: "First", Email: "bad-address"},
    {_rowIndex: 13, Message: "Second"},
    {_rowIndex: 14, Message: ""},
    {_rowIndex: 15, Message: "First", Email: "bad-address"},
  ], {message: "Message", email: "Email"});
  assert.equal(result.eligible.length, 2);
  assert.deepEqual(result.quality, {invalidEmails: 1, missingContacts: 1});
  assert.deepEqual(result.issues.map((issue) => [issue.row, issue.reason]), [
    [12, "email_format"], [13, "missing_email"],
    [14, "missing_message"], [15, "duplicate_in_source"],
  ]);
  assert.equal(JSON.stringify(result.issues).includes("bad-address"), false);
  assert.throws(() => prepareRows([{Message: "Hello"}], {
    message: "Message", name: "Message",
  }), {status: 400});
});

test("billing signatures authenticate the exact raw body", () => {
  const raw = Buffer.from("{\"event\":\"subscription.charged\"}");
  const signature = crypto
      .createHmac("sha256", "test-secret")
      .update(raw)
      .digest("hex");
  assert.equal(validSignature(raw, signature, "test-secret"), true);
  assert.equal(
      validSignature(Buffer.from("different"), signature, "test-secret"),
      false,
  );
  assert.equal(validSignature(raw, "bad", "test-secret"), false);
});
