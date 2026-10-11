import {Resend} from 'resend';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const permittedFields = new Set(['replyTo', 'subject', 'message']);
const windowMs = 10 * 60 * 1000;
const windowLimit = 5;
const windowCap = 5000;
const attempts = new Map();

function supportAddress(value, fallback) {
  const address = (value || fallback || '').trim();
  return emailPattern.test(address) ? address : null;
}

function clientKey(request) {
  const forwarded = request.headers?.['x-forwarded-for'];
  const single = (Array.isArray(forwarded) ? forwarded[0] : forwarded || '').split(',')[0].trim();
  if (single) return single.replace(/[^0-9a-fA-F:.]/g, '').slice(0, 64);
  return String(request.socket?.remoteAddress || 'unknown').slice(0, 64);
}

function rateLimited(request, store) {
  const key = clientKey(request);
  const now = Date.now();
  if (store.size > windowCap) {
    for (const [entry, seen] of store) if (now - seen.at(-1) > windowMs) store.delete(entry);
  }
  const seen = (store.get(key) || []).filter(time => now - time < windowMs);
  if (seen.length >= windowLimit) {
    store.set(key, seen);
    return true;
  }
  seen.push(now);
  store.set(key, seen);
  return false;
}

function sameOrigin(request, environment) {
  const origin = request.headers?.origin;
  if (typeof origin !== 'string' || !origin) return false;
  let host;
  try {
    host = new URL(origin).host;
  } catch {
    return false;
  }
  if (!host) return false;
  const configured = new Set((environment.SUPPORT_EMAIL_ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean));
  if (configured.size) {
    return [...configured].some(allowed => allowed === host || new URL(allowed).host === host);
  }
  return host === String(request.headers?.host || '');
}

function validateBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('A JSON body is required.');
  const keys = Object.keys(body);
  if (!keys.length || keys.some(key => !permittedFields.has(key))) throw new Error('Unsupported field.');
  const replyTo = body.replyTo === undefined ? '' : String(body.replyTo).trim();
  if (replyTo && (!emailPattern.test(replyTo) || replyTo.length > 254)) throw new Error('Invalid reply address.');
  if (typeof body.subject !== 'string' || !body.subject.trim() || body.subject.trim().length > 200) throw new Error('A subject under 200 characters is required.');
  if (typeof body.message !== 'string' || !body.message.trim() || body.message.length > 8000) throw new Error('A message under 8000 characters is required.');
  if (/[\r\n]/.test(body.subject)) throw new Error('Subject cannot contain line breaks.');
  if (/[\r\n]/.test(replyTo)) throw new Error('Reply address cannot contain line breaks.');
  return {replyTo, subject: body.subject.trim(), message: body.message.trim()};
}

export function createSupportEmailHandler({resendFactory = () => new Resend(process.env.RESEND_API_KEY), store = attempts} = {}) {
  return async function handler(req, res) {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({success: false, code: 'METHOD_NOT_ALLOWED', error: 'Method not allowed. Please use POST.'});
    }

    const environment = process.env;
    if (environment.SUPPORT_EMAIL_ENABLED !== 'true') {
      return res.status(503).json({success: false, code: 'SUPPORT_EMAIL_DISABLED', error: 'Support email is not enabled.'});
    }
    if (!environment.RESEND_API_KEY) {
      return res.status(503).json({success: false, code: 'SUPPORT_EMAIL_UNAVAILABLE', error: 'Support email is temporarily unavailable.'});
    }
    if (!sameOrigin(req, environment)) {
      return res.status(403).json({success: false, code: 'ORIGIN_NOT_ALLOWED', error: 'Support email is not available from this origin.'});
    }
    if (rateLimited(req, store)) {
      res.setHeader('Retry-After', '600');
      return res.status(429).json({success: false, code: 'RATE_LIMITED', error: 'Too many support messages. Please try again later.'});
    }

    const recipient = supportAddress(environment.SUPPORT_EMAIL_TO, 'support@nodalx.in');
    const sender = environment.SUPPORT_EMAIL_FROM || 'NodalX Support <support@nodalx.in>';
    if (!recipient) {
      return res.status(503).json({success: false, code: 'SUPPORT_EMAIL_UNAVAILABLE', error: 'Support email is temporarily unavailable.'});
    }

    let message;
    try {
      message = validateBody(req.body);
    } catch (error) {
      return res.status(400).json({success: false, code: 'INVALID_INPUT', error: error.message});
    }

    try {
      const resend = resendFactory();
      const {data, error} = await resend.emails.send({
        from: sender,
        to: [recipient],
        subject: message.subject,
        text: message.message,
        ...(message.replyTo ? {reply_to: message.replyTo} : {}),
      });
      if (error) {
        return res.status(502).json({success: false, code: 'DELIVERY_FAILED', error: 'Support email could not be delivered.'});
      }
      return res.status(200).json({success: true, data: {id: data?.id || null}});
    } catch {
      return res.status(500).json({success: false, code: 'DELIVERY_FAILED', error: 'Support email could not be delivered.'});
    }
  };
}

export default createSupportEmailHandler();
