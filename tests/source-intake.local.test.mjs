import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID, randomBytes, createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createClient} from '@supabase/supabase-js';
import {localToolEnvironment, readLocalSupabaseConfig} from '../scripts/local-supabase.mjs';

test('local source intake: concurrent replays, conflict, repeat customers and exact originals',
  {skip: process.env.TEST_LOCAL_SOURCE_INTAKE !== 'true'}, async () => {
    const config = readLocalSupabaseConfig();
    const admin = createClient(config.API_URL, config.SERVICE_ROLE_KEY, {auth: {persistSession: false, autoRefreshToken: false}});
    const workspace = `intake-test-${randomUUID()}`;
    const hash = createHash('sha256').update(randomBytes(32)).digest('hex');
    const sql = statement => execFileSync('docker', ['exec', 'supabase_db_NODALXAI', 'psql', '-U', 'postgres', '-d', 'postgres', '-At', '-v', 'ON_ERROR_STOP=1', '-c', statement],
      {env: localToolEnvironment(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']});
    assert.equal((await admin.from('workspaces').insert({id: workspace})).error, null);
    const inquiry = {name: 'Synthetic customer', email: 'repeat@example.test', company: 'Synthetic company', message: '  Original "quoted"\ntext  '};
    try {
      sql(`INSERT INTO private.intake_sources(workspace_id,secret_hash,enabled) VALUES ('${workspace}','${hash}',true)`);
      const ingest = (sourceId, body = inquiry) => admin.rpc('ingest_source_inquiry', {source_key_hash: hash, source_id: sourceId, inquiry: body});
      const results = await Promise.all(Array.from({length: 24}, () => ingest('concurrent-one')));
      assert.ok(results.every(result => result.error === null));
      assert.equal(new Set(results.map(result => result.data.id)).size, 1);
      assert.equal(results.filter(result => !result.data.duplicate).length, 1);
      assert.equal((await ingest('concurrent-one', {...inquiry, message: 'Changed original'})).error.code, 'P0409');
      const repeat = await ingest('concurrent-two');
      assert.equal(repeat.error, null);
      assert.notEqual(repeat.data.id, results[0].data.id);
      const rows = await admin.from('inquiries').select('original_message,content_hash').eq('workspace_id', workspace);
      assert.equal(rows.error, null);
      assert.equal(rows.data.length, 2);
      assert.ok(rows.data.every(row => row.original_message === inquiry.message));
      assert.equal(new Set(rows.data.map(row => row.content_hash)).size, 1);
    } finally {
      assert.equal((await admin.from('inquiries').delete().eq('workspace_id', workspace)).error, null);
      sql(`DELETE FROM private.intake_sources WHERE workspace_id = '${workspace}'`);
      assert.equal((await admin.from('workspaces').delete().eq('id', workspace)).error, null);
    }
  });
