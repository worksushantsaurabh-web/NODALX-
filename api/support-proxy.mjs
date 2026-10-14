import {isIP} from 'node:net';
import {signSupportProxy} from '../server/support-proxy-auth.mjs';

// Thin Vercel proxy: no database credentials or email provider call. Vercel
// supplies the caller IP; AWS verifies its body-bound signature before using it.
export function createSupportProxy({environment = process.env, fetchImpl = fetch} = {}) {
  return async function handler(request, response) {
    response.setHeader('Cache-Control', 'no-store');
    if (request.method !== 'POST') return response.status(405).json({code: 'METHOD_NOT_ALLOWED'});
    const ip = request.headers?.['x-forwarded-for'];
    const key = environment.SUPPORT_PROXY_SIGNING_KEY;
    if (environment.VERCEL !== '1' || typeof ip !== 'string' || !isIP(ip) || !/^[a-f0-9]{64}$/.test(key || '')) {
      return response.status(503).json({code: 'SUPPORT_PROXY_UNAVAILABLE'});
    }
    const origin = request.headers?.origin;
    if (typeof origin !== 'string' || /[\r\n]/.test(origin)) return response.status(403).json({code: 'ORIGIN_NOT_ALLOWED'});
    let body;
    try {body = JSON.stringify(request.body);}
    catch {return response.status(400).json({code: 'INVALID_INPUT'});}
    if (!body || Buffer.byteLength(body) > 1048576) return response.status(400).json({code: 'INVALID_INPUT'});
    try {
      const result = await fetchImpl('https://api-staging.nodalx.in/api/send-email', {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000), body,
        headers: {'content-type': 'application/json', origin, ...signSupportProxy(ip, request.body, key)},
      });
      const data = await result.json();
      if (result.headers.get('retry-after')) response.setHeader('Retry-After', result.headers.get('retry-after'));
      for (const name of ['via', 'x-request-id', 'x-nodalx-data-source']) {
        const value = result.headers.get(name);
        if (value) response.setHeader(name, value);
      }
      return response.status(result.status).json(data);
    } catch {return response.status(502).json({code: 'SUPPORT_PROXY_UNAVAILABLE'});}
  };
}

export default createSupportProxy();
