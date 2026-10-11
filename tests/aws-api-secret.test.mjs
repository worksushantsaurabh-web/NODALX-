import test from 'node:test';
import assert from 'node:assert/strict';
import {parseAwsApiSecret} from '../scripts/load-aws-api-secret.mjs';

const valid = {
  DATA_BACKEND: 'rds',
  RDS_DATABASE_URL: 'postgresql://app:private@example.invalid/nodalx_app',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'public-test-value',
  SUPPORT_EMAIL_ENABLED: 'false',
};

test('AWS API secret parser accepts only the required RDS configuration shape', () => {
  assert.deepEqual(parseAwsApiSecret(JSON.stringify(valid)), valid);
  assert.throws(() => parseAwsApiSecret('{}'), /missing required/);
  assert.throws(() => parseAwsApiSecret(JSON.stringify({...valid, DATA_BACKEND: 'supabase'})), /select RDS/);
});

test('AWS API secret parser rejects process-control entries without echoing values', () => {
  for (const key of ['NODE_OPTIONS', 'AWS_PROFILE', 'PATH', 'VITE_SECRET']) {
    assert.throws(() => parseAwsApiSecret(JSON.stringify({...valid, [key]: 'private-marker'})),
      error => !error.message.includes('private-marker') && /unsupported entry/.test(error.message));
  }
});
