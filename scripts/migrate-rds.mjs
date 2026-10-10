import {createHash} from 'node:crypto';
import {readFileSync, readdirSync} from 'node:fs';
import pg from 'pg';

const rawUrl = process.env.RDS_DATABASE_URL;
if (!rawUrl) throw new Error('RDS_DATABASE_URL is required in .env.rds.local');
const url = new URL(rawUrl);
if (url.hostname !== 'nodalx-db.c69g2gg22fls.us-east-1.rds.amazonaws.com' ||
  url.pathname !== '/postgres' || url.searchParams.get('sslmode') !== 'require') {
  throw new Error('Expected the configured nodalx-db maintenance connection');
}
url.pathname = '/nodalx_app';
url.searchParams.delete('sslmode');

const ca = readFileSync(new URL('../certs/rds-us-east-1-bundle.pem', import.meta.url), 'utf8');
const client = new pg.Client({connectionString: url.toString(), ssl: {ca, rejectUnauthorized: true}, connectionTimeoutMillis: 7000});
const migrations = [
  ['rds/bootstrap.sql', readFileSync(new URL('../rds/bootstrap.sql', import.meta.url), 'utf8')],
  ['rds/service_role_bypass_rls.sql', readFileSync(new URL('../rds/service_role_bypass_rls.sql', import.meta.url), 'utf8')],
  ...readdirSync(new URL('../supabase/migrations/', import.meta.url))
    .filter(name => name.endsWith('.sql') && name !== '20261005000300_private_storage.sql')
    .sort()
    .map(name => [`supabase/migrations/${name}`, readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8')]),
];

await client.connect();
try {
  const {rows: [status]} = await client.query('SELECT current_database() AS name');
  if (status.name !== 'nodalx_app') throw new Error('Refusing to migrate the wrong database');
  await client.query(`CREATE SCHEMA IF NOT EXISTS rds_meta`);
  await client.query(`CREATE TABLE IF NOT EXISTS rds_meta.schema_migrations (
    name text PRIMARY KEY, sha256 text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now()
  )`);
  for (const [name, sql] of migrations) {
    const sha256 = createHash('sha256').update(sql).digest('hex');
    const {rows} = await client.query('SELECT sha256 FROM rds_meta.schema_migrations WHERE name = $1', [name]);
    if (rows.length) {
      if (rows[0].sha256 !== sha256) throw new Error(`Migration changed after application: ${name}`);
      console.log(`Already applied: ${name}`);
      continue;
    }
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('INSERT INTO rds_meta.schema_migrations(name, sha256) VALUES($1, $2)', [name, sha256]);
      await client.query('COMMIT');
      console.log(`Applied: ${name}`);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`Migration failed and rolled back: ${name} (${error.code || error.name || 'unknown'})`);
      process.exitCode = 1;
      break;
    }
  }
} finally {
  await client.end();
}
