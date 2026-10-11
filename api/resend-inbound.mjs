import {acceptReceivedEmail} from '../server/inbound-email.mjs';

export const config = {api: {bodyParser: false}};

export default async function handler(request, response) {
  if (request.method !== 'POST') return response.status(405).json({code: 'METHOD_NOT_ALLOWED'});
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 262144) return response.status(413).json({code: 'INVALID_WEBHOOK'});
    chunks.push(chunk);
  }
  const result = await acceptReceivedEmail(Buffer.concat(chunks).toString('utf8'), request.headers);
  return response.status(result.status).json(result.body);
}
