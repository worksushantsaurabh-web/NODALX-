import {readFileSync} from 'node:fs';
import pg from 'pg';

const inquiryId = 'd662ca8e-3d02-4fe2-b364-546f2ead4fe4';
const sourceId = '815f0b76-3050-4337-884f-504345ea12be';
const sourceInquiryId = 'stage6c-20261014-cd1a4a5e';
const original = 'Stage 6C synthetic inquiry 2026-10-14. No customer data.';
const signedInUserId = '4ec1a5be-1432-47a7-863c-d758152f9423';
const mode = process.argv[2];
if (!['inspect', 'cleanup', 'verify'].includes(mode)) throw new Error('Expected inspect, cleanup or verify.');
const url = new URL(process.env.RDS_DATABASE_URL || 'postgres://invalid');
if (url.hostname !== 'nodalx-db.c69g2gg22fls.us-east-1.rds.amazonaws.com' ||
  url.pathname !== '/postgres' || url.username !== 'postgres' ||
  url.searchParams.get('sslmode') !== 'require') throw new Error('Expected approved maintenance URL.');
url.pathname = '/nodalx_app';
url.searchParams.delete('sslmode');
const ca = readFileSync(new URL('../certs/rds-us-east-1-bundle.pem', import.meta.url), 'utf8');
const client = new pg.Client({connectionString: url.toString(),
  ssl: {ca, rejectUnauthorized: true}, connectionTimeoutMillis: 7000});
try {
  await client.connect();
  if (mode === 'verify') {
    const row = await client.query(`SELECT count(*)::int AS n FROM public.inquiries WHERE id = $1 OR
      (source_inquiry_id = $2 AND intake_source_id = $3)`, [inquiryId, sourceInquiryId, sourceId]);
    const source = await client.query(`SELECT enabled, received_count FROM private.intake_sources WHERE id = $1`, [sourceId]);
    if (row.rows[0].n !== 0 || source.rowCount !== 1 || source.rows[0].enabled || source.rows[0].received_count !== 0) {
      throw new Error('Synthetic inquiry or source did not return to clean disabled state.');
    }
    console.log('Cleanup verified: zero synthetic inquiries; staged source disabled with received_count=0.');
  } else {
  const record = await client.query(`SELECT workspace_id, id, original_message, source_inquiry_id, intake_source_id
    FROM public.inquiries WHERE id = $1`, [inquiryId]);
  if (record.rowCount !== 1 || record.rows[0].original_message !== original ||
    record.rows[0].source_inquiry_id !== sourceInquiryId ||
    record.rows[0].intake_source_id !== sourceId) throw new Error('Synthetic inquiry identity or exact original mismatched.');
  const workspaceId = record.rows[0].workspace_id;
  const bindings = await client.query(`SELECT auth_user_id, workspace_id FROM public.identity_bindings
    WHERE workspace_id = $1 OR auth_user_id = $2`, [workspaceId, signedInUserId]);
  const signedInWorkspace = bindings.rows.find(row => row.auth_user_id === signedInUserId)?.workspace_id;
  const sourceWorkspaceOwner = bindings.rows.find(row => row.workspace_id === workspaceId)?.auth_user_id;
  console.log(JSON.stringify({inquiryId, exactOriginal: true,
    sourceWorkspaceMatchesSignedIn: workspaceId === signedInWorkspace,
    sourceOwnerMatchesSignedIn: sourceWorkspaceOwner === signedInUserId,
    sourceHasOwner: Boolean(sourceWorkspaceOwner), signedInHasWorkspace: Boolean(signedInWorkspace)}));
  for (const [label, userId, expected] of [
    ['owner', signedInUserId, 1],
    ['crossTenant', '00000000-0000-4000-8000-000000000001', 0],
  ]) {
    await client.query('BEGIN');
    try {
      await client.query('SET LOCAL ROLE authenticated');
      await client.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [userId]);
      const visible = await client.query(`SELECT count(*)::int AS n FROM public.inquiries WHERE id = $1`, [inquiryId]);
      if (visible.rows[0].n !== expected) throw new Error(`Unexpected ${label} RLS visibility.`);
      console.log(`${label} RLS visibility: ${visible.rows[0].n}`);
    } finally {
      await client.query('ROLLBACK');
    }
  }
  for (const [label, table] of [
    ['events', 'public.inquiry_events'], ['outbound', 'public.outbound_emails'],
    ['inbound', 'public.inbound_emails'], ['jobs', 'public.jobs'],
  ]) {
    const count = await client.query(`SELECT count(*)::int AS n FROM ${table} WHERE workspace_id = $1 AND inquiry_id = $2`,
      [workspaceId, inquiryId]);
    if (count.rows[0].n !== 0) throw new Error(`Unexpected ${label} test dependencies; review before cleanup.`);
  }
  if (mode === 'cleanup') {
    if (!process.argv.includes('--apply')) throw new Error('Cleanup requires --apply.');
    await client.query('BEGIN');
    try {
      const source = await client.query(`SELECT enabled FROM private.intake_sources WHERE id = $1 FOR UPDATE`, [sourceId]);
      if (source.rowCount !== 1 || source.rows[0].enabled) throw new Error('Staged source must be disabled before cleanup.');
      const removed = await client.query(`DELETE FROM public.inquiries WHERE workspace_id = $1 AND id = $2
        AND original_message = $3 AND source_inquiry_id = $4 AND intake_source_id = $5 RETURNING id`,
      [workspaceId, inquiryId, original, sourceInquiryId, sourceId]);
      if (removed.rowCount !== 1) throw new Error('Scoped inquiry cleanup did not remove exactly one row.');
      await client.query(`UPDATE private.intake_sources SET received_count = 0 WHERE id = $1`, [sourceId]);
      await client.query('COMMIT');
      console.log('Scoped synthetic inquiry removed; staged source count reset to zero.');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }
  }
} catch (error) {
  console.error(`Stage 6C inspect/cleanup failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
