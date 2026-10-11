import {createAwsApiServer} from '../server/aws-api-http.mjs';

if (process.env.DATA_BACKEND !== 'rds' || !process.env.RDS_DATABASE_URL) {
  console.error('AWS API requires DATA_BACKEND=rds and a server-only RDS_DATABASE_URL.');
  process.exit(1);
}

const port = Number(process.env.API_PORT || 5000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('API_PORT must be a valid TCP port.');
  process.exit(1);
}
const server = createAwsApiServer();
server.listen(port, '127.0.0.1', () => console.log(`AWS API listening on 127.0.0.1:${port}`));
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  server.close();
  setTimeout(() => server.closeAllConnections(), 30000).unref();
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, stop);
