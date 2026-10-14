import {readFileSync} from 'node:fs';
import pg from 'pg';

const id = '3e9daeb1-f46c-4735-a86e-ca62904afbf4';
const sourceId = '815f0b76-3050-4337-884f-504345ea12be';
const sourceInquiryId = 'stage6c-outbound-20261014-27b19c61';
const original = 'Stage 6C synthetic outbound test. No customer data.';
const subject = '[NODALX TEST] Stage 6C AWS outbound reply';
const body = 'This is a synthetic Stage 6C outbound reply verification from NODALxAI. No customer data is included and no follow-up is required.';
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
    const record = await client.query(`SELECT count(*)::int AS n FROM public.inquiries WHERE id = $1 OR
      (source_inquiry_id = $2 AND intake_source_id = $3)`, [id, sourceInquiryId, sourceId]);
    const ledger = await client.query(`SELECT count(*)::int AS n FROM public.outbound_emails WHERE inquiry_id = $1`, [id]);
    const events = await client.query(`SELECT count(*)::int AS n FROM public.inquiry_events WHERE inquiry_id = $1`, [id]);
    const source = await client.query(`SELECT enabled, received_count FROM private.intake_sources WHERE id = $1`, [sourceId]);
    if (record.rows[0].n || ledger.rows[0].n || events.rows[0].n || source.rowCount !== 1 ||
      source.rows[0].enabled || source.rows[0].received_count !== 0) throw new Error('Outbound test cleanup incomplete.');
    console.log('Cleanup verified: no synthetic inquiry, outbound ledger or events; source disabled/count zero.');
  } else {
    const record = await client.query(`SELECT workspace_id, original_message, email, status, source_inquiry_id, intake_source_id
      FROM public.inquiries WHERE id = $1`, [id]);
    if (record.rowCount !== 1 || record.rows[0].original_message !== original ||
      record.rows[0].email !== 'support@nodalx.in' || record.rows[0].status !== 'Contacted' ||
      record.rows[0].source_inquiry_id !== sourceInquiryId || record.rows[0].intake_source_id !== sourceId) {
      throw new Error('Unexpected synthetic inquiry state.');
    }
    const workspaceId = record.rows[0].workspace_id;
    const ledger = await client.query(`SELECT id, state, subject, body, recipient, provider_message_id, sent_at
      FROM public.outbound_emails WHERE workspace_id = $1 AND inquiry_id = $2`, [workspaceId, id]);
    if (ledger.rowCount !== 1 || ledger.rows[0].state !== 'sent' ||
      ledger.rows[0].subject !== subject || ledger.rows[0].body !== body ||
      ledger.rows[0].recipient !== 'support@nodalx.in' || !ledger.rows[0].provider_message_id ||
      !ledger.rows[0].sent_at) throw new Error('Outbound ledger did not confirm expected sent state.');
    const events = await client.query(`SELECT id, previous_status, changes FROM public.inquiry_events
      WHERE workspace_id = $1 AND inquiry_id = $2`, [workspaceId, id]);
    if (events.rowCount !== 1 || events.rows[0].previous_status !== 'new' ||
      events.rows[0].changes?.status !== 'Contacted' || events.rows[0].changes?.emailSent !== true) {
      throw new Error('Expected one Contacted/emailSent event.');
    }
    const inbound = await client.query(`SELECT count(*)::int AS n FROM public.inbound_emails
      WHERE workspace_id = $1 AND inquiry_id = $2`, [workspaceId, id]);
    const jobs = await client.query(`SELECT count(*)::int AS n FROM public.jobs
      WHERE workspace_id = $1 AND inquiry_id = $2`, [workspaceId, id]);
    if (inbound.rows[0].n || jobs.rows[0].n) throw new Error('Unexpected inbound/job dependencies.');
    console.log('Outbound verified: one sent ledger, provider ID present, inquiry Contacted, one status event.');
    if (mode === 'cleanup') {
      if (!process.argv.includes('--apply')) throw new Error('Cleanup requires --apply.');
      await client.query('BEGIN');
      try {
        const source = await client.query(`SELECT enabled FROM private.intake_sources WHERE id = $1 FOR UPDATE`, [sourceId]);
        if (source.rowCount !== 1 || source.rows[0].enabled) throw new Error('Staged source must be disabled.');
        await client.query(`DELETE FROM public.inquiry_events WHERE workspace_id = $1 AND id = $2`, [workspaceId, events.rows[0].id]);
        await client.query(`DELETE FROM public.outbound_emails WHERE workspace_id = $1 AND id = $2`, [workspaceId, ledger.rows[0].id]);
        const removed = await client.query(`DELETE FROM public.inquiries WHERE workspace_id = $1 AND id = $2
          AND original_message = $3 AND source_inquiry_id = $4 AND intake_source_id = $5 RETURNING id`,
        [workspaceId, id, original, sourceInquiryId, sourceId]);
        if (removed.rowCount !== 1) throw new Error('Exact synthetic inquiry cleanup failed.');
        await client.query(`UPDATE private.intake_sources SET received_count = 0 WHERE id = $1`, [sourceId]);
        await client.query('COMMIT');
        console.log('Scoped outbound test rows removed; source count reset to zero.');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  }
} catch (error) {
  console.error(`Stage 6C outbound inspect/cleanup failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
