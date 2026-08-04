
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import dotenv from 'dotenv';
import express from 'express';
import { GoogleAuth } from 'google-auth-library';
import fetch from 'node-fetch';
import rateLimit from 'express-rate-limit';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';

import cors from 'cors';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env.local') });

initializeApp();
const firestore = getFirestore();
const firebaseAuth = getAuth();

const app = express();
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
app.use(express.json({limit: process?.env?.API_PAYLOAD_MAX_SIZE || "7mb"}));

const PORT = process?.env?.API_BACKEND_PORT || 5000;
const API_BACKEND_HOST = process?.env?.API_BACKEND_HOST || "127.0.0.1";

const GOOGLE_CLOUD_LOCATION = process?.env?.GOOGLE_CLOUD_LOCATION;
const GOOGLE_CLOUD_PROJECT = process?.env?.GOOGLE_CLOUD_PROJECT;
const PROXY_HEADER = process?.env?.PROXY_HEADER;
const N8N_INQUIRY_WEBHOOK_URL = process?.env?.N8N_INQUIRY_WEBHOOK_URL;
const N8N_CUSTOMERS_WEBHOOK_URL = process?.env?.N8N_CUSTOMERS_WEBHOOK_URL;
const N8N_FLOW_TEST_WEBHOOK_URL = process?.env?.N8N_FLOW_TEST_WEBHOOK_URL;
const N8N_WEBHOOK_AUTH_TOKEN = process?.env?.N8N_WEBHOOK_AUTH_TOKEN;
const N8N_REQUEST_TIMEOUT_MS = Number(process?.env?.N8N_REQUEST_TIMEOUT_MS || 10000);
const isVertexProxyConfigured = Boolean(
  GOOGLE_CLOUD_PROJECT && GOOGLE_CLOUD_LOCATION && PROXY_HEADER
);

if (!isVertexProxyConfigured) {
  console.warn('Vertex AI proxy is disabled: Google Cloud environment variables are not configured.');
}

function getN8nHeaders() {
  return {
    'Content-Type': 'application/json',
    ...(N8N_WEBHOOK_AUTH_TOKEN ? { Authorization: `Bearer ${N8N_WEBHOOK_AUTH_TOKEN}` } : {}),
  };
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function isValidEmail(email) {
  return /^\S+@\S+\.\S+$/.test(email);
}

async function requestN8n(webhookUrl, { method = 'POST', body } = {}) {
  const timeoutController = new AbortController();
  const timeout = setTimeout(() => timeoutController.abort(), N8N_REQUEST_TIMEOUT_MS);

  try {
    let response = await fetch(webhookUrl, {
      method,
      headers: getN8nHeaders(),
      body: body ? JSON.stringify(body) : undefined,
      signal: timeoutController.signal,
    });

    // If test webhook URL returned 404, automatically try production webhook URL
    if (response.status === 404 && webhookUrl.includes('/webhook-test/')) {
      const prodUrl = webhookUrl.replace('/webhook-test/', '/webhook/');
      response = await fetch(prodUrl, {
        method,
        headers: getN8nHeaders(),
        body: body ? JSON.stringify(body) : undefined,
        signal: timeoutController.signal,
      });
    }

    const responseText = await response.text();
    let data = responseText;

    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch {
      // Some n8n Webhook Response nodes intentionally return plain text.
    }

    if (!response.ok) {
      const error = new Error(data?.message || data?.error || `n8n responded with status ${response.status}`);
      error.status = response.status;
      throw error;
    }

    return data;
  } finally {
    clearTimeout(timeout);
  }
}

function getFirstValue(source, keys, fallback = '') {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null && value !== '') return String(value);
  }
  return fallback;
}

function normalizeCustomers(payload) {
  const records = Array.isArray(payload)
    ? payload
    : payload?.customers || payload?.records || payload?.data || [];

  if (!Array.isArray(records)) return [];

  return records.map((record, index) => {
    const fields = record?.fields || record || {};
    return {
      id: getFirstValue(record, ['id'], String(index + 1)),
      name: getFirstValue(fields, ['name', 'Name', 'fullName', 'Full Name'], 'Unnamed lead'),
      email: getFirstValue(fields, ['email', 'Email', 'emailAddress', 'Email Address'], '—'),
      status: getFirstValue(fields, ['status', 'Status', 'leadStatus', 'Lead Status'], 'New'),
      last_active: getFirstValue(
        fields,
        ['last_active', 'Last Active', 'updatedAt', 'Updated At', 'createdAt', 'Created At'],
        record?.createdTime || 'Just now'
      ),
    };
  });
}

app.set('trust proxy', 1 /* number of proxies between user and server */);

// IMPORTANT: Vertex AI Studio Rate Limiting
// This rate limiting configuration protects your backend APIs from abuse.
// Removing it exposes your service to DoS attacks and unexpected costs.
const proxyLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // Set ratelimit window at 15min (in ms)
    max: 100, // Limit each IP to 100 requests per window 
    standardHeaders: true, // Return rate limit info in the "RateLimit-*" headers
    legacyHeaders: false, // no "X-RateLimit-*" headers
    message: {
      error: 'Too many requests',
      message: 'You have exceed the request limit, please try again later.'
    },
});
// Apply the rate limiter to the /api-proxy route before the main proxy logic
app.use('/api-proxy', proxyLimiter);

const API_CLIENT_MAP = [
 {
    name: "VertexGenAi:generateContent",
    patternForProxy: "https://aiplatform.googleapis.com/{{version}}/publishers/google/models/{{model}}:generateContent",
    getApiEndpoint: (context, params) => {
      return `https://aiplatform.clients6.google.com/${params['version']}/projects/${context.projectId}/locations/${context.region}/publishers/google/models/${params['model']}:generateContent`;
    },
    isStreaming: false,
    transformFn: null,
  },
 {
    name: "VertexGenAi:predict",
    patternForProxy: "https://aiplatform.googleapis.com/{{version}}/publishers/google/models/{{model}}:predict",
    getApiEndpoint: (context, params) => {
      return `https://aiplatform.clients6.google.com/${params['version']}/projects/${context.projectId}/locations/${context.region}/publishers/google/models/${params['model']}:predict`;
    },
    isStreaming: false,
    transformFn: null,
  },
 {
    name: "VertexGenAi:streamGenerateContent",
    patternForProxy: "https://aiplatform.googleapis.com/{{version}}/publishers/google/models/{{model}}:streamGenerateContent",
    getApiEndpoint: (context, params) => {
      return `https://aiplatform.clients6.google.com/${params['version']}/projects/${context.projectId}/locations/${context.region}/publishers/google/models/${params['model']}:streamGenerateContent`;
    },
    isStreaming: true,
    transformFn: (response) => {
        let normalizedResponse = response.trim();
        while (normalizedResponse.startsWith(',') || normalizedResponse.startsWith('[')) {
          normalizedResponse = normalizedResponse.substring(1).trim();
        }
        while (normalizedResponse.endsWith(',') || normalizedResponse.endsWith(']')) {
          normalizedResponse = normalizedResponse.substring(0, normalizedResponse.length - 1).trim();
        }

        if (!normalizedResponse.length) {
          return {result: null, inProgress: false};
        }

        if (!normalizedResponse.endsWith('}')) {
          return {result: normalizedResponse, inProgress: true};
        }

        try {
          const parsedResponse = JSON.parse(`${normalizedResponse}`);
          const transformedResponse = `data: ${JSON.stringify(parsedResponse)}\n\n`;
          return {result: transformedResponse, inProgress: false};
        } catch (error) {
          throw new Error(`Failed to parse response: ${error}.`);
        }
    },
  },
].map((client) => ({ ...client, patternInfo: parsePattern(client.patternForProxy) }));

// IMPORTANT: Vertex AI Studio SSRF Protection
// The set below is the exhaustive allow-list of upstream hostnames this
// proxy may forward authenticated requests to. It is sourced at code
// generation time from the RestApiClient.getAllowedUpstreamHosts() of every
// client embedded in API_CLIENT_MAP. Removing, weakening, or widening this
// check (for example, by adding wildcards or computing entries from request
// data) re-introduces the SSRF vulnerability that allows the deployed
// service account's OAuth access token to be exfiltrated to an
// attacker-controlled host.
const ALLOWED_UPSTREAM_HOSTS = new Set([
  "aiplatform.clients6.google.com",
]);

// Uses Google Application Default Credentials (ADC).
// Users need to run "gcloud auth application-default login" in order to use the proxy.
const auth = new GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/cloud-platform'],
});

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parsePattern(pattern) {
  const paramRegex = /\{\{(.*?)\}\}/g;
  const params = [];
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = paramRegex.exec(pattern)) !== null) {
    params.push(match[1]);
    const literalPart = pattern.substring(lastIndex, match.index);
    parts.push(escapeRegex(literalPart));
    parts.push(`(?<${match[1]}>[^/]+)`);
    lastIndex = paramRegex.lastIndex;
  }
  parts.push(escapeRegex(pattern.substring(lastIndex)));
  const regexString = parts.join('');

  return {regex: new RegExp(`^${regexString}$`), params};
}

function extractParams(patternInfo, url) {
  const match = url.match(patternInfo.regex);
  if (!match) return null;
  const params = {};
  patternInfo.params.forEach((paramName, index) => {
    params[paramName] = match[index + 1];
  });
  return params;
}

async function getAccessToken(res) {
  try {
    const authClient = await auth.getClient();
    const token = await authClient.getAccessToken();
    return token.token;
  } catch (error) {
    console.error('[Node Proxy] Authentication error:', error);
    if (!res) return null;
    if (error.code === 'ERR_GCLOUD_NOT_LOGGED_IN' || (error.message && error.message.includes('Could not load the default credentials'))) {
      res.status(401).json({
        error: 'Authentication Required',
        message: 'Google Cloud Application Default Credentials not found or invalid. Please run "gcloud auth application-default login" and try again.',
      });
    } else {
      res.status(500).json({ error: `Authentication failed: ${error.message}` });
    }
    return null;
  }
}

function getRequestHeaders(accessToken) {
  return {
    'Authorization': `Bearer ${accessToken}`,
    'X-Goog-User-Project': GOOGLE_CLOUD_PROJECT,
    'Content-Type': 'application/json',
  };
}

// --- Proxy Endpoint ---
app.post('/api-proxy', async (req, res) => {

  if (!isVertexProxyConfigured) {
    return res.status(503).json({
      error: 'Vertex AI proxy is not configured.',
      message: 'Set GOOGLE_CLOUD_PROJECT, GOOGLE_CLOUD_LOCATION, and PROXY_HEADER to enable it.',
    });
  }

  // Check for the custom header added by the shim
  if (req.headers['x-app-proxy'] !== PROXY_HEADER) {
    return res.status(403).send('Forbidden: Request must originate from the Vertex App shim.');
  }

  const { originalUrl, method, headers, body } = req.body;
  if (!originalUrl) {
    return res.status(400).send('Bad Request: originalUrl is required.');
  }

  // 1. Find the matching API client
  const apiClient = API_CLIENT_MAP.find(p => {
    // We store extractedParams on req for use later if needed, though getVertexUrl takes it as arg.
    req.extractedParams = extractParams(p.patternInfo, originalUrl);
    return req.extractedParams !== null;
  });

  if (!apiClient) {
    console.error(`[Node Proxy] No API client handler found for URL: ${originalUrl}`);
    return res.status(404).json({ error: `No proxy handler found for URL: ${originalUrl}` });
  }

  const extractedParams = req.extractedParams;
  console.log(`[Node Proxy] Matched API client: ${apiClient.name}`);
  try {
    // 2. Get authenticated access token
    const accessToken = await getAccessToken(res);
    if (!accessToken) return;

    // 3. Construct the full API URL using env-set GOOGLE_CLOUD_PROJECT/LOCATION and extracted params
    const context = {projectId: GOOGLE_CLOUD_PROJECT, region: GOOGLE_CLOUD_LOCATION};
    const apiUrl = apiClient.getApiEndpoint(context, extractedParams);

    // IMPORTANT: Vertex AI Studio SSRF Protection
    // Parse the constructed apiUrl with the standard URL parser (not a
    // regex) and require the resulting hostname to be in the hardcoded
    // ALLOWED_UPSTREAM_HOSTS set. This neutralizes attacks that smuggle a
    // URL-grammar delimiter (e.g. '#') into a pattern parameter to redirect
    // the authenticated upstream request to an attacker-controlled host.
    let parsedApiUrl;
    try {
      parsedApiUrl = new URL(apiUrl);
    } catch (e) {
      console.error(`[Node Proxy] Invalid API URL: ${apiUrl}`);
      return res.status(400).json({ error: 'Invalid API URL.' });
    }
    if (!ALLOWED_UPSTREAM_HOSTS.has(parsedApiUrl.hostname.toLowerCase())) {
      console.error(`[Node Proxy] Upstream host not allowed: ${parsedApiUrl.hostname}`);
      return res.status(400).json({ error: 'Upstream host not allowed.' });
    }
    console.log(`[Node Proxy] Forwarding to Vertex API: ${apiUrl}`);

    // 4. Prepare headers for the API call
    const apiHeaders = getRequestHeaders(accessToken);

    const apiFetchOptions = {
      method: method || 'POST',
      headers: {...apiHeaders, ...headers},
      body: body ? body : undefined,
    };

    // 5. Make the call to the API
    const apiResponse = await fetch(apiUrl, apiFetchOptions);

    // 6. Respond to the client based on stream type
    if (apiClient.isStreaming) {
      console.log(`[Node Proxy] Sending STREAMING response for ${apiClient.name}`);
      // Set headers for a streaming JSON response
      res.writeHead(apiResponse.status, {
        'Content-Type': 'text/event-stream',
        'Transfer-Encoding': 'chunked',
        'Connection': 'keep-alive',
      });
      // Immediately send headers
      res.flushHeaders();

      if (!apiResponse.body) {
        console.error('[Node Proxy] Streaming response has no body.');
        return res.end(JSON.stringify({ error: 'Streaming response body is null' }));
      }

      const decoder = new TextDecoder();
      let deltaChunk = '';
      apiResponse.body.on('data', (encodedChunk) => {
        if (res.writableEnded) return; // Prevent writing after res.end()

        try {
          if (!apiClient.transformFn) {
            res.write(encodedChunk);
          } else {
            const decodedChunk = decoder.decode(encodedChunk, { stream: true });
            deltaChunk = deltaChunk + decodedChunk;

            const {result, inProgress} = apiClient.transformFn(deltaChunk);
            if (result && !inProgress) {
              deltaChunk = '';
              res.write(new TextEncoder().encode(result));
            }
          }
        } catch (error) {
          console.error(`[Node Proxy] Error processing streaming response for ${apiClient.name}`);
          console.error(error);
        }
      });

      apiResponse.body.on('end', () => {
        deltaChunk = '';
        console.log(`[Node Proxy] Vertex stream finished and all data processed for ${apiClient.name}`);
        res.end();
      });

      apiResponse.body.on('error', (streamError) => {
        console.error('[Node Proxy] Error from Vertex stream:', streamError);
        if (!res.writableEnded) {
          res.end(JSON.stringify({ proxyError: 'Stream error from Vertex AI', details: streamError.message }));
        }
      });

      res.on('error', (resError) => {
        console.error('[Node Proxy] Error writing to client response:', resError);
        // The source stream might need to be destroyed if an error occurs here.
        if (apiResponse.body && typeof apiResponse.body.destroy === 'function') {
             apiResponse.body.destroy(resError);
        }
      });
    } else {
      // Non-streaming response handling
      console.log(`[Node Proxy] Sending JSON response for ${apiClient.name}`);
      const data = await apiResponse.json();
      res.status(apiResponse.status).json(data);
    }
  } catch (error) {
    console.error(`[Node Proxy] Error proxying request for ${apiClient.name}`);
    console.error(error)
    res.status(500).json({ error: error });
  }
});

app.post('/api/inquiries', async (req, res) => {
  const { name, email, company, message } = req.body || {};

  if (!name || !email || !company || !message) {
    return res.status(400).json({ error: 'Name, email, company, and message are required.' });
  }

  if (!N8N_INQUIRY_WEBHOOK_URL) {
    return res.status(503).json({
      error: 'Inquiry workflow is not configured.',
      message: 'Set N8N_INQUIRY_WEBHOOK_URL in backend/.env.local.',
    });
  }

  try {
    const workflowResponse = await requestN8n(N8N_INQUIRY_WEBHOOK_URL, { body: req.body });
    return res.status(202).json({ accepted: true, workflowResponse });
  } catch (error) {
    console.error('[n8n] Inquiry workflow failed:', error);
    return res.status(502).json({ error: 'The inquiry workflow could not be reached.' });
  }
});

app.post('/api/flows/test', async (req, res) => {
  if (!N8N_FLOW_TEST_WEBHOOK_URL) {
    return res.status(503).json({ error: 'Flow test workflow is not configured.' });
  }

  try {
    const workflowResponse = await requestN8n(N8N_FLOW_TEST_WEBHOOK_URL, { body: req.body });
    return res.json(workflowResponse);
  } catch (error) {
    console.error('[n8n] Flow test workflow failed:', error);
    return res.status(502).json({ error: 'The flow test workflow could not be reached.' });
  }
});

app.get('/api/customers', async (req, res) => {
  try {
    const userId = await requireUserId(req, res);
    if (!userId) return;
    if (N8N_CUSTOMERS_WEBHOOK_URL) {
      const workflowResponse = await requestN8n(N8N_CUSTOMERS_WEBHOOK_URL, { method: 'GET' });
      res.set('X-NodalX-Data-Source', 'n8n-airtable');
      return res.json(normalizeCustomers(workflowResponse));
    }

    return res.status(503).json({
      error: 'Inquiry source is not configured.',
      message: 'Set N8N_CUSTOMERS_WEBHOOK_URL to load live inquiries.',
    });
  } catch (error) {
    console.error('[Server Error] Loading customers failed:', error);
    return res.status(502).json({ error: 'Failed to load customer data from the workflow.' });
  }
});

// ===== NEW API ENDPOINTS FOR DASHBOARD LIVE DATA =====

const userCollection = (userId) => firestore.collection('users').doc(userId);
const flowCollection = (userId) => userCollection(userId).collection('flows');
const profileDocument = (userId) => userCollection(userId).collection('profile').doc('main');
const dataSourceCollection = (userId) => userCollection(userId).collection('data-sources');

function serializeFirestoreValue(value) {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  return value;
}

function serializeDocument(document) {
  const data = document.data() || {};
  return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, serializeFirestoreValue(value)]));
}

// Initialize default data sources for new users
function getDefaultDataSources() {
  return [
    { id: 'google-sheets', name: 'Google Sheets', connected: false, config: {} },
    { id: 'webhooks', name: 'Webhooks', connected: false, config: { url: '/api/inquiries' } },
    { id: 'postgres', name: 'PostgreSQL', connected: false, config: {} },
    { id: 'firebase', name: 'Firebase', connected: false, config: {} },
  ];
}

// Initialize default profile for new users
function getDefaultProfile(uid, user) {
  return {
    uid,
    displayName: user?.displayName || 'User',
    email: user?.email || '',
    photoURL: user?.photoURL || '',
    workspace: 'My Workspace',
    role: 'Founder',
    timezone: 'UTC',
    notifications: {
      flowFailure: true,
      weeklySummary: true,
      securityAlerts: true,
    },
    subscription: {
      tier: 'free',
      status: 'active',
      executionsUsed: 0,
      executionsLimit: 1000,
      nextInvoiceDate: '',
    },
    apiKeys: [],
  };
}

async function getUserId(req) {
  const authorization = req.headers.authorization || '';
  if (!authorization.startsWith('Bearer ')) {
    const error = new Error('Authentication required');
    error.status = 401;
    throw error;
  }

  const token = authorization.slice('Bearer '.length);
  const decodedToken = await firebaseAuth.verifyIdToken(token);
  return decodedToken.uid;
}

async function requireUserId(req, res) {
  try {
    return await getUserId(req);
  } catch (error) {
    res.status(error.status || 401).json({ error: 'Authentication required' });
    return null;
  }
}

// FLOWS API
app.get('/api/flows', async (req, res) => {
  try {
    const userId = await requireUserId(req, res);
    if (!userId) return;
    const snapshot = await flowCollection(userId).orderBy('createdAt', 'desc').get();
    res.json(snapshot.docs.map(serializeDocument));
  } catch (error) {
    console.error('[Server Error] Loading flows failed:', error);
    res.status(500).json({ error: 'Failed to load flows' });
  }
});

app.post('/api/flows', async (req, res) => {
  try {
    const userId = await requireUserId(req, res);
    if (!userId) return;
    const { name, steps, status = 'inactive' } = req.body;
    
    if (!name || !steps) {
      return res.status(400).json({ error: 'Name and steps are required' });
    }

    const flowRef = flowCollection(userId).doc();
    await flowRef.set({
      id: flowRef.id,
      name,
      steps: Array.isArray(steps) ? steps : [],
      status,
      lastRun: 'Never',
      primaryMetric: '0 Executions',
      actions: Array.isArray(steps) ? steps.length : 0,
      subMetrics: [
        { label: 'Avg Duration', value: '0s' },
        { label: 'Success Rate', value: '0%' },
      ],
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    res.status(201).json(serializeDocument(await flowRef.get()));
  } catch (error) {
    console.error('[Server Error] Creating flow failed:', error);
    res.status(500).json({ error: 'Failed to create flow' });
  }
});

app.put('/api/flows/:flowId', async (req, res) => {
  try {
    const userId = await requireUserId(req, res);
    if (!userId) return;
    const { flowId } = req.params;
    const flowRef = flowCollection(userId).doc(flowId);
    if (!(await flowRef.get()).exists) {
      return res.status(404).json({ error: 'Flow not found' });
    }
    const { id, createdAt, ...updates } = req.body;
    await flowRef.set({ ...updates, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    res.json(serializeDocument(await flowRef.get()));
  } catch (error) {
    console.error('[Server Error] Updating flow failed:', error);
    res.status(500).json({ error: 'Failed to update flow' });
  }
});

app.delete('/api/flows/:flowId', async (req, res) => {
  try {
    const userId = await requireUserId(req, res);
    if (!userId) return;
    const { flowId } = req.params;
    const flowRef = flowCollection(userId).doc(flowId);
    if (!(await flowRef.get()).exists) {
      return res.status(404).json({ error: 'Flow not found' });
    }
    await flowRef.delete();
    res.json({ success: true });
  } catch (error) {
    console.error('[Server Error] Deleting flow failed:', error);
    res.status(500).json({ error: 'Failed to delete flow' });
  }
});

// USER PROFILE API
app.get('/api/user/profile', async (req, res) => {
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
    console.error('[Server Error] Loading profile failed:', error);
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

app.put('/api/user/profile', async (req, res) => {
  try {
    const userId = await requireUserId(req, res);
    if (!userId) return;
    const updates = req.body;
    const profileRef = profileDocument(userId);
    const currentSnapshot = await profileRef.get();
    const currentProfile = currentSnapshot.exists ? currentSnapshot.data() : getDefaultProfile(userId, {});
    const { uid, email, apiKeys, subscription, notifications, ...safeUpdates } = updates;
    await profileRef.set({
      ...currentProfile,
      ...safeUpdates,
      uid: userId,
      email: currentProfile.email || '',
      apiKeys: currentProfile.apiKeys || [],
      subscription: { ...currentProfile.subscription, ...subscription },
      notifications: { ...currentProfile.notifications, ...notifications },
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    res.json(serializeDocument(await profileRef.get()));
  } catch (error) {
    console.error('[Server Error] Updating profile failed:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// DATA SOURCES API
app.get('/api/data-sources', async (req, res) => {
  try {
    const userId = await requireUserId(req, res);
    if (!userId) return;
    const sourceSnapshot = await dataSourceCollection(userId).get();
    if (sourceSnapshot.empty) {
      const batch = firestore.batch();
      getDefaultDataSources().forEach(source => batch.set(dataSourceCollection(userId).doc(source.id), {
        ...source,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }));
      await batch.commit();
      return res.json(getDefaultDataSources());
    }
    res.json(sourceSnapshot.docs.map(serializeDocument));
  } catch (error) {
    console.error('[Server Error] Loading data sources failed:', error);
    res.status(500).json({ error: 'Failed to load data sources' });
  }
});

app.put('/api/data-sources/:sourceId', async (req, res) => {
  try {
    const userId = await requireUserId(req, res);
    if (!userId) return;
    const { sourceId } = req.params;
    const updates = req.body;
    const sourceRef = dataSourceCollection(userId).doc(sourceId);
    if (!(await sourceRef.get()).exists) {
      return res.status(404).json({ error: 'Data source not found' });
    }
    const currentSource = (await sourceRef.get()).data();
    await sourceRef.set({
      ...updates,
      config: { ...currentSource.config, ...updates.config },
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    res.json(serializeDocument(await sourceRef.get()));
  } catch (error) {
    console.error('[Server Error] Updating data source failed:', error);
    res.status(500).json({ error: 'Failed to update data source' });
  }
});

app.post('/api/webhook/:webhookId', (req, res) => {
  const { webhookId } = req.params;
  console.log(`[Webhook Received] ID: ${webhookId}`);
  console.log('[Webhook Payload Body]:', JSON.stringify(req.body, null, 2));
  
  res.status(200).json({
    success: true,
    message: 'Webhook received and processed successfully',
    receivedAt: new Date().toISOString(),
    webhookId
  });
});

const server = app.listen(PORT, API_BACKEND_HOST, () => {
  console.log(`Vertex AI Backend listening at http://localhost:${PORT}`);
});


const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', async (request, socket, head) => {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (url.pathname === '/ws-proxy') {
    
    let targetUrl = url.searchParams.get('target');
    if (!targetUrl) {
      console.log('[Node Proxy] Missing target URL');
      socket.destroy();
      return;
    }

    if (targetUrl === 'wss://aiplatform.googleapis.com//ws/google.cloud.aiplatform.v1beta1.LlmBidiService/BidiGenerateContent') {
      const location = GOOGLE_CLOUD_LOCATION === 'global' ? 'us-central1' : GOOGLE_CLOUD_LOCATION;
      targetUrl = `wss://${location}-aiplatform.googleapis.com//ws/google.cloud.aiplatform.v1beta1.LlmBidiService/BidiGenerateContent`;
    } else {
      console.log('[Node Proxy] Invalid target URL');
      socket.destroy();
      return;
    }

    let accessToken;

    try {
      accessToken = await getAccessToken();
      if (!accessToken) throw new Error('No token');
    } catch (err) {
      console.log('[Node Proxy] Authentication failed');
      socket.destroy();
      return;
    }

    console.log(`[Node Proxy] Initiating upstream connection to: ${targetUrl}`);

    let upstreamWs;

    try {
      upstreamWs = new WebSocket(targetUrl, {
        headers: getRequestHeaders(accessToken)
      });
    } catch (e) {
      console.error('[Node Proxy] Invalid Upstream URL');
      socket.destroy();
      return;
    }

    const initialErrorHandler = (error) => {
      console.error('[Node Proxy] Upstream connection failed:', error);
      upstreamWs.removeEventListener('open', onUpstreamOpen);

      if (socket.writable) {
        socket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n');
        socket.destroy();
      }
    };

    upstreamWs.once('error', initialErrorHandler);

    // 5. Handle Successful Upstream Connection
    const onUpstreamOpen = () => {
      // Remove the "bootstrapping" error handler
      upstreamWs.removeListener('error', initialErrorHandler);

      // Perform the HTTP -> WebSocket upgrade for the Client
      wss.handleUpgrade(request, socket, head, (ws) => {

        upstreamWs.on('message', (data, isBinary) => {
          const logMsg = isBinary ? '<Binary Data>' : data.toString();
          console.log(`[Upstream -> Client] [${new Date().toISOString()}]: ${logMsg}`);

          if (ws.readyState === WebSocket.OPEN) {
            if (data === undefined || data === null) {
              console.warn('[Node Proxy] Attempted to send undefined/null data to client');
              return;
            }
            ws.send(data, { binary: isBinary });
          }
        });

        ws.on('message', (data, isBinary) => {
          const logMsg = isBinary ? '<Binary Data>' : data.toString();

          let dataJson = {};
          try {
            dataJson = JSON.parse(data.toString());
          } catch (error) {
            console.error('[Node Proxy] Failed to parse message from client:', error);
            ws.close(1011, 'Failed to parse message');
          }

          if (dataJson['setup']) {
            dataJson['setup']['model'] = `projects/${GOOGLE_CLOUD_PROJECT}/locations/${GOOGLE_CLOUD_LOCATION}/${dataJson['setup']['model']}`;
          }

          if (upstreamWs.readyState === WebSocket.OPEN) {
            upstreamWs.send(JSON.stringify(dataJson), { binary: false });
          }
        });

        upstreamWs.on('error', (error) => {
          console.error('[Node Proxy] Upstream error:', error);
          ws.close(1011, error.message);
        });

        upstreamWs.on('close', (code, reason) => {
          console.log(`[Node Proxy] Upstream closed: ${code} ${reason}`);
          if (ws.readyState === WebSocket.OPEN) {
            ws.close(code, reason);
          }
        });

        ws.on('error', (error) => {
          console.error('[Node Proxy] Client error:', error);
          upstreamWs.close(1011, error.message);
        });

        ws.on('close', (code, reason) => {
          console.log(`[Node Proxy] Client closed: ${code} ${reason}`);
          if (upstreamWs.readyState === WebSocket.OPEN) {
            upstreamWs.close(1000, reason);
          }
        });

        wss.emit('connection', ws, request);
      });
    };

    upstreamWs.once('open', onUpstreamOpen);

  } else {
    // Path did not match
    socket.destroy();
  }
});
