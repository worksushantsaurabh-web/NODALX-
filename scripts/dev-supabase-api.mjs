import {createServer} from 'node:http';
import {receiveWorkspaceRequest} from '../server/supabase-workspace.mjs';
import {receiveWebsiteIntake, receiveMakeIntake} from '../server/intake-router.mjs';

const port = Number(process.env.SUPABASE_ACCOUNT_API_PORT || 5000);

const server = createServer(async (request, response) => {
  response.setHeader('Content-Type', 'application/json');
  response.setHeader('Cache-Control', 'no-store');
  let body;
  try {
    const chunks = [];
    let bytes = 0;
    for await (const chunk of request) {
      bytes += chunk.length;
      if (bytes > 20000) throw new Error('payload');
      chunks.push(chunk);
    }
    const raw = Buffer.concat(chunks).toString('utf8');
    body = raw ? JSON.parse(raw) : undefined;
  } catch {
    response.writeHead(400);
    response.end(JSON.stringify({error: 'Invalid or oversized JSON request.', code: 'INVALID_INPUT'}));
    return;
  }
  const url = new URL(request.url, 'http://localhost');
  const result = url.pathname === '/api/contact'
    ? await receiveWebsiteIntake({method: request.method, body, idempotencyKey: request.headers['idempotency-key']})
    : url.pathname === '/api/intake'
    ? await receiveMakeIntake({action: url.searchParams.get('action'), method: request.method, body, authorization: request.headers.authorization})
    : await receiveWorkspaceRequest({path: request.url, method: request.method, body, authorization: request.headers.authorization});
  response.writeHead(result.status, result.headers);
  response.end(JSON.stringify(result.body));
});

server.listen(port, '127.0.0.1', () => console.log(`Local account API: http://127.0.0.1:${port}`));
