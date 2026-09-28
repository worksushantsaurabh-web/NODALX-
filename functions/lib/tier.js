/**
 * Canonical tier vocabulary.
 *
 * Two distinct concepts were previously conflated across the codebase:
 *
 *   1. Entitlement - may the account read gated content? Only "free" or
 *                    "full". Firestore rules and useUserTier both key on this.
 *   2. Plan label  - the commercial plan a key was sold as, e.g. "starter",
 *                    "pro", "growth". Display and pricing only.
 *
 * Redeeming a key used to write the plan label straight into `users.tier`, and
 * since only the literal value "full" granted access, paying customers were
 * permanently denied gated content. These helpers keep `users.tier`
 * authoritative for entitlement and mirror the plan separately.
 */

const FREE = "free";
const FULL = "full";

/** Commercial plan labels, ordered from cheapest to most expensive. */
const PLAN_ORDER = ["starter", "pro", "growth", "scale", "enterprise"];

/** Values on a user or profile document that mean "no paid access". */
const FREE_VALUES = new Set([FREE, "trial", "trial_expired", "cancelled", "canceled", "inactive"]);

/**
 * Normalize a raw value to a lowercase string, or null when unusable.
 * @param {*} value Raw value.
 * @return {string|null} Normalized value.
 */
function normalize(value) {
  return typeof value === "string" && value.trim() ? value.trim().toLowerCase() : null;
}

/**
 * Derive the entitlement granted by redeeming an API key.
 * Any recognized plan label grants paid access; only explicitly inactive
 * values and unrecognized input do not, so a typo fails closed.
 * @param {*} value The key's tier or plan field.
 * @return {string} Either "free" or "full".
 */
function entitlementFromKey(value) {
  const normalized = normalize(value);
  if (!normalized || FREE_VALUES.has(normalized)) return FREE;
  return PLAN_ORDER.includes(normalized) || normalized === FULL ? FULL : FREE;
}

/**
 * Derive the entitlement for an existing user or profile document.
 * @param {*} value The stored tier value.
 * @return {string} Either "free" or "full".
 */
function toEntitlement(value) {
  const normalized = normalize(value);
  if (!normalized || FREE_VALUES.has(normalized)) return FREE;
  return PLAN_ORDER.includes(normalized) || normalized === FULL ? FULL : FREE;
}

/**
 * Normalize a raw value to a known plan label.
 * @param {*} value Raw plan value.
 * @param {string} [fallback] Plan to use when the value is unrecognized.
 * @return {string} A label from PLAN_ORDER.
 */
function toPlan(value, fallback = "starter") {
  const normalized = normalize(value);
  if (normalized === FULL) return "pro";
  if (normalized && PLAN_ORDER.includes(normalized)) return normalized;
  return fallback;
}

/**
 * Rank a plan for comparisons such as "is this an upgrade".
 * @param {*} value Plan label.
 * @return {number} Zero-based rank, or -1 when unrecognized.
 */
function planRank(value) {
  const normalized = normalize(value);
  return normalized ? PLAN_ORDER.indexOf(normalized) : -1;
}

/**
 * Resolve the canonical tier pair for a user.
 *
 * Entitlement is server-owned and is read from `users/{uid}.tier` only. The
 * profile subscription is display/billing metadata and deliberately cannot
 * grant access: it used to be a fallback here, which meant the client-writable
 * profile document was a self-service upgrade to the paid tier. A user with no
 * `users` document now resolves to free rather than inheriting entitlement
 * from a field the client can write.
 *
 * @param {Object} [userData] The `users/{uid}` document.
 * @param {Object} [profileData] The `users/{uid}/profile/main` document.
 * @return {{tier: string, plan: string}} Canonical entitlement and plan.
 */
function resolveTier(userData, profileData) {
  const userTier = userData ? userData.tier : undefined;
  const subscriptionTier = profileData && profileData.subscription ?
    profileData.subscription.tier : undefined;

  return {
    tier: toEntitlement(userTier),
    plan: toPlan(subscriptionTier, toPlan(userTier)),
  };
}

/**
 * Report whether an apiKeys document has already been redeemed.
 *
 * Only the explicit negative forms count as un-redeemed; everything else
 * truthy counts as spent. The two redemption paths previously disagreed: the
 * callable used a truthiness test while the HTTP route accepted only the
 * literals true and "true", so a legacy value such as 1 or "1" was rejected by
 * one and accepted by the other, letting a single-use paid key be redeemed
 * twice. Defaulting to "spent" is the conservative reading of single-use
 * semantics, and the negatives below are unambiguous rather than accidental.
 *
 * @param {Object} [keyData] The `apiKeys/{keyId}` document.
 * @return {boolean} True when the key is already spent.
 */
function isRedeemed(keyData) {
  if (!keyData) return false;
  const value = keyData.redeemed;
  if (value === false || value === null || value === undefined) return false;
  if (value === 0) return false;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return !["", "false", "0", "no", "null", "undefined"].includes(normalized);
  }
  return Boolean(value);
}

module.exports = {
  FREE,
  FULL,
  FREE_VALUES,
  PLAN_ORDER,
  entitlementFromKey,
  toEntitlement,
  toPlan,
  planRank,
  isRedeemed,
  resolveTier,
};
