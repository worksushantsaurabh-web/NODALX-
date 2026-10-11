import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import pg from '/opt/nodalx-api/current/node_modules/pg/lib/index.js';

const secretArn = 'arn:aws:secretsmanager:us-east-1:560246495281:secret:nodalx/api/staging-AUnFpD';
const raw = execFileSync('/usr/bin/aws', [
  'secretsmanager', 'get-secret-value', '--region', 'us-east-1',
  '--secret-id', secretArn, '--query', 'SecretString', '--output', 'text',
], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']});
const config = JSON.parse(raw);
const url = new URL(config.RDS_DATABASE_URL);
url.pathname = '/nodalx_app';
url.searchParams.delete('sslmode');
const client = new pg.Client({
  connectionString: url.toString(),
  ssl: {ca: readFileSync('/opt/nodalx-api/current/certs/rds-us-east-1-bundle.pem', 'utf8'), rejectUnauthorized: true},
  connectionTimeoutMillis: 7000,
});
try {
  await client.connect();
  const result = await client.query('SELECT current_database() AS database, inet_server_addr()::text AS server_ip');
  const {database, server_ip: serverIp} = result.rows[0];
  const privateIp = /^172\.31\./.test(serverIp);
  console.log(JSON.stringify({database, rdsPrivateIp: privateIp}));
  if (database !== 'nodalx_app' || !privateIp) process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
const auth = await fetch(`${config.SUPABASE_URL}/auth/v1/health`, {
  headers: {apikey: config.SUPABASE_PUBLISHABLE_KEY},
  signal: AbortSignal.timeout(10000),
});
console.log(JSON.stringify({supabaseAuthHttpStatus: auth.status}));
if (!auth.ok) process.exitCode = 1;
