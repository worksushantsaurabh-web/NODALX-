import {createServer} from 'node:http';
import contact from '../api/contact.mjs';
import intake from '../api/intake.mjs';
import automation from '../api/automation.mjs';
import feedback from '../api/feedback.mjs';
import profile from '../api/user/profile.mjs';
import sendEmail from '../api/send-email.mjs';
import resendInbound from '../api/resend-inbound.mjs';
import migration from '../api/migration.mjs';

const maxJsonBytes = 1024 * 1024;
const routes = new Map([
  ['/api/contact', contact],
  ['/api/intake', intake],
  ['/api/automation', automation],
  ['/api/feedback', feedback],
  ['/api/user/profile', profile],
  ['/api/send-email', sendEmail],
  ['/api/resend-inbound', resendInbound],
]);

function json(response, status, body) {
  if (response.headersSent) { response.destroy(); return; }
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.end(JSON.stringify(body));
}

async function parseJson(request) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > maxJsonBytes) throw new Error('oversized');
    chunks.push(chunk);
  }
  if (!bytes) return undefined;
  if (!String(request.headers['content-type'] || '').toLowerCase().startsWith('application/json')) {
    throw new Error('content-type');
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export function createAwsApiServer({logger = console} = {}) {
  const server = createServer(async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    let path;
    try { path = new URL(request.url, 'http://localhost').pathname; }
    catch { return json(response, 400, {code: 'INVALID_PATH'}); }
    const route = routes.has(path) ? path :
      path.startsWith('/api/workspace/') ? '/api/workspace/*' : '/api/*';
    response.once('finish', () => {
      const requestId = response.getHeader('X-Request-ID');
      logger.info?.('AWS API access', {
        method: request.method, route, status: response.statusCode,
        ...(typeof requestId === 'string' ? {requestId} : {}),
      });
    });
    if (!path.startsWith('/api/')) return json(response, 404, {code: 'NOT_FOUND'});
    const handler = routes.get(path) || migration;
    if (handler !== resendInbound) {
      try { request.body = await parseJson(request); }
      catch { return json(response, 400, {code: 'INVALID_INPUT', error: 'Invalid or oversized JSON request.'}); }
    }
    response.status = function status(code) { this.statusCode = code; return this; };
    response.json = function send(body) { json(this, this.statusCode || 200, body); return this; };
    try { await handler(request, response); }
    catch (error) {
      logger.error('AWS API request failed', {path, name: error?.name || 'Error'});
      json(response, 500, {code: 'INTERNAL_ERROR'});
    }
  });
  server.headersTimeout = 15000;
  server.requestTimeout = 30000;
  server.keepAliveTimeout = 5000;
  return server;
}
