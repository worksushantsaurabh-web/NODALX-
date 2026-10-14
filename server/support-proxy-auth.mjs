import {createHash, createHmac, timingSafeEqual} from 'node:crypto';
import {isIP} from 'node:net';

const headers = {ip: 'x-nodalx-client-ip', time: 'x-nodalx-client-time', signature: 'x-nodalx-client-signature'};
const validKey = key => typeof key === 'string' && /^[a-f0-9]{64}$/.test(key);
function signature(ip, timestamp, body, key) {
  const digest = createHash('sha256').update(JSON.stringify(body)).digest('hex');
  return createHmac('sha256', key).update(`v1\nPOST\n/api/send-email\n${timestamp}\n${ip}\n${digest}`).digest('hex');
}

export function signSupportProxy(ip, body, key, timestamp = Math.floor(Date.now() / 1000)) {
  if (!isIP(ip) || !validKey(key) || !Number.isSafeInteger(timestamp)) throw new Error('Invalid support proxy configuration.');
  return {[headers.ip]: ip, [headers.time]: String(timestamp),
    [headers.signature]: signature(ip, timestamp, body, key)};
}

export function verifiedSupportProxyIp(request, key, now = Math.floor(Date.now() / 1000)) {
  if (!validKey(key) || request.method !== 'POST') return null;
  const ip = request.headers?.[headers.ip];
  const time = request.headers?.[headers.time];
  const mac = request.headers?.[headers.signature];
  if (typeof ip !== 'string' || !isIP(ip) || typeof time !== 'string' || !/^\d{10}$/.test(time) ||
    Math.abs(now - Number(time)) > 60 || typeof mac !== 'string' || !/^[a-f0-9]{64}$/.test(mac)) return null;
  try {
    const expected = signature(ip, Number(time), request.body, key);
    return timingSafeEqual(Buffer.from(mac, 'hex'), Buffer.from(expected, 'hex')) ? ip : null;
  } catch { return null; }
}
