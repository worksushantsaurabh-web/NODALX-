// Pure validation helpers for persistent import recipes. No Firestore here so
// the rules stay unit-testable without emulators. The Firestore-backed service
// that uses these is importRecipes.js.
const {fail, fingerprint} = require("./plans");

const SCHEMA_VERSION = 1;
const FREQUENCIES_MIN = Object.freeze([15, 30, 60, 360, 720, 1440]);
const MODES = Object.freeze(["import", "analyze"]);
const INITIAL_POLICIES = Object.freeze(["backlog", "baseline"]);
const MAX_RECIPE_NAME = 120;
const MAX_ROW_CAP = 1000; // hard ceiling even for the largest plan batch
const MAX_DAILY_CREDIT_CAP = 5000;

// Validate an IANA timezone. Deterministic day boundaries are required so an
// automation budget resets on an explicit, documented boundary, never on the
// host's incidental timezone.
function isValidTimeZone(zone) {
  if (typeof zone !== "string" || !/^[A-Za-z0-9_+/-]{2,64}$/.test(zone)) {
    return false;
  }
  try {
    new Intl.DateTimeFormat("en-US", {timeZone: zone});
  } catch {
    return false;
  }
  return true;
}

// YYYY-MM-DD in the recipe's fixed budget timezone. Falls back is impossible:
// an invalid zone is rejected at write time, so an invalid zone never reaches
// this function during a run.
function budgetDay(now, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(now));
  const get = (type) => parts.find((part) => part.type === type).value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function assertName(value) {
  if (typeof value !== "string") throw fail(400, "A recipe name is required.");
  const name = value.trim();
  if (!name || name.length > MAX_RECIPE_NAME) {
    throw fail(400, `Recipe names are at most ${MAX_RECIPE_NAME} characters.`);
  }
  return name;
}

function assertFrequency(value) {
  const minutes = Number(value);
  if (!FREQUENCIES_MIN.includes(minutes)) {
    throw fail(
        400,
        `Frequency must be one of ${FREQUENCIES_MIN.join(", ")} minutes. Polling is approximate, not a real-time guarantee.`,
    );
  }
  return minutes;
}

function assertMode(value) {
  if (!MODES.includes(value)) {
    throw fail(400, "Choose import only or import and analyze.");
  }
  return value;
}

function assertInitialPolicy(value) {
  if (!INITIAL_POLICIES.includes(value)) {
    throw fail(
        400,
        "Choose whether to import existing rows or only future additions.",
    );
  }
  return value;
}

function assertRowCap(value, limits) {
  const cap = Number(value);
  const ceiling = Math.min(MAX_ROW_CAP, limits.batchRows);
  if (!Number.isInteger(cap) || cap < 1 || cap > ceiling) {
    throw fail(
        400,
        `Each run can process between 1 and ${ceiling} rows on your plan.`,
    );
  }
  return cap;
}

// A zero credit cap means the recipe may never run analysis automatically.
// For analyze mode, a cap of zero disables analysis without upgrading plans.
function assertDailyCreditCap(value, limits) {
  const cap = Number(value);
  const ceiling = Math.min(MAX_DAILY_CREDIT_CAP, limits.credits);
  if (!Number.isInteger(cap) || cap < 0 || cap > ceiling) {
    throw fail(
        400,
        `Set a daily analysis budget between 0 and ${ceiling} credits.`,
    );
  }
  return cap;
}

// mapping is {name,email,company,message} -> source header. Only message is
// required. Every mapped header must exist in the source's declared headers,
// and one source header may only be mapped once.
function assertMapping(mapping, headers) {
  if (!mapping || typeof mapping !== "object" || Array.isArray(mapping)) {
    throw fail(400, "A column mapping is required.");
  }
  const allowed = ["name", "email", "company", "message"];
  const declared = new Set(headers || []);
  const usedHeaders = [];
  const out = {};
  for (const field of Object.keys(mapping)) {
    if (!allowed.includes(field)) {
      throw fail(400, `Unknown mapping field: ${field}.`);
    }
    const header = mapping[field];
    if (header === "" || header == null) {
      if (field === "message") {
        throw fail(400, "Map the message column before saving a recipe.");
      }
      continue;
    }
    if (typeof header !== "string" || !declared.has(header)) {
      throw fail(400, `The mapped column for ${field} is not in the source.`);
    }
    if (usedHeaders.includes(header)) {
      throw fail(400, "Map each source column to only one field.");
    }
    usedHeaders.push(header);
    out[field] = header;
  }
  if (!out.message) {
    throw fail(400, "Map the message column before saving a recipe.");
  }
  return out;
}

// The stable identity column. It exists for sorting/deletion safety only; row
// numbers are never accepted because reordering a sheet would silently change
// identity.
function assertSourceIdColumn(value, headers) {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    !(headers || []).includes(value)
  ) {
    throw fail(
        400,
        "Choose a stable record-ID column that exists in the source. Row numbers are not accepted because sorting or deleting rows would silently change identity.",
    );
  }
  return value;
}

function assertTimeZone(value) {
  if (!isValidTimeZone(value)) {
    throw fail(
        400,
        "Choose a valid timezone (e.g. UTC or America/New_York) for the daily budget boundary.",
    );
  }
  return value;
}

// A header/schema fingerprint used to detect drift between approval and a run.
function schemaFingerprint(headers) {
  return fingerprint([SCHEMA_VERSION, headers]);
}

// The diff that must force re-approval. Any edit to identity, connection, or
// budget structure invalidates the previous owner approval and pauses a recipe
// until the owner previews and confirms again.
function approvalKey(recipe) {
  return fingerprint([
    SCHEMA_VERSION,
    recipe.spreadsheetId,
    recipe.tabId,
    recipe.mapping,
    recipe.sourceIdColumn,
    recipe.headersHash,
  ]);
}

module.exports = {
  SCHEMA_VERSION,
  FREQUENCIES_MIN,
  MODES,
  INITIAL_POLICIES,
  isValidTimeZone,
  budgetDay,
  assertName,
  assertFrequency,
  assertMode,
  assertInitialPolicy,
  assertRowCap,
  assertDailyCreditCap,
  assertMapping,
  assertSourceIdColumn,
  assertTimeZone,
  schemaFingerprint,
  approvalKey,
};
