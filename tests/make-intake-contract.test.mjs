import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('Make staging contract documents opaque handoff and honest deployment/recovery boundaries', () => {
  const text = readFileSync(new URL('../docs/migration/make-intake-router.md', import.meta.url), 'utf8');
  for (const required of ['/api/intake?action=claim', '/api/intake?action=complete', 'deliveryId', 'leaseToken',
    'duplicate:true', '120', 'MAKE_INTAKE_ENABLED', 'MAKE_INTAKE_TOKEN', 'service-role', 'sign-in',
    'not an import-ready', 'notification', 'private queue', 'retry_intake_delivery']) {
    assert.ok(text.includes(required), `Missing contract boundary: ${required}`);
  }
  assert.match(text, /No scenario\/account setting was/);
});
