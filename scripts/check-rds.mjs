import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import pg from 'pg';

const rawUrl = process.env.RDS_DATABASE_URL;
if (!rawUrl) {
  console.error('RDS_DATABASE_URL is missing from .env.rds.local.');
  process.exit(1);
}

let url;
try {
  url = new URL(rawUrl);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || !url.username || !url.password) {
    throw new Error('invalid URL');
  }
} catch {
  console.error('RDS_DATABASE_URL must be a PostgreSQL URL with host, username, and password.');
  process.exit(1);
}

// node-postgres replaces the ssl object when sslmode is present in a URL.
// Supply the AWS CA explicitly so TLS verifies the RDS server certificate.
url.searchParams.delete('sslmode');
const caPath = fileURLToPath(new URL('../certs/rds-us-east-1-bundle.pem', import.meta.url));
const client = new pg.Client({
  connectionString: url.toString(),
  ssl: {ca: readFileSync(caPath, 'utf8'), rejectUnauthorized: true},
  connectionTimeoutMillis: 7000,
});

try {
  await client.connect();
  const {rows: [status]} = await client.query(`
    SELECT current_database() AS database, current_user AS username,
           current_setting('server_version') AS version,
           (SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid()) AS tls
  `);
  const {rows: schemas} = await client.query(`
    SELECT nspname AS name FROM pg_namespace
    WHERE nspname IN ('auth', 'public', 'private') ORDER BY nspname
  `);
  console.log({...status, schemas: schemas.map(row => row.name)});
} catch (error) {
  const issue = error.code === '28P01' ? 'password rejected for the configured user' :
    error.code === 'SELF_SIGNED_CERT_IN_CHAIN' ? 'RDS TLS certificate was not trusted' :
    error.code === 'ETIMEDOUT' ? 'connection timed out' :
    `connection failed (${error.code || error.name || 'unknown'})`;
  console.error(`RDS check: ${issue}.`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
