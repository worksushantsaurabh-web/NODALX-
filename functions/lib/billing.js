const {fail, fingerprint, validSignature, PLANS} = require("./plans");

function billingService(db, service) {
  const configured = () =>
    !!(
      process.env.RAZORPAY_KEY_ID &&
      process.env.RAZORPAY_KEY_SECRET &&
      process.env.RAZORPAY_WEBHOOK_SECRET
    );
  const planIds = () => ({
    starter: process.env.RAZORPAY_STARTER_PLAN_ID,
    growth: process.env.RAZORPAY_GROWTH_PLAN_ID,
  });
  async function provider(path, method = "GET", body) {
    if (!configured()) {
      throw fail(
          503,
          "Billing is not enabled yet. Your existing data remains available.",
      );
    }
    const response = await fetch(`https://api.razorpay.com/v1/${path}`, {
      method,
      signal: AbortSignal.timeout(15000),
      headers: {
        "Authorization": `Basic ${Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      throw fail(
          502,
          "The payment provider could not complete this request. Please retry later.",
      );
    }
    return response.json();
  }

  async function plans() {
    const output = [];
    for (const [id, limits] of Object.entries(PLANS)) {
      const providerId = planIds()[id];
      let price = null;
      if (configured() && providerId) {
        const value = await provider(`plans/${encodeURIComponent(providerId)}`);
        if (value.period !== "monthly" || value.interval !== 1) {
          throw fail(503, "Billing plans must use a monthly renewal period.");
        }
        price = {amount: value.item.amount, currency: value.item.currency};
      }
      output.push({id, ...limits, price, checkoutEnabled: !!price});
    }
    return {plans: output, configured: configured()};
  }

  async function checkout(uid, plan) {
    if (!planIds()[plan] || !configured()) {
      throw fail(503, "Checkout is not configured for this plan.");
    }
    const verifiedPlan = await provider(
        `plans/${encodeURIComponent(planIds()[plan])}`,
    );
    if (verifiedPlan.period !== "monthly" || verifiedPlan.interval !== 1) {
      throw fail(503, "This plan is not configured for monthly billing.");
    }
    await service.subscription(uid);
    const reference = db.collection("billingCheckouts").doc(uid);
    const existing = await db.runTransaction(async (transaction) => {
      const current = (await transaction.get(reference)).data();
      const subscription = (
        await transaction.get(db.collection("subscriptions").doc(uid))
      ).data();
      if (
        subscription.providerId &&
        ["active", "past_due"].includes(subscription.status)
      ) {
        throw fail(
            409,
            "An existing subscription must finish or be cancelled before starting another.",
        );
      }
      if (current?.status === "ready") {
        if (current.plan !== plan) {
          throw fail(
              409,
              "A checkout for another plan already exists. Complete or cancel it first.",
          );
        }
        return current;
      }
      if (current && current.status !== "closed") {
        throw fail(
            409,
            "A previous checkout needs reconciliation. Contact support before trying again.",
        );
      }
      transaction.set(reference, {
        status: "creating",
        plan,
        createdAt: Date.now(),
      });
      return null;
    });
    if (existing) return {url: existing.url};
    try {
      const value = await provider("subscriptions", "POST", {
        plan_id: planIds()[plan],
        total_count: 120,
        quantity: 1,
        customer_notify: 1,
        notes: {workspace: uid},
      });
      if (
        !value.id ||
        !/^https:\/\/(rzp\.io|razorpay\.com)\//.test(value.short_url || "")
      ) {
        throw fail(502, "The provider returned an invalid checkout.");
      }
      const batch = db.batch();
      batch.set(db.collection("billingSubscriptions").doc(value.id), {
        uid,
        plan,
        createdAt: Date.now(),
      });
      batch.set(reference, {
        status: "ready",
        plan,
        providerId: value.id,
        url: value.short_url,
        createdAt: Date.now(),
      });
      await batch.commit();
      return {url: value.short_url};
    } catch (error) {
      await reference.set({status: "reconcile_required"}, {merge: true});
      throw error;
    }
  }

  async function webhook(req) {
    if (
      !validSignature(
          req.rawBody,
          req.headers["x-razorpay-signature"],
          process.env.RAZORPAY_WEBHOOK_SECRET,
      )
    ) {
      throw fail(401, "Invalid webhook signature.");
    }
    const payload = JSON.parse(req.rawBody.toString("utf8"));
    const providerId = payload.payload?.subscription?.entity?.id;
    if (!providerId) return {received: true};
    const eventId = req.headers["x-razorpay-event-id"];
    if (typeof eventId !== "string" || eventId.length > 250) {
      throw fail(400, "Missing event ID.");
    }
    const eventRef = db.collection("billingEvents").doc(fingerprint(eventId));
    if ((await eventRef.get()).exists) {
      return {received: true, duplicate: true};
    }
    const binding = (
      await db.collection("billingSubscriptions").doc(providerId).get()
    ).data();
    if (!binding) {
      throw fail(
          503,
          "Subscription binding is not available yet. Retry this event.",
      );
    }
    const value = await provider(
        `subscriptions/${encodeURIComponent(providerId)}`,
    );
    const periodStart = Number(value.current_start) * 1000;
    const periodEnd = Number(value.current_end) * 1000;
    const active =
      value.status === "active" &&
      Number.isFinite(periodStart) &&
      periodStart > 0 &&
      periodEnd > periodStart;
    await db.runTransaction(async (transaction) => {
      const event = await transaction.get(eventRef);
      const subRef = db.collection("subscriptions").doc(binding.uid);
      const current = (await transaction.get(subRef)).data() || {};
      if (event.exists) return;
      if ((current.lastBillingEventAt || 0) > Number(payload.created_at || 0)) {
        transaction.create(eventRef, {
          providerId,
          ignored: true,
          receivedAt: Date.now(),
        });
        return;
      }
      const status = active ?
        "active" :
        ["halted", "pending"].includes(value.status) ?
          "past_due" :
          ["cancelled", "completed", "expired"].includes(value.status) ?
            "expired" :
            null;
      if (status) {
        transaction.set(
            subRef,
            {
              plan: binding.plan,
              status,
              providerId,
              periodStart: active ? periodStart : current.periodStart || 0,
              periodEnd: active ? periodEnd : current.periodEnd || 0,
              lastBillingEventAt: Number(payload.created_at || 0),
            },
            {merge: true},
        );
        transaction.set(
            db.collection("users").doc(binding.uid),
            {tier: active ? "full" : "free", plan: binding.plan},
            {merge: true},
        );
        transaction.set(
            db.collection("billingCheckouts").doc(binding.uid),
            {status: "closed"},
            {merge: true},
        );
      }
      transaction.create(eventRef, {
        providerId,
        event: payload.event || "unknown",
        receivedAt: Date.now(),
      });
    });
    return {received: true};
  }

  async function cancel(uid) {
    const sub = await service.subscription(uid);
    if (!sub.providerId) {
      throw fail(400, "There is no paid subscription to cancel.");
    }
    await provider(
        `subscriptions/${encodeURIComponent(sub.providerId)}/cancel`,
        "POST",
        {cancel_at_cycle_end: 1},
    );
    await db
        .collection("subscriptions")
        .doc(uid)
        .update({cancelAtPeriodEnd: true});
    return {success: true};
  }

  async function invoices(uid) {
    const sub = await service.subscription(uid);
    if (!sub.providerId) return {invoices: []};
    const response = await provider(
        `invoices?subscription_id=${encodeURIComponent(sub.providerId)}&count=25`,
    );
    return {
      invoices: (response.items || []).map((item) => ({
        id: item.id,
        amount: item.amount,
        currency: item.currency,
        status: item.status,
        url: item.short_url,
      })),
    };
  }
  return {plans, checkout, webhook, cancel, invoices};
}

module.exports = {billingService};
