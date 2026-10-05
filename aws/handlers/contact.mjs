import {randomUUID} from 'node:crypto';
import {receiveContact} from '../../server/contact.mjs';

export function createHandler(dependencies) {
  return async event => {
    const reject = (statusCode, error) => ({statusCode, headers: {'Content-Type': 'application/json',
      'Cache-Control': 'no-store', 'X-Request-ID': randomUUID()}, body: JSON.stringify({error})});
    if (event?.version !== '2.0' || event.rawPath !== '/api/contact') return reject(404, 'Route not found.');
    let body = event.body || '';
    if (typeof body !== 'string') return reject(400, 'Invalid request body.');
    if (body.length > 30000) return reject(413, 'Inquiry is too large.');
    if (event.isBase64Encoded) {
      const decoded = Buffer.from(body, 'base64');
      if (decoded.toString('base64') !== body) return reject(400, 'Invalid request encoding.');
      body = decoded.toString('utf8');
    }
    const headers = Object.fromEntries(Object.entries(event.headers || {}).map(([name, value]) => [name.toLowerCase(), value]));
    const response = await receiveContact({method: event.requestContext?.http?.method,
      body, idempotencyKey: headers['idempotency-key']}, {...dependencies, timeoutMs: 15000});
    return {statusCode: response.status, headers: response.headers, body: JSON.stringify(response.body), isBase64Encoded: false};
  };
}

export const handler = createHandler();
