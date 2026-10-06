import {receiveWorkspaceRequest} from '../server/supabase-workspace.mjs';

export default async function handler(request, response) {
  const url = new URL(request.url, 'http://localhost');
  const path = url.searchParams.get('path');
  url.searchParams.delete('path');
  const result = await receiveWorkspaceRequest({
    path: path ? `/api/${path}?${url.searchParams}` : request.url,
    method: request.method, body: request.body, authorization: request.headers?.authorization,
  });
  for (const [name, value] of Object.entries(result.headers)) response.setHeader(name, value);
  return response.status(result.status).json(result.body);
}
