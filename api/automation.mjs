import {receiveMakeRequest} from '../server/make-processing.mjs';

export default async function handler(request, response) {
  const url = new URL(request.url, 'http://localhost');
  const action = url.searchParams.get('action');
  const result = await receiveMakeRequest({action, method: request.method, body: request.body,
    authorization: request.headers?.authorization});
  for (const [name, value] of Object.entries(result.headers)) response.setHeader(name, value);
  return response.status(result.status).json(result.body);
}
