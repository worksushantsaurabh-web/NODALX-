import {readFileSync} from 'node:fs';
import pg from 'pg';

const id = '815f0b76-3050-4337-884f-504345ea12be';
const mode = process.argv[2];
if (!['enable', 'disable'].includes(mode)) throw new Error('Expected enable or disable.');
const url = new URL(process.env.RDS_DATABASE_URL || 'postgres://invalid');
if (url.hostname !== 'nodalx-db.c69g2gg22fls.us-east-1.rds.amazonaws.com' ||
  url.pathname !== '/postgres' || url.username !== 'postgres' ||
  url.searchParams.get('sslmode') !== 'require') throw new Error('Expected approved RDS maintenance URL.');
url.pathname = '/nodalx_app';
url.searchParams.delete('sslmode');
const ca = readFileSync(new URL('../certs/rds-us-east-1-bundle.pem', import.meta.url), 'utf8');
const client = new pg.Client({connectionString: url.toString(),
  ssl: {ca, rejectUnauthorized: true}, connectionTimeoutMillis: 7000});
try {
  await client.connect();
  await client.query('BEGIN');
  const target = await client.query(`SELECT id, workspace_id, source_kind, enabled, received_count
    FROM private.intake_sources WHERE id = $1 FOR UPDATE`, [id]);
  if (target.rowCount !== 1 || target.rows[0].source_kind !== 'website') throw new Error('Expected staged website source.');
  const current = target.rows[0];
  const active = await client.query(`SELECT count(*)::int AS total FROM private.intake_sources
    WHERE workspace_id = $1 AND source_kind = 'website' AND enabled AND id <> $2`, [current.workspace_id, id]);
  if (active.rows[0].total !== 1) throw new Error('Expected exactly one original active website source.');
  if (current.enabled !== (mode === 'disable')) throw new Error('Source state changed; review before toggling.');
  if (mode === 'enable' && current.received_count !== 0) throw new Error('Expected unused staged source.');
  if (!process.argv.includes('--apply')) {
    await client.query('ROLLBACK');
    console.log(`Stage 6C source preflight: ${mode} is ready; current received_count=${current.received_count}.`);
  } else {
    await client.query('UPDATE private.intake_sources SET enabled = $2 WHERE id = $1', [id, mode === 'enable']);
    await client.query('COMMIT');
    console.log(`Stage 6C source ${mode}d: ${id}; received_count=${current.received_count}.`);
  }
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  console.error(`Stage 6C source toggle failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
