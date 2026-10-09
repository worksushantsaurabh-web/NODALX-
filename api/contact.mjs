import {receiveWebsiteIntake} from '../server/intake-router.mjs';

export default async function handler(request, response) {
  if (process.env.DATA_BACKEND === 'rds' &&
    (process.env.RDS_INTAKE_ENABLED !== 'true' || process.env.INTAKE_PROVIDER !== 'rds-direct')) {
    response.setHeader('Cache-Control', 'no-store');
    return response.status(503).json({code: 'INTAKE_DISABLED', error: 'Inquiry submissions are temporarily unavailable.'});
  }
  const result = await receiveWebsiteIntake({method: request.method, body: request.body,
    idempotencyKey: request.headers?.['idempotency-key']}, {logger: entry => console.warn(JSON.stringify(entry))});
  for (const [name, value] of Object.entries(result.headers)) response.setHeader(name, value);
  return response.status(result.status).json(result.body);
}
