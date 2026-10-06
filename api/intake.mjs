import {receiveMakeIntake} from '../server/intake-router.mjs';

export default async function handler(request, response) {
  const action = new URL(request.url, 'http://localhost').searchParams.get('action');
  const result = await receiveMakeIntake({action, method: request.method, body: request.body,
    authorization: request.headers?.authorization});
  for (const [name, value] of Object.entries(result.headers)) response.setHeader(name, value);
  return response.status(result.status).json(result.body);
}
