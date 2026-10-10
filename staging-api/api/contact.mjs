import {receiveWebsiteIntake} from '../../server/intake-router.mjs';
import {applyApiCors} from '../../server/api-cors.mjs';

export default async function handler(request, response) {
  const cors = applyApiCors(request, response);
  if (cors) return cors;
  const result = await receiveWebsiteIntake({method: request.method, body: request.body,
    idempotencyKey: request.headers?.['idempotency-key']}, {logger: entry => console.warn(JSON.stringify(entry))});
  for (const [name, value] of Object.entries(result.headers)) response.setHeader(name, value);
  return response.status(result.status).json(result.body);
}
