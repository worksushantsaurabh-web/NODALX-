/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const {setGlobalOptions} = require("firebase-functions/v2");
const admin = require("firebase-admin");
const {onRequest, onCall, HttpsError} = require("firebase-functions/v2/https");
const {
  getFirestore,
  FieldValue,
} = require("firebase-admin/firestore");
const {getAuth} = require("firebase-admin/auth");
const crypto = require("crypto");
const {parse: csvParse} = require("csv-parse/sync");
const XLSX = require("xlsx");
const busboy = require("busboy");
const googleSheets = require("./lib/googleSheets");


admin.initializeApp();

const db = getFirestore();

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// In the v1 API, each function can only serve one request per container, so
// this will be the maximum concurrent request count.
setGlobalOptions({region: "us-central1", maxInstances: 10});

/**
 * Generate a unique API key.
 * @return {string} The generated API key.
 */
function generateApiKey() {
  return "nxk_live_" + crypto.randomBytes(24).toString("hex");
}

/**
 * Validate an API key from request headers.
 * @param {Object} req The HTTP request object.
 * @return {Object|null} Customer data if valid, null otherwise.
 */
async function validateApiKey(req) {
  const apiKey = req.headers["x-api-key"];
  if (!apiKey) return null;

  const keyDoc = await db.collection("apiKeys")
      .where("key", "==", apiKey)
      .where("active", "==", true)
      .limit(1)
      .get();
  if (keyDoc.empty) return null;

  const keyData = keyDoc.docs[0].data();
  return {
    customerId: keyData.customerId,
    businessName: keyData.businessName,
    plan: keyData.plan || "starter",
  };
}

/**
 * Parse file upload from multipart form data.
 * @param {Object} req The HTTP request object.
 * @return {Promise<Object>} Promise with fileBuffer, fileName, and fieldData.
 */
function parseFileUpload(req) {
  return new Promise((resolve, reject) => {
    const bb = busboy({headers: req.headers});
    let fileBuffer = null;
    let fileName = "";
    const fieldData = {};

    bb.on("file", (fieldname, file, info) => {
      fileName = info.filename;
      const chunks = [];
      file.on("data", (chunk) => chunks.push(chunk));
      file.on("end", () => {
        fileBuffer = Buffer.concat(chunks);
      });
    });

    bb.on("field", (name, value) => {
      fieldData[name] = value;
    });

    bb.on("finish", () => {
      resolve({fileBuffer, fileName, fieldData});
    });

    bb.on("error", reject);

    // Cloud Functions may have already consumed the raw body
    if (req.rawBody) {
      bb.end(req.rawBody);
    } else {
      req.pipe(bb);
    }
  });
}

/**
 * Parse CSV or Excel spreadsheet into JSON records.
 * @param {Buffer} buffer The file buffer.
 * @param {string} fileName The original file name.
 * @return {Array} Array of parsed records.
 */
function parseSpreadsheet(buffer, fileName) {
  const ext = (fileName || "").toLowerCase();

  if (ext.endsWith(".csv") || ext.endsWith(".tsv")) {
    const content = buffer.toString("utf-8");
    const records = csvParse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    });
    return records;
  }

  // Excel files (.xlsx, .xls)
  const workbook = XLSX.read(buffer, {type: "buffer"});
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const records = XLSX.utils.sheet_to_json(sheet, {defval: ""});
  return records;
}

// checkAllowedUser disabled for standard Firebase Auth compatibility

exports.redeemKey = onCall({invoker: "public"}, async (request) => {
  // 1. Require the caller to be signed in
  if (!request.auth) {
    throw new HttpsError(
        "unauthenticated",
        "You must be signed in to redeem a key.",
    );
  }

  const {key} = request.data || {};
  const {uid} = request.auth;

  // 2. Read "key" string from the request data
  if (typeof key !== "string" || key.length === 0) {
    throw new HttpsError(
        "invalid-argument",
        "The function must be called with a 'key' string argument.",
    );
  }

  const db = getFirestore();
  const userRef = db.collection("users").doc(uid);

  try {
    const tier = await db.runTransaction(async (transaction) => {
      // 3. Look up the key by its 'key' field in the apiKeys collection
      const keySnapshot = await db.collection("apiKeys").where("key", "==", key).limit(1).get();

      if (keySnapshot.empty) {
        throw new HttpsError(
            "not-found",
            "The access key you provided does not exist.",
        );
      }

      const accessKeyRef = keySnapshot.docs[0].ref;
      const keyData = keySnapshot.docs[0].data();

      // 4. Throw an error if it's already redeemed
      if (keyData.redeemed) {
        throw new HttpsError(
            "already-exists",
            "This access key has already been redeemed.",
        );
      }

      // 5. Mark the key document as redeemed and set the user's tier
      transaction.update(accessKeyRef, {
        redeemed: true,
        redeemedBy: uid,
        redeemedAt: FieldValue.serverTimestamp(),
      });

      transaction.set(userRef, {tier: keyData.tier}, {merge: true});

      return keyData.tier;
    });

    // 6. Log the redemption for audit purposes
    await db.collection("auditLogs").add({
      action: "key_redeemed",
      userId: uid,
      tier: tier,
      keyId: key,
      timestamp: FieldValue.serverTimestamp(),
    });

    // 7. Return success and the new tier
    return {success: true, tier};
  } catch (error) {
    if (error instanceof HttpsError) {
      throw error;
    }
    console.error("Transaction failed: ", error);
    throw new HttpsError(
        "internal",
        "An unexpected error occurred while redeeming the key.",
    );
  }
});

const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors({origin: true}));
app.use(express.json({limit: "7mb"}));

/**
 * Check and enforce rate limit using Firestore as a shared store.
 * Stores recent request timestamps per user in the "rateLimits" collection,
 * pruning entries outside the window on every check.
 * @param {string} userId The user ID to check.
 * @param {number} maxRequests Maximum requests allowed in the window.
 * @param {number} windowMs Time window in milliseconds.
 * @return {Promise<boolean>} True if allowed, false if rate limited.
 */
async function checkRateLimit(userId, maxRequests = 10, windowMs = 60000) {
  const ref = db.collection("rateLimits").doc(userId);
  const now = Date.now();
  const cutoff = now - windowMs;

  return db.runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    const timestamps = (doc.exists ? doc.data().timestamps : [])
        .filter((t) => t > cutoff);

    if (timestamps.length >= maxRequests) {
      return false;
    }

    tx.set(ref, {timestamps: [...timestamps, now]});
    return true;
  });
}

const MAKE_WEBHOOK_URL = process.env.MAKE_WEBHOOK_URL;
const WEBHOOK_TIMEOUT_MS = Number(process.env.WEBHOOK_TIMEOUT_MS || 30000);

/**
 * Send a request to a webhook.
 * @param {string} webhookUrl The webhook URL to call.
 * @param {Object} config Request configuration.
 * @return {Promise<Object>} The webhook response data.
 */
async function requestWebhook(webhookUrl, {method = "POST", body} = {}) {
  const timeoutController = new AbortController();
  const timeout = setTimeout(() => timeoutController.abort(), WEBHOOK_TIMEOUT_MS);

  try {
    const response = await fetch(webhookUrl, {
      method,
      headers: {"Content-Type": "application/json"},
      body: body ? JSON.stringify(body) : undefined,
      signal: timeoutController.signal,
    });

    const responseText = await response.text();
    let data = responseText;
    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch {
      // Continue with responseText as fallback
    }

    if (!response.ok) {
      const error = new Error(data?.message || data?.error || `Webhook responded with status ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Send a Slack notification about a lead.
 * @param {string} slackWebhookUrl The Slack webhook URL.
 * @param {Object} inquiry The inquiry data.
 * @param {Object} classification The classification result.
 */
async function sendSlackNotification(slackWebhookUrl, inquiry, classification = {}) {
  if (!slackWebhookUrl) return;
  try {
    const payload = {
      text: `🔥 *New Lead Captured via NODALxAI*`,
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "⚡ New Lead Captured - NODALxAI",
            emoji: true,
          },
        },
        {
          type: "section",
          fields: [
            {type: "mrkdwn", text: `*Lead Name:*\n${inquiry.name}`},
            {type: "mrkdwn", text: `*Company:*\n${inquiry.company || "N/A"}`},
            {type: "mrkdwn", text: `*Email:*\n${inquiry.email}`},
            {
              type: "mrkdwn",
              text: `*Intent / Score:*\n${classification.intent || "Qualified"} (${
                classification.fit_score || 8}/10)`,
            },
          ],
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Inquiry Message:*\n"${inquiry.message}"`,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*AI Summary & Action:*\n${
              classification.summary || "Lead classified successfully."}\n👉 _${
              classification.suggested_action || "Follow up immediately"}_`,
          },
        },
      ],
    };
    await fetch(slackWebhookUrl, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error("[Slack Notification Error]", err);
  }
}

app.post("/api/inquiries", async (req, res) => {
  const {name, email, company, message} = req.body || {};
  if (!name || !email || !company || !message) {
    return res.status(400).json({error: "Name, email, company, and message are required."});
  }
  if (!MAKE_WEBHOOK_URL) {
    return res.status(503).json({error: "Inquiry webhook is not configured.", message: "Set MAKE_WEBHOOK_URL"});
  }
  try {
    // Validate API key if provided
    const customer = await validateApiKey(req);
    const enrichedBody = {
      ...req.body,
      ...(customer ? {
        customerId: customer.customerId,
        businessName: customer.businessName,
        plan: customer.plan,
      } : {}),
      receivedAt: new Date().toISOString(),
    };

    const webhookResponse = await requestWebhook(MAKE_WEBHOOK_URL, {body: enrichedBody});

    // Track usage if API key was used
    if (customer) {
      const keyQuery = await db.collection("apiKeys")
          .where("customerId", "==", customer.customerId)
          .where("active", "==", true)
          .limit(1).get();
      if (!keyQuery.empty) {
        await keyQuery.docs[0].ref.update({
          totalInquiries: FieldValue.increment(1),
          lastUsedAt: FieldValue.serverTimestamp(),
        });
      }

      // Append to Google Sheet if configured
      try {
        const sheetSource = await db.collection("users")
            .doc(customer.customerId)
            .collection("data-sources")
            .doc("google-sheets")
            .get();
        if (sheetSource.exists && sheetSource.data().connected && sheetSource.data().config?.spreadsheetId) {
          const spreadsheetId = sheetSource.data().config.spreadsheetId;
          const classification = webhookResponse?.classification || {};
          await googleSheets.appendRow(spreadsheetId, {
            ...enrichedBody,
            ...classification,
          });
        }
      } catch (err) {
        console.error("[Google Sheets] Failed to append inquiry:", err);
      }
    }

    // Store inquiry + classification in Firestore for the dashboard
    try {
      const classification = webhookResponse?.classification || {};
      const inquiryDoc = {
        name: name,
        email: email,
        company: company || "",
        message: message,
        intent: classification.intent || "",
        urgency: classification.urgency || "",
        fit_score: classification.fit_score || "",
        category: classification.category || "",
        summary: classification.summary || "",
        suggested_action: classification.suggested_action || "",
        status: classification.intent ? "Qualified" : "Pending",
        customerId: customer?.customerId || "direct",
        businessName: customer?.businessName || "",
        createdAt: FieldValue.serverTimestamp(),
        last_active: new Date().toISOString(),
      };
      await db.collection("inquiries").add(inquiryDoc);

      // Trigger Slack Notification if configured
      if (customer?.customerId) {
        try {
          const notifDoc = await db.collection("users")
              .doc(customer.customerId)
              .collection("data-sources")
              .doc("notifications")
              .get();
          if (notifDoc.exists && notifDoc.data().slackWebhookUrl) {
            await sendSlackNotification(notifDoc.data().slackWebhookUrl, req.body, classification);
          }
        } catch (err) {
          console.error("[Slack Alert] Failed to dispatch Slack notification:", err);
        }
      }
    } catch (err) {
      console.error("[Firestore] Failed to store inquiry:", err);
    }

    return res.status(202).json({accepted: true, webhookResponse});
  } catch (error) {
    console.error("[Make Webhook] Inquiry submission failed:", error);
    return res.status(502).json({error: "The inquiry webhook could not be reached."});
  }
});

app.post("/api/flows/test", (req, res) => {
  return res.json({success: true, received: req.body});
});

app.patch("/api/inquiries/:id/status", async (req, res) => {
  try {
    const userId = await requireUserId(req, res);
    if (!userId) return;
    const {status} = req.body;
    if (!status) return res.status(400).json({error: "Status is required"});

    const docRef = db.collection("inquiries").doc(req.params.id);
    await docRef.update({
      status: status,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return res.json({success: true, status});
  } catch (error) {
    console.error("[Status Update Error]", error);
    return res.status(500).json({error: "Failed to update status"});
  }
});

app.get("/api/integrations/notifications", async (req, res) => {
  try {
    const userId = await requireUserId(req, res);
    if (!userId) return;

    const notifDoc = await db.collection("users").doc(userId).collection("data-sources").doc("notifications").get();
    if (!notifDoc.exists) return res.json({slackWebhookUrl: "", emailAlerts: true});

    return res.json(notifDoc.data());
  } catch (error) {
    return res.status(500).json({error: "Failed to fetch notification settings"});
  }
});

app.put("/api/integrations/notifications", async (req, res) => {
  try {
    const userId = await requireUserId(req, res);
    if (!userId) return;
    const {slackWebhookUrl, emailAlerts} = req.body;

    await db.collection("users").doc(userId).collection("data-sources").doc("notifications").set({
      slackWebhookUrl: slackWebhookUrl || "",
      emailAlerts: emailAlerts !== false,
      updatedAt: FieldValue.serverTimestamp(),
    }, {merge: true});

    return res.json({success: true, message: "Notification settings updated successfully"});
  } catch (error) {
    return res.status(500).json({error: "Failed to save notification settings"});
  }
});

app.post("/api/integrations/notifications/test", async (req, res) => {
  try {
    const userId = await requireUserId(req, res);
    if (!userId) return;

    const slackWebhookUrl = req.body.slackWebhookUrl;

    if (!slackWebhookUrl || typeof slackWebhookUrl !== "string" || !slackWebhookUrl.trim()) {
      return res.status(400).json({
        error: "Slack Webhook URL is required.",
      });
    }

    const trimmedUrl = slackWebhookUrl.trim();
    if (!trimmedUrl.startsWith("https://hooks.slack.com/")) {
      return res.status(400).json({
        error: "Invalid Slack Webhook URL. It must start with https://hooks.slack.com/",
      });
    }

    const testPayload = {
      text: "🎉 *NODALxAI Test Alert*: Your Slack integration is working perfectly!",
    };

    const slackResponse = await fetch(trimmedUrl, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(testPayload),
    });

    if (slackResponse.ok) {
      return res.json({
        success: true,
        message: "Slack alert sent! Check your Slack channel.",
      });
    } else {
      const slackError = await slackResponse.text();
      console.error("[Slack Test Error]:", slackResponse.status, slackError);
      return res.status(400).json({
        error: `Slack rejected the request (${slackResponse.status}): ${slackError || "Please verify your Incoming Webhook URL."}`,
      });
    }
  } catch (error) {
    console.error("[Test Slack Notification Error]:", error);
    return res.status(500).json({
      error: "Failed to send test notification. Please check your network connection and Webhook URL.",
    });
  }
});

app.get("/api/customers", async (req, res) => {
  try {
    const userId = await requireUserId(req, res);
    if (!userId) return;

    // Read stored inquiries from Firestore
    const snapshot = await db.collection("inquiries")
        .orderBy("createdAt", "desc")
        .limit(100)
        .get();

    if (snapshot.empty) {
      return res.json([]);
    }

    const customers = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name || "",
        email: data.email || "",
        company: data.company || "",
        message: data.message || "",
        intent: data.intent || "",
        urgency: data.urgency || "",
        fit_score: data.fit_score || "",
        category: data.category || "",
        summary: data.summary || "",
        status: data.status || "Pending",
        last_active: data.last_active || (
          data.createdAt ? data.createdAt.toDate().toISOString() : new Date().toISOString()
        ),
      };
    });

    res.set("X-NodalX-Data-Source", "firestore");
    return res.json(customers);
  } catch (error) {
    console.error("[Server Error] Loading customers failed:", error);
    return res.status(502).json({error: "Failed to load customer data."});
  }
});

const firebaseAuth = getAuth();
const userCollection = (userId) => db.collection("users").doc(userId);
const flowCollection = (userId) => userCollection(userId).collection("flows");
const profileDocument = (userId) => userCollection(userId).collection("profile").doc("main");
const dataSourceCollection = (userId) => userCollection(userId).collection("data-sources");

/**
 * Convert Firestore timestamp to ISO string if applicable.
 * @param {*} value The value to serialize.
 * @return {*} The serialized value.
 */
function serializeFirestoreValue(value) {
  if (value && typeof value.toDate === "function") return value.toDate().toISOString();
  return value;
}

/**
 * Serialize a Firestore document to plain JSON.
 * @param {Object} document The Firestore document snapshot.
 * @return {Object} Plain JSON object.
 */
function serializeDocument(document) {
  const data = document.data() || {};
  return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, serializeFirestoreValue(value)]));
}

/**
 * Get default data sources for a new user.
 * @return {Array} Array of data source configs.
 */
function getDefaultDataSources() {
  return [
    {id: "google-sheets", name: "Google Sheets", connected: false, config: {}},
    {id: "webhooks", name: "Webhooks", connected: false, config: {url: "/api/inquiries"}},
    {id: "postgres", name: "PostgreSQL", connected: false, config: {}},
    {id: "firebase", name: "Firebase", connected: false, config: {}},
  ];
}

/**
 * Get default profile for a new user.
 * @param {string} uid The user ID.
 * @param {Object} user The Firebase user object.
 * @return {Object} Default profile object.
 */
function getDefaultProfile(uid, user) {
  return {
    uid,
    displayName: user?.displayName || "User",
    email: user?.email || "",
    photoURL: user?.photoURL || "",
    workspace: "My Workspace",
    role: "Founder",
    timezone: "UTC",
    notifications: {flowFailure: true, weeklySummary: true, securityAlerts: true},
    subscription: {tier: "free", status: "active", executionsUsed: 0, executionsLimit: 1000, nextInvoiceDate: ""},
    apiKeys: [],
  };
}

/**
 * Extract user ID from Firebase ID token in Authorization header.
 * @param {Object} req The HTTP request object.
 * @return {Promise<string>} The user ID.
 */
async function getUserId(req) {
  const authorization = req.headers.authorization || "";
  if (!authorization.startsWith("Bearer ")) {
    const error = new Error("Authentication required");
    error.status = 401;
    throw error;
  }
  const token = authorization.slice("Bearer ".length);
  const decodedToken = await firebaseAuth.verifyIdToken(token);
  return decodedToken.uid;
}

/**
 * Require authentication and return user ID, or send 401 response.
 * @param {Object} req The HTTP request object.
 * @param {Object} res The HTTP response object.
 * @return {Promise<string|null>} The user ID or null if authentication fails.
 */
async function requireUserId(req, res) {
  try {
    return await getUserId(req);
  } catch (error) {
    res.status(error.status || 401).json({error: "Authentication required"});
    return null;
  }
}

app.get("/api/flows", async (req, res) => {
  try {
    const userId = await requireUserId(req, res);
    if (!userId) return;
    const snapshot = await flowCollection(userId).orderBy("createdAt", "desc").get();
    res.json(snapshot.docs.map(serializeDocument));
  } catch (error) {
    res.status(500).json({error: "Failed to load flows"});
  }
});

app.post("/api/flows", async (req, res) => {
  try {
    const userId = await requireUserId(req, res);
    if (!userId) return;
    const {name, steps, status = "inactive"} = req.body;
    if (!name || !steps) return res.status(400).json({error: "Name and steps are required"});
    const flowRef = flowCollection(userId).doc();
    await flowRef.set({
      id: flowRef.id,
      name,
      steps: Array.isArray(steps) ? steps : [],
      status,
      lastRun: "Never",
      primaryMetric: "0 Executions",
      actions: Array.isArray(steps) ? steps.length : 0,
      subMetrics: [{label: "Avg Duration", value: "0s"}, {label: "Success Rate", value: "0%"}],
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    res.status(201).json(serializeDocument(await flowRef.get()));
  } catch (error) {
    res.status(500).json({error: "Failed to create flow"});
  }
});

app.put("/api/flows/:flowId", async (req, res) => {
  try {
    const userId = await requireUserId(req, res);
    if (!userId) return;
    const flowRef = flowCollection(userId).doc(req.params.flowId);
    if (!(await flowRef.get()).exists) return res.status(404).json({error: "Flow not found"});
    const {...updates} = req.body;
    await flowRef.set({...updates, updatedAt: FieldValue.serverTimestamp()}, {merge: true});
    res.json(serializeDocument(await flowRef.get()));
  } catch (error) {
    res.status(500).json({error: "Failed to update flow"});
  }
});

app.delete("/api/flows/:flowId", async (req, res) => {
  try {
    const userId = await requireUserId(req, res);
    if (!userId) return;
    const flowRef = flowCollection(userId).doc(req.params.flowId);
    if (!(await flowRef.get()).exists) return res.status(404).json({error: "Flow not found"});
    await flowRef.delete();
    res.json({success: true});
  } catch (error) {
    res.status(500).json({error: "Failed to delete flow"});
  }
});

app.get("/api/user/profile", async (req, res) => {
  try {
    const userId = await requireUserId(req, res);
    if (!userId) return;
    const profileRef = profileDocument(userId);
    let profileSnapshot = await profileRef.get();
    if (!profileSnapshot.exists) {
      const firebaseUser = await firebaseAuth.getUser(userId);
      await profileRef.set({
        ...getDefaultProfile(userId, firebaseUser),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      profileSnapshot = await profileRef.get();
    }
    res.json(serializeDocument(profileSnapshot));
  } catch (error) {
    res.status(500).json({error: "Failed to load profile"});
  }
});

app.put("/api/user/profile", async (req, res) => {
  try {
    const userId = await requireUserId(req, res);
    if (!userId) return;
    const profileRef = profileDocument(userId);
    const currentSnapshot = await profileRef.get();
    const currentProfile = currentSnapshot.exists ? currentSnapshot.data() : getDefaultProfile(userId, {});
    const {subscription, notifications, ...safeUpdates} = req.body;
    await profileRef.set({
      ...currentProfile,
      ...safeUpdates,
      uid: userId,
      email: currentProfile.email || "",
      apiKeys: currentProfile.apiKeys || [],
      subscription: {...currentProfile.subscription, ...subscription},
      notifications: {...currentProfile.notifications, ...notifications},
      updatedAt: FieldValue.serverTimestamp(),
    }, {merge: true});
    res.json(serializeDocument(await profileRef.get()));
  } catch (error) {
    res.status(500).json({error: "Failed to update profile"});
  }
});

app.get("/api/connectors", async (req, res) => {
  try {
    const userId = await requireUserId(req, res);
    if (!userId) return;
    const sourceSnapshot = await dataSourceCollection(userId).get();
    if (sourceSnapshot.empty) {
      const batch = db.batch();
      getDefaultDataSources().forEach((source) => batch.set(dataSourceCollection(userId).doc(source.id), {
        ...source,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }));
      await batch.commit();
      return res.json(getDefaultDataSources());
    }
    res.json(sourceSnapshot.docs.map(serializeDocument));
  } catch (error) {
    res.status(500).json({error: "Failed to load connectors"});
  }
});

app.put("/api/connectors/:connectorId", async (req, res) => {
  try {
    const userId = await requireUserId(req, res);
    if (!userId) return;
    const sourceRef = dataSourceCollection(userId).doc(req.params.connectorId);
    if (!(await sourceRef.get()).exists) return res.status(404).json({error: "Connector not found"});
    const currentSource = (await sourceRef.get()).data();
    await sourceRef.set({
      ...req.body,
      config: {...currentSource.config, ...req.body.config},
      updatedAt: FieldValue.serverTimestamp(),
    }, {merge: true});
    res.json(serializeDocument(await sourceRef.get()));
  } catch (error) {
    res.status(500).json({error: "Failed to update connector"});
  }
});

app.post("/api/connectors/google-sheets/verify", async (req, res) => {
  try {
    const userId = await requireUserId(req, res);
    if (!userId) return;

    const {spreadsheetId} = req.body;
    if (!spreadsheetId || typeof spreadsheetId !== "string" || !spreadsheetId.trim()) {
      return res.status(400).json({error: "Spreadsheet ID or URL is required"});
    }

    // Extract and sanitize spreadsheet ID (handles both URLs and raw IDs)
    let sanitizedId;
    try {
      sanitizedId = googleSheets.extractSpreadsheetId(spreadsheetId);
    } catch (extractError) {
      return res.status(400).json({error: extractError.message});
    }

    // Verify access
    let result;
    try {
      result = await googleSheets.verifyAccess(sanitizedId);
    } catch (verifyError) {
      const message = verifyError.message || "Failed to verify Google Sheet access";
      if (message.includes("Permission denied")) {
        return res.status(403).json({error: message});
      }
      if (message.includes("not found") || message.includes("does not exist")) {
        return res.status(404).json({error: message});
      }
      return res.status(500).json({error: message});
    }

    // Save it if successful
    const sourceRef = dataSourceCollection(userId).doc("google-sheets");
    await sourceRef.set({
      connected: true,
      config: {spreadsheetId: sanitizedId},
      updatedAt: FieldValue.serverTimestamp(),
    }, {merge: true});

    return res.json({
      success: true,
      title: result.title,
      spreadsheetId: sanitizedId,
      message: "Google Sheet connected successfully!",
    });
  } catch (error) {
    console.error("[Google Sheets Verify Error]:", error);
    return res.status(500).json({error: "An unexpected error occurred while verifying the Google Sheet"});
  }
});

app.post("/api/connectors/google-sheets/analyze", async (req, res) => {
  try {
    const userId = await requireUserId(req, res);
    if (!userId) return;

    // Allow spreadsheetId from request body OR fall back to stored config
    let spreadsheetId;
    if (req.body.spreadsheetId && typeof req.body.spreadsheetId === "string" && req.body.spreadsheetId.trim()) {
      try {
        spreadsheetId = googleSheets.extractSpreadsheetId(req.body.spreadsheetId);
      } catch (extractError) {
        return res.status(400).json({error: extractError.message});
      }
    } else {
      const sourceRef = dataSourceCollection(userId).doc("google-sheets");
      const sourceDoc = await sourceRef.get();
      if (!sourceDoc.exists || !sourceDoc.data().connected || !sourceDoc.data().config?.spreadsheetId) {
        return res.status(400).json({
          error: "No Google Sheet connected. Please provide a spreadsheetId or connect a Google Sheet first.",
        });
      }
      spreadsheetId = sourceDoc.data().config.spreadsheetId;
    }

    // Read rows from the sheet
    let sheetData;
    try {
      sheetData = await googleSheets.readSheetRows(spreadsheetId);
    } catch (readError) {
      const message = readError.message || "Failed to read Google Sheet";
      if (message.includes("Permission denied")) {
        return res.status(403).json({error: message});
      }
      if (message.includes("not found") || message.includes("does not exist")) {
        return res.status(404).json({error: message});
      }
      return res.status(500).json({error: message});
    }

    const {rows, isEmpty} = sheetData;
    if (isEmpty || !rows || rows.length === 0) {
      return res.status(400).json({
        error: "Google Sheet contains no data rows in Sheet1. Please add data and try again.",
      });
    }

    const results = [];
    const classificationsToWrite = [];

    for (let i = 0; i < Math.min(rows.length, 50); i++) {
      const row = rows[i];
      const name = row["Name"] || row["Full Name"] || row["First Name"] || row["name"] || "";
      const email = row["Email"] || row["Email Address"] || row["email"] || "";
      const company = row["Company"] || row["Organization"] || row["company"] || "";
      const message = row["Message"] || row["Inquiry"] || row["Notes"] || row["Description"] ||
          row["message"] || JSON.stringify(row);

      const inquiryData = {name, email, company, message};

      let classification = {
        intent: "purchase",
        urgency: "high",
        fit_score: 8,
        summary: "Imported and classified from Google Sheet.",
      };

      if (MAKE_WEBHOOK_URL) {
        try {
          const workflowResponse = await requestWebhook(MAKE_WEBHOOK_URL, {
            body: {...inquiryData, receivedAt: new Date().toISOString(), source: "google_sheets_bulk"},
          });
          if (workflowResponse?.classification) {
            classification = workflowResponse.classification;
          }
        } catch (err) {
          console.error("[Make Webhook Sheet Error]", err);
        }
      }

      const item = {
        row: i + 1,
        ...inquiryData,
        intent: classification.intent || "general",
        urgency: classification.urgency || "medium",
        fit_score: classification.fit_score || 5,
        summary: classification.summary || "",
        status: "classified",
      };

      results.push(item);
      classificationsToWrite.push(classification);
    }

    try {
      await googleSheets.writeClassificationsToSheet(spreadsheetId, classificationsToWrite);
    } catch (writeErr) {
      console.error("[Sheet Writeback Error]", writeErr);
    }

    return res.json({
      success: true,
      title: `Analyzed ${results.length} rows`,
      message: `Successfully analyzed ${results.length} of ${rows.length} rows`,
      totalRows: rows.length,
      processedRows: results.length,
      results,
      spreadsheetId,
    });
  } catch (error) {
    console.error("[Google Sheets Analysis Error]:", error);
    return res.status(500).json({error: "An unexpected error occurred while analyzing the Google Sheet"});
  }
});

app.post("/api/webhook/:webhookId", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Webhook received and processed successfully",
    receivedAt: new Date().toISOString(),
    webhookId: req.params.webhookId,
  });
});

app.post("/api/onboarding/generate-key", async (req, res) => {
  try {
    const userId = await requireUserId(req, res);
    if (!userId) return;

    const existingKeyDoc = await db.collection("apiKeys")
        .where("customerId", "==", userId)
        .where("active", "==", true)
        .limit(1)
        .get();

    if (!existingKeyDoc.empty) {
      const keyData = existingKeyDoc.docs[0].data();
      return res.json({
        apiKey: keyData.key,
        businessName: keyData.businessName,
        plan: keyData.plan,
        createdAt: serializeFirestoreValue(keyData.createdAt),
      });
    }

    const newApiKey = generateApiKey();
    const newKeyDoc = {
      key: newApiKey,
      customerId: userId,
      businessName: "",
      plan: "starter",
      active: true,
      totalInquiries: 0,
      createdAt: FieldValue.serverTimestamp(),
      lastUsedAt: FieldValue.serverTimestamp(),
    };

    await db.collection("apiKeys").add(newKeyDoc);

    return res.status(201).json({
      apiKey: newApiKey,
      businessName: "",
      plan: "starter",
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error generating API key:", error);
    res.status(500).json({error: "Failed to generate API key"});
  }
});

app.get("/api/onboarding/status", async (req, res) => {
  try {
    const userId = await requireUserId(req, res);
    if (!userId) return;

    const keyDoc = await db.collection("apiKeys")
        .where("customerId", "==", userId)
        .where("active", "==", true)
        .limit(1)
        .get();

    if (keyDoc.empty) {
      return res.json({
        hasApiKey: false,
        totalInquiries: 0,
      });
    }

    const keyData = keyDoc.docs[0].data();
    return res.json({
      hasApiKey: true,
      apiKey: keyData.key,
      businessName: keyData.businessName,
      plan: keyData.plan,
      totalInquiries: keyData.totalInquiries || 0,
      createdAt: serializeFirestoreValue(keyData.createdAt),
    });
  } catch (error) {
    console.error("Error getting onboarding status:", error);
    res.status(500).json({error: "Failed to get onboarding status"});
  }
});

app.put("/api/onboarding/business-name", async (req, res) => {
  try {
    const userId = await requireUserId(req, res);
    if (!userId) return;

    const {businessName} = req.body;
    if (!businessName || typeof businessName !== "string") {
      return res.status(400).json({error: "businessName must be a non-empty string"});
    }
    if (businessName.length > 100) {
      return res.status(400).json({error: "businessName must be under 100 characters"});
    }

    const keyQuery = await db.collection("apiKeys")
        .where("customerId", "==", userId)
        .where("active", "==", true)
        .limit(1)
        .get();

    if (keyQuery.empty) {
      return res.status(404).json({error: "No active API key found"});
    }

    await keyQuery.docs[0].ref.update({
      businessName,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return res.json({success: true, businessName});
  } catch (error) {
    console.error("Error updating business name:", error);
    res.status(500).json({error: "Failed to update business name"});
  }
});

app.post("/api/analyze/upload", async (req, res) => {
  try {
    const userId = await requireUserId(req, res);
    if (!userId) return;

    if (!await checkRateLimit(userId, 5, 60000)) {
      return res.status(429).json({error: "Too many uploads. Please wait before uploading again."});
    }

    // Validate API key for customer tracking
    const customer = await validateApiKey(req);

    // Parse the uploaded file
    const {fileBuffer, fileName} = await parseFileUpload(req);

    if (!fileBuffer || fileBuffer.length === 0) {
      return res.status(400).json({error: "No file uploaded"});
    }

    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
    if (fileBuffer.length > MAX_FILE_SIZE) {
      return res.status(413).json({error: `File exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`});
    }

    // Parse the spreadsheet
    let rows;
    try {
      rows = parseSpreadsheet(fileBuffer, fileName);
    } catch (parseError) {
      return res.status(400).json({error: `Failed to parse file: ${parseError.message}`});
    }

    if (!rows || rows.length === 0) {
      return res.status(400).json({error: "File contains no data rows"});
    }

    // Limit rows based on plan (starter: 50, pro: 500, enterprise: unlimited)
    const plan = customer?.plan || "starter";
    let maxRows = 50; // default
    if (plan === "pro") maxRows = 500;
    if (plan === "enterprise") maxRows = 10000;
    const limitedRows = rows.slice(0, maxRows);
    const wasLimited = rows.length > maxRows;

    // Create batch record in Firestore
    const batchId = crypto.randomBytes(8).toString("hex");
    const batchRef = db.collection("analyses").doc(batchId);
    await batchRef.set({
      userId,
      customerId: customer?.customerId || userId,
      businessName: customer?.businessName || "",
      fileName,
      totalRows: rows.length,
      processedRows: 0,
      status: "processing",
      createdAt: FieldValue.serverTimestamp(),
    });

    // Process each row through the n8n pipeline
    const results = [];
    for (let i = 0; i < limitedRows.length; i++) {
      const row = limitedRows[i];

      // Skip rows with no meaningful data (all empty values)
      const hasData = Object.values(row).some((v) => v !== null && v !== undefined && String(v).trim() !== "");
      if (!hasData) {
        results.push({raw_data: row, row: i + 1, status: "skipped", reason: "Empty row"});
        continue;
      }

      try {
        if (MAKE_WEBHOOK_URL) {
          const enrichedBody = {
            raw_data: row,
            ...(customer ? {
              customerId: customer.customerId,
              businessName: customer.businessName,
              plan: customer.plan,
            } : {}),
            receivedAt: new Date().toISOString(),
            source: "bulk_upload",
            batchId,
          };

          const webhookResponse = await requestWebhook(MAKE_WEBHOOK_URL, {body: enrichedBody});
          const classification = webhookResponse?.classification || {};

          // If a spreadsheet is provided, write to it
          if (req.body.spreadsheetId) {
            try {
              await googleSheets.appendRow(req.body.spreadsheetId, {
                ...row,
                ...classification,
              });
            } catch (err) {
              console.error("[Google Sheets] Bulk upload append failed for row:", err);
            }
          }

          results.push({
            row: i + 1,
            raw_data: row,
            name: classification.extracted_name || classification.name || "",
            email: classification.extracted_email || classification.email || "",
            company: classification.extracted_company || classification.company || "",
            intent: classification.intent || "general",
            urgency: classification.urgency || "medium",
            fit_score: classification.fit_score || 5,
            summary: classification.summary || "",
            suggested_action: classification.suggested_action || "",
            category: classification.category || "unknown",
            status: "classified",
          });
        } else {
          results.push({raw_data: row, row: i + 1, status: "error", reason: "Workflow not configured"});
        }
      } catch (err) {
        results.push({raw_data: row, row: i + 1, status: "error", reason: err.message});
      }

      // Update progress every 5 rows
      if ((i + 1) % 5 === 0 || i === limitedRows.length - 1) {
        await batchRef.update({processedRows: i + 1});
      }
    }

    // Mark batch as complete and store results
    await batchRef.update({
      status: "completed",
      processedRows: limitedRows.length,
      completedAt: FieldValue.serverTimestamp(),
    });

    // Store results as a subcollection (in chunks if large)
    const resultChunkSize = 100;
    for (let i = 0; i < results.length; i += resultChunkSize) {
      const chunk = results.slice(i, i + resultChunkSize);
      await batchRef.collection("results").doc(`chunk_${Math.floor(i / resultChunkSize)}`).set({items: chunk});
    }

    // Track usage if API key was used
    if (customer) {
      const keyQuery = await db.collection("apiKeys")
          .where("customerId", "==", customer.customerId)
          .where("active", "==", true)
          .limit(1).get();
      if (!keyQuery.empty) {
        await keyQuery.docs[0].ref.update({
          totalInquiries: FieldValue.increment(limitedRows.length),
          lastUsedAt: FieldValue.serverTimestamp(),
        });
      }
    }

    return res.json({
      batchId,
      fileName,
      totalRows: rows.length,
      processedRows: limitedRows.length,
      wasLimited,
      maxRows,
      results,
    });
  } catch (error) {
    console.error("Error in bulk analysis:", error);
    res.status(500).json({error: "Failed to process file: " + error.message});
  }
});

app.get("/api/analyze/history", async (req, res) => {
  try {
    const userId = await requireUserId(req, res);
    if (!userId) return;

    const snapshot = await db.collection("analyses")
        .where("userId", "==", userId)
        .orderBy("createdAt", "desc")
        .limit(20)
        .get();

    const analyses = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: serializeFirestoreValue(doc.data().createdAt),
      completedAt: serializeFirestoreValue(doc.data().completedAt),
    }));

    return res.json({analyses});
  } catch (error) {
    console.error("Error fetching analysis history:", error);
    res.status(500).json({error: "Failed to fetch analysis history"});
  }
});

app.get("/api/analyze/:batchId", async (req, res) => {
  try {
    const userId = await requireUserId(req, res);
    if (!userId) return;

    const batchDoc = await db.collection("analyses").doc(req.params.batchId).get();
    if (!batchDoc.exists) {
      return res.status(404).json({error: "Analysis not found"});
    }

    const batchData = batchDoc.data();
    if (batchData.userId !== userId) {
      return res.status(403).json({error: "Access denied"});
    }

    // Get all result chunks
    const resultsSnapshot = await batchDoc.ref.collection("results").get();
    let results = [];
    resultsSnapshot.docs.forEach((doc) => {
      results = results.concat(doc.data().items || []);
    });

    return res.json({
      id: batchDoc.id,
      ...batchData,
      createdAt: serializeFirestoreValue(batchData.createdAt),
      completedAt: serializeFirestoreValue(batchData.completedAt),
      results,
    });
  } catch (error) {
    console.error("Error fetching analysis:", error);
    res.status(500).json({error: "Failed to fetch analysis"});
  }
});

app.get("/api/user/tier", async (req, res) => {
  try {
    const userId = await requireUserId(req, res);
    if (!userId) return;

    const userDoc = await db.collection("users").doc(userId).get();
    const tier = userDoc.data()?.tier || "free";

    return res.json({tier, userId});
  } catch (error) {
    console.error("Error fetching user tier:", error);
    res.status(500).json({error: "Failed to fetch user tier"});
  }
});

app.post("/api/user/redeem-key", async (req, res) => {
  try {
    const userId = await requireUserId(req, res);
    if (!userId) return;

    const {key} = req.body || {};
    if (typeof key !== "string" || key.length === 0) {
      return res.status(400).json({error: "A 'key' string is required."});
    }

    const userRef = db.collection("users").doc(userId);

    const tier = await db.runTransaction(async (transaction) => {
      const keySnapshot = await db.collection("apiKeys").where("key", "==", key).limit(1).get();

      if (keySnapshot.empty) {
        const err = new Error("The access key you provided does not exist.");
        err.status = 404;
        throw err;
      }

      const accessKeyRef = keySnapshot.docs[0].ref;
      const keyData = keySnapshot.docs[0].data();
      // Handle redeemed stored as boolean OR string "true"
      if (keyData.redeemed === true || keyData.redeemed === "true") {
        const err = new Error("This access key has already been redeemed.");
        err.status = 409;
        throw err;
      }

      transaction.update(accessKeyRef, {
        redeemed: true,
        redeemedBy: userId,
        redeemedAt: FieldValue.serverTimestamp(),
      });
      transaction.set(userRef, {tier: keyData.tier}, {merge: true});
      return keyData.tier;
    });

    await db.collection("auditLogs").add({
      action: "key_redeemed",
      userId,
      tier,
      keyId: key,
      timestamp: FieldValue.serverTimestamp(),
    });

    return res.json({success: true, tier});
  } catch (error) {
    console.error("Error redeeming key:", error);
    const status = error.status || 500;
    return res.status(status).json({error: error.message || "Failed to redeem key."});
  }
});

exports.api = onRequest({invoker: "public"}, app);

