/**
 * Scheduled maintenance jobs.
 *
 * These run on Cloud Scheduler triggers, entirely separate from the request
 * path, so a slow sweep never blocks the intake API. Each job is idempotent and
 * failure-tolerant: a single bad document must not abort the run.
 */

const {onSchedule} = require("firebase-functions/v2/scheduler");
const {
  getFirestore,
  FieldValue,
} = require("firebase-admin/firestore");
const {logger} = require("firebase-functions");

const db = getFirestore();

/** How long a rate-limit counter stays relevant before it can be discarded. */
const RATE_LIMIT_TTL_MS = 24 * 60 * 60 * 1000;

/** An inquiry accepted but unenriched after this long is considered stalled. */
const STALL_AFTER_MS = 15 * 60 * 1000;

/**
 * Delete rate-limit counters that can no longer affect any live window.
 * Firestore has no TTL on this collection, so the counters are paged out here
 * instead. Anything past RATE_LIMIT_TTL_MS is dead weight and shows up during
 * a data-access review.
 * @return {Promise<number>} Number of documents removed.
 */
async function pruneRateLimitCounters() {
  let deleted = 0;
  const now = Date.now();

  for (;;) {
    const stale = await db.collection("rateLimits")
        .where("expiresAt", "<", now)
        .limit(400)
        .get();
    if (stale.empty) break;

    const batch = db.batch();
    for (const doc of stale.docs) batch.delete(doc.ref);
    await batch.commit();
    deleted += stale.size;

    if (stale.size < 400) break;
  }

  logger.info("[Prune] Deleted expired rate-limit counters", {deleted});
  return deleted;
}

/**
 * Clear the usage timestamp on API keys that have been idle past the retention
 * window, so `lastUsedAt` keeps meaning "recently used" instead of "first used".
 * @return {Promise<number>} Number of keys updated.
 */
async function clearStaleKeyUsage() {
  const cutoff = new Date(Date.now() - RATE_LIMIT_TTL_MS);
  const stale = await db.collection("apiKeys")
      .where("lastUsedAt", "<", cutoff)
      .limit(400)
      .get();
  if (stale.empty) return 0;

  const batch = db.batch();
  for (const doc of stale.docs) batch.update(doc.ref, {lastUsedAt: FieldValue.delete()});
  await batch.commit();

  logger.info("[Prune] Cleared lastUsedAt on idle API keys", {count: stale.size});
  return stale.size;
}

/**
 * Flag inquiries that were accepted but never finished enrichment, so the
 * dashboard surfaces them instead of leaving rows silently stuck.
 * @return {Promise<number>} Number of inquiries flagged.
 */
async function flagStalledInquiries() {
  const cutoff = new Date(Date.now() - STALL_AFTER_MS);
  const stalled = await db.collection("inquiries")
      .where("processingStatus", "in", ["pending", "failed"])
      .where("createdAt", "<", cutoff)
      .limit(300)
      .get();

  const fresh = stalled.docs.filter((doc) => !doc.data().stalledNotifiedAt);
  if (!fresh.length) return 0;

  const batch = db.batch();
  for (const doc of fresh) {
    batch.update(doc.ref, {stalledNotifiedAt: FieldValue.serverTimestamp()});
  }
  await batch.commit();

  logger.info("[Stall sweep] Flagged stalled inquiries", {count: fresh.length});
  return fresh.length;
}

/**
 * Daily housekeeping, offset to a low-traffic hour in UTC.
 */
exports.dailyMaintenance = onSchedule({
  schedule: "every day 03:15",
  timeZone: "UTC",
  region: "us-central1",
  memory: "256MiB",
  timeoutSeconds: 540,
}, async () => {
  const jobs = {pruneRateLimitCounters, clearStaleKeyUsage, flagStalledInquiries};
  const failures = [];

  for (const [name, job] of Object.entries(jobs)) {
    try {
      await job();
    } catch (error) {
      failures.push(name);
      logger.error(`[Daily maintenance] ${name} failed`, {message: error.message});
    }
  }

  if (failures.length) {
    throw new Error(`Daily maintenance failed: ${failures.join(", ")}`);
  }
  logger.info("[Daily maintenance] Completed");
});

/**
 * Rolling 24-hour usage rollup, keyed per customer per day. The analytics view
 * reads these rollups so cost stays flat as raw inquiry volume grows.
 */
exports.aggregateDailyUsage = onSchedule({
  schedule: "every day 04:00",
  timeZone: "UTC",
  region: "us-central1",
  memory: "256MiB",
  timeoutSeconds: 540,
}, async () => {
  const windowEnd = new Date();
  windowEnd.setUTCHours(0, 0, 0, 0);
  const windowStart = new Date(windowEnd.getTime() - 24 * 60 * 60 * 1000);
  const day = windowEnd.toISOString().slice(0, 10);

  const recent = await db.collection("inquiries")
      .where("createdAt", ">=", windowStart)
      .where("createdAt", "<", windowEnd)
      .limit(5000)
      .get();

  const byCustomer = new Map();
  for (const doc of recent.docs) {
    const data = doc.data();
    if (!data.customerId) continue;

    const bucket = byCustomer.get(data.customerId) || {
      inquiries: 0, qualified: 0, contacted: 0, spam: 0, failed: 0,
    };
    bucket.inquiries += 1;
    if (data.status === "Qualified") bucket.qualified += 1;
    if (data.status === "Contacted") bucket.contacted += 1;
    if (data.status === "Spam") bucket.spam += 1;
    if (data.processingStatus === "failed") bucket.failed += 1;
    byCustomer.set(data.customerId, bucket);
  }

  if (!byCustomer.size) {
    logger.info("[Usage rollup] No inquiries in window", {windowStart: day});
    return;
  }

  const batch = db.batch();
  for (const [customerId, counts] of byCustomer) {
    batch.set(db.collection("usageRollups").doc(`${customerId}_${day}`), {
      customerId,
      day,
      windowStart: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString(),
      ...counts,
      updatedAt: FieldValue.serverTimestamp(),
    }, {merge: true});
  }
  await batch.commit();

  logger.info("[Usage rollup] Wrote daily aggregates", {
    customers: byCustomer.size,
    inquiries: recent.size,
  });
});
