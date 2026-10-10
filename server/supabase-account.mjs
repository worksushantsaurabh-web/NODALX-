import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {createRdsClient, syncRdsIdentity} from './rds-client.mjs';

const profileFields = new Set(['displayName', 'workspace', 'role', 'timezone', 'notifications']);
const notificationFields = new Set(['flowFailure', 'weeklySummary', 'securityAlerts']);
const feedbackFields = new Set(['type', 'category', 'surveyContext', 'rating', 'message', 'page']);
const creditLimits = {trial: 50, starter: 500, growth: 2000};

export function failure(status, code, message) {
  return Object.assign(new Error(message), {status, code});
}

function validateObject(body, fields) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !fields.has(key))) {
    throw failure(400, 'INVALID_INPUT', 'Unsupported request fields.');
  }
}

export function validateProfile(body) {
  validateObject(body, profileFields);
  for (const [field, value] of Object.entries(body)) {
    if (field === 'notifications') {
      validateObject(value, notificationFields);
      if (Object.values(value).some(option => typeof option !== 'boolean')) {
        throw failure(400, 'INVALID_INPUT', 'Invalid notification settings.');
      }
    } else if (typeof value !== 'string' || !value.trim() || value.trim().length > 120) {
      throw failure(400, 'INVALID_INPUT', 'Invalid profile field.');
    }
  }
  if (body.timezone) {
    try {new Intl.DateTimeFormat('en', {timeZone: body.timezone});}
    catch {throw failure(400, 'INVALID_INPUT', 'Invalid timezone.');}
  }
  return body;
}

export function validateFeedback(body) {
  validateObject(body, feedbackFields);
  if (!['widget', 'survey'].includes(body.type) || typeof body.message !== 'string' || body.message.length > 4000) {
    throw failure(400, 'INVALID_INPUT', 'Invalid feedback.');
  }
  if (body.type === 'widget' && (!['bug', 'feature', 'question', 'general'].includes(body.category) || !body.message.trim())) {
    throw failure(400, 'INVALID_INPUT', 'Select a feedback category and enter a message.');
  }
  if (body.type === 'survey' && (!['form_submission', 'onboarding_complete', 'key_generated'].includes(body.surveyContext)
    || !Number.isInteger(body.rating) || body.rating < 1 || body.rating > 5)) {
    throw failure(400, 'INVALID_INPUT', 'Invalid survey rating or context.');
  }
  if (body.page !== undefined && (typeof body.page !== 'string' || body.page.length > 300 || !/^\/[a-zA-Z0-9/_-]*$/.test(body.page))) {
    throw failure(400, 'INVALID_INPUT', 'Invalid page reference.');
  }
  return body;
}

export function databaseError(error) {
  if (error?.code === 'P0409') throw failure(409, 'REQUEST_CONFLICT', 'This request key was already used with different content. Create a new draft and try again.');
  if (error?.code === 'P0429') throw failure(429, 'PROCESSING_LIMIT', 'Processing credits or concurrent job allowance exhausted.');
  if (error?.code === 'P0503') throw failure(503, 'PROCESSING_UNAVAILABLE', 'Processing is not enabled or its required configuration is unavailable.');
  if (!error) return;
  if (error.code === '22023' || error.code === '23514' || error.code === '22P02') {
    throw failure(400, 'INVALID_INPUT', 'Invalid request values.');
  }
  if (error.code === '42501') throw failure(403, 'ACCESS_DENIED', 'Workspace access denied.');
  if (error.code === 'P0002') throw failure(404, 'NOT_FOUND', 'Record not found.');
  if (error.code === 'P0001' && ['Feedback rate limit reached', 'Profile rate limit reached', 'Desk rate limit reached', 'Outbound email rate limit reached'].includes(error.message)) {
    throw failure(429, 'RATE_LIMITED', 'Request limit reached. Please try again later.');
  }
  throw failure(503, 'DATABASE_UNAVAILABLE', 'Workspace storage is temporarily unavailable.');
}

export async function authorizeWorkspace(authorization, options = {}) {
  if (typeof authorization !== 'string' || !/^Bearer [A-Za-z0-9_.-]+$/.test(authorization) || authorization.length > 8192) {
    throw failure(401, 'AUTH_REQUIRED', 'Please sign in to continue.');
  }
  const environment = options.environment || process.env;
  if (!environment.SUPABASE_URL || !environment.SUPABASE_PUBLISHABLE_KEY) {
    throw failure(503, 'AUTH_UNAVAILABLE', 'Supabase is not configured for this environment.');
  }
  const client = (options.createClient || createClient)(environment.SUPABASE_URL, environment.SUPABASE_PUBLISHABLE_KEY, {
    auth: {persistSession: false, autoRefreshToken: false, detectSessionInUrl: false},
    global: {
      headers: {Authorization: authorization},
      fetch: (input, init) => fetch(input, {...init, signal: AbortSignal.timeout(10000)}),
    },
  });
  const {data, error} = await client.auth.getUser(authorization.slice(7));
  if (error) {
    if ([400, 401, 403, 404, 422].includes(error.status)) throw failure(401, 'INVALID_SESSION', 'Your session has expired. Please sign in again.');
    throw failure(503, 'AUTH_UNAVAILABLE', 'Authentication is temporarily unavailable.');
  }
  const user = data?.user;
  if (!user || user.is_anonymous || !(user.email_confirmed_at || user.phone_confirmed_at)) {
    throw failure(401, 'INVALID_SESSION', 'Please verify your account and sign in.');
  }
  let dataClient = client;
  if (environment.DATA_BACKEND === 'rds') {
    await syncRdsIdentity(user, environment);
    dataClient = createRdsClient({role: 'authenticated', userId: user.id, environment});
  }
  const bootstrap = await dataClient.rpc('bootstrap_workspace');
  databaseError(bootstrap.error);
  if (typeof bootstrap.data !== 'string' || !bootstrap.data) throw failure(403, 'WORKSPACE_UNAVAILABLE', 'Workspace access is not configured.');
  return {client: dataClient, user, workspaceId: bootstrap.data};
}

async function readProfile(client, user) {
  const binding = await client.from('identity_bindings').select('workspace_id').eq('auth_user_id', user.id).single();
  databaseError(binding.error);
  const workspaceId = binding.data?.workspace_id;
  if (!workspaceId) throw failure(403, 'WORKSPACE_UNAVAILABLE', 'Workspace access is not configured.');
  const [profile, workspace, subscription] = await Promise.all([
    client.from('profiles').select('*').eq('workspace_id', workspaceId).single(),
    client.from('workspaces').select('name').eq('id', workspaceId).single(),
    client.from('subscriptions').select('plan,status,period_start,period_end').eq('workspace_id', workspaceId).single(),
  ]);
  for (const result of [profile, workspace, subscription]) databaseError(result.error);
  const plan = subscription.data.plan;
  const period = plan === 'trial' ? 'trial' : String(Date.parse(subscription.data.period_start));
  const usage = await client.from('usage_periods').select('used,reserved').eq('workspace_id', workspaceId).eq('period', period).maybeSingle();
  databaseError(usage.error);
  return {
    uid: user.id,
    displayName: profile.data.display_name,
    email: user.email || '',
    photoURL: profile.data.photo_url,
    workspace: workspace.data.name,
    role: profile.data.job_title,
    timezone: profile.data.timezone,
    notifications: profile.data.notifications,
    subscription: {
      tier: plan,
      status: Date.parse(subscription.data.period_end) <= Date.now() ? 'expired' : subscription.data.status,
      executionsUsed: Number(usage.data?.used || 0) + Number(usage.data?.reserved || 0),
      executionsLimit: creditLimits[plan] || 0,
      nextInvoiceDate: '',
    },
    apiKeys: [],
  };
}

export async function receiveAccountRequest(request, options = {}) {
  const requestId = randomUUID();
  const headers = {'Cache-Control': 'no-store', 'X-Request-ID': requestId};
  try {
    const {route, method} = request;
    const allowedMethods = route === 'profile' ? ['GET', 'PUT'] : route === 'feedback' ? ['POST'] : [];
    if (!allowedMethods.includes(method)) {
      return {status: 405, headers: {...headers, Allow: allowedMethods.join(', ')}, body: {error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED', requestId}};
    }
    const authorization = request.authorization || '';
    if (!/^Bearer [A-Za-z0-9_.-]+$/.test(authorization) || authorization.length > 8192) {
      throw failure(401, 'AUTH_REQUIRED', 'Please sign in to continue.');
    }
    if (route === 'profile' && method === 'PUT') validateProfile(request.body);
    if (route === 'feedback') validateFeedback(request.body);
    const {client, user} = await authorizeWorkspace(authorization, options);
    if (route === 'feedback') {
      const saved = await client.rpc('submit_own_feedback', {submission: request.body});
      databaseError(saved.error);
      if (!saved.data) throw failure(503, 'DATABASE_UNAVAILABLE', 'Feedback was not confirmed.');
      return {status: 201, headers, body: {saved: true, id: saved.data}};
    }
    if (method === 'PUT') {
      const updated = await client.rpc('update_own_profile', {updates: request.body});
      databaseError(updated.error);
    }
    return {status: 200, headers, body: await readProfile(client, user)};
  } catch (error) {
    const status = error.status || 503;
    return {status, headers, body: {
      error: error.status ? error.message : 'The service is temporarily unavailable.',
      code: error.code && error.status ? error.code : 'SERVICE_UNAVAILABLE', requestId,
    }};
  }
}

export async function accountHandler(request, response, route) {
  const result = await receiveAccountRequest({route, method: request.method, body: request.body, authorization: request.headers?.authorization});
  for (const [name, value] of Object.entries(result.headers)) response.setHeader(name, value);
  return response.status(result.status).json(result.body);
}
