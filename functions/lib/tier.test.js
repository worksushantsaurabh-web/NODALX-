const {test} = require("node:test");
const assert = require("node:assert/strict");
const {toEntitlement, toPlan, planRank, resolveTier, isRedeemed, FREE, FULL, PLAN_ORDER} = require("./tier");

test("paid plan keys grant full access", () => {
  for (const plan of ["starter", "pro", "growth", "scale", "enterprise"]) {
    assert.equal(toEntitlement(plan), FULL);
  }
});

test("free and unknown values fail closed", () => {
  for (const value of ["free", "trial", "", null, undefined, 7]) {
    assert.equal(toEntitlement(value), FREE);
  }
});

test("toPlan normalizes and falls back", () => {
  assert.equal(toPlan("PRO"), "pro");
  assert.equal(toPlan("full"), "pro");
  assert.equal(toPlan("unknown"), "starter");
});

test("planRank orders plans", () => {
  assert.ok(planRank("starter") < planRank("pro"));
  assert.equal(planRank("bad"), -1);
});

test("resolveTier reads entitlement only from the server-owned users.tier", () => {
  assert.deepEqual(resolveTier({tier: "full"}, {subscription: {tier: "starter"}}), {
    tier: FULL, plan: "starter",
  });
  // Legacy accounts whose users document predates the field still resolve to free.
  assert.deepEqual(resolveTier({}, {subscription: {tier: "growth"}}), {
    tier: FREE, plan: "growth",
  });
});

test("profile subscription alone can never grant paid entitlement", () => {
  // Regression guard: the profile document is client-writable, so it must not be
  // an input to the entitlement decision at all.
  for (const plan of PLAN_ORDER) {
    assert.equal(resolveTier(undefined, {subscription: {tier: plan}}).tier, FREE);
    assert.equal(resolveTier({}, {subscription: {tier: plan}}).tier, FREE);
  }
});

test("new accounts resolve to free/starter", () => {
  assert.deepEqual(resolveTier(undefined, undefined), {tier: FREE, plan: "starter"});
});

test("isRedeemed treats any truthy marker as spent", () => {
  // The two redemption paths used to disagree, so a key marked with a non-boolean
  // truthy value could be redeemed twice. All of these must be treated as spent.
  for (const value of [true, "true", 1, "1", "yes", "redeemed", "TRUE"]) {
    assert.equal(isRedeemed({redeemed: value}), true, `redeemed=${String(value)}`);
  }
  for (const value of [false, "false", 0, "", null, undefined, "no"]) {
    assert.equal(isRedeemed({redeemed: value}), false, `redeemed=${String(value)}`);
  }
  assert.equal(isRedeemed({}), false);
  assert.equal(isRedeemed(undefined), false);
});
