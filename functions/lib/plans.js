const crypto = require("node:crypto");

const PLANS = Object.freeze({
  trial: {
    label: "Trial",
    inquiries: 100,
    credits: 50,
    sheets: 1,
    batchRows: 25,
    concurrentJobs: 1,
  },
  starter: {
    label: "Starter",
    inquiries: 2000,
    credits: 500,
    sheets: 1,
    batchRows: 100,
    concurrentJobs: 1,
  },
  growth: {
    label: "Growth",
    inquiries: 10000,
    credits: 2000,
    sheets: 3,
    batchRows: 500,
    concurrentJobs: 2,
  },
});

function fail(status, message) {
  return Object.assign(new Error(message), {status});
}

function entitlement(subscription, now = Date.now()) {
  const plan = PLANS[subscription.plan] ? subscription.plan : "trial";
  const active =
    ["trialing", "active", "legacy"].includes(subscription.status) &&
    Number(subscription.periodEnd) > now &&
    Number(subscription.periodStart) <= now;
  const period = plan === "trial" ? "trial" : String(subscription.periodStart);
  return {
    plan,
    limits: PLANS[plan],
    active,
    period,
    status: active ? subscription.status : "expired",
  };
}

function trial(now = Date.now()) {
  return {
    plan: "trial",
    status: "trialing",
    periodStart: now,
    periodEnd: now + 14 * 86400000,
  };
}

function validateReservation(current, access, inquiries, credits, jobs = 0) {
  if (!access.active) {
    throw fail(
        402,
        "Your plan has expired. Existing records remain available to review and export.",
    );
  }
  const used = {
    inquiries: 0,
    used: 0,
    reserved: 0,
    activeJobs: 0,
    ...current,
  };
  if (used.inquiries + inquiries > access.limits.inquiries) {
    throw fail(429, "The inquiry allowance is full for this period.");
  }
  if (used.used + used.reserved + credits > access.limits.credits) {
    throw fail(
        429,
        "Not enough analysis credits. Reduce the batch size or change your plan.",
    );
  }
  if (used.activeJobs + jobs > access.limits.concurrentJobs) {
    throw fail(
        409,
        "Your processing slots are busy. Wait for the current job to finish.",
    );
  }
  return {
    ...used,
    inquiries: used.inquiries + inquiries,
    reserved: used.reserved + credits,
    activeJobs: used.activeJobs + jobs,
  };
}

function fingerprint(value) {
  return crypto
      .createHash("sha256")
      .update(JSON.stringify(value))
      .digest("hex");
}

function prepareRows(rows, mapping) {
  if (!mapping || typeof mapping.message !== "string" || !mapping.message) {
    throw fail(400, "Map the message column before importing.");
  }
  const seen = new Set();
  const selected = Object.values(mapping).filter(Boolean);
  if (selected.some((header) => typeof header !== "string") ||
      new Set(selected).size !== selected.length) {
    throw fail(400, "Map each source column to only one field.");
  }
  let skipped = 0;
  let duplicates = 0;
  let invalidEmails = 0;
  let missingContacts = 0;
  const issues = [];
  const eligible = [];
  rows.forEach((row, index) => {
    const record = {};
    for (const field of ["name", "email", "company", "message"]) {
      record[field] = String(row[mapping[field]] ?? "").trim();
    }
    record.email = record.email.toLowerCase();
    const rowNumber = Number.isSafeInteger(row._rowIndex) && row._rowIndex >= 2 ? row._rowIndex : index + 2;
    if (!record.message) {
      skipped++;
      issues.push({row: rowNumber, reason: "missing_message", action: "Add a message in the source and preview again."});
      return;
    }
    if (
      record.message.length > 12000 ||
      Object.values(record).some((value) => value.length > 16000)
    ) {
      throw fail(
          400,
          `Row ${index + 2} is too long. Shorten it before importing.`,
      );
    }
    const key = fingerprint(record);
    if (seen.has(key)) {
      duplicates++;
      issues.push({row: rowNumber, reason: "duplicate_in_source", action: "Exact mapped duplicate; only its first occurrence is eligible."});
      return;
    }
    if (record.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.email)) {
      invalidEmails++;
      issues.push({row: rowNumber, reason: "email_format", action: "Check the email format. This warning does not block import or verify deliverability."});
    }
    if (!record.email) {
      missingContacts++;
      issues.push({row: rowNumber, reason: "missing_email", action: "No email mapped or provided; add contact details before email follow-up."});
    }
    seen.add(key);
    eligible.push({
      ...record,
      fingerprint: key,
      row: rowNumber,
    });
  });
  return {eligible, skipped, duplicates, quality: {invalidEmails, missingContacts}, issues};
}

function classificationFields(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw fail(502, "The workflow returned no valid classification.");
  }
  const result = {};
  for (const field of [
    "intent",
    "urgency",
    "category",
    "summary",
    "suggested_action",
  ]) {
    if (value[field] != null && typeof value[field] !== "string") {
      throw fail(502, `Invalid classification field: ${field}.`);
    }
    result[field] = (value[field] || "").slice(0, 12000);
  }
  const score = value.fit_score;
  result.fit_score =
    (typeof score === "number" && Number.isFinite(score)) ||
    typeof score === "string" ?
      String(score).slice(0, 100) :
      "";
  if (!Object.values(result).some(Boolean)) {
    throw fail(502, "The workflow returned an empty classification.");
  }
  return result;
}

function validSignature(raw, signature, secret) {
  if (
    !Buffer.isBuffer(raw) ||
    !secret ||
    typeof signature !== "string" ||
    !/^[a-f0-9]{64}$/i.test(signature)
  ) {
    return false;
  }
  const expected = crypto.createHmac("sha256", secret).update(raw).digest();
  return crypto.timingSafeEqual(expected, Buffer.from(signature, "hex"));
}

module.exports = {
  PLANS,
  fail,
  entitlement,
  trial,
  validateReservation,
  fingerprint,
  prepareRows,
  classificationFields,
  validSignature,
};
