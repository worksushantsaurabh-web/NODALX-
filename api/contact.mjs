import {receiveContact} from '../server/contact.mjs';

export default async function handler(request, response) {
  const result = await receiveContact({method: request.method, body: request.body,
    idempotencyKey: request.headers?.['idempotency-key']}, {logger: entry => console.warn(JSON.stringify(entry))});
  for (const [name, value] of Object.entries(result.headers)) response.setHeader(name, value);
  return response.status(result.status).json(result.body);
}
