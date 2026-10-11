import {spawnSync} from 'node:child_process';
import {parseAwsApiSecret} from './load-aws-api-secret.mjs';

const keys = ['RDS_DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY'];
const config = Object.fromEntries(keys.map(key => [key, process.env[key] || '']));
config.DATA_BACKEND = 'rds';

try {
  parseAwsApiSecret(JSON.stringify(config));
  const result = spawnSync('aws', [
    'secretsmanager', 'create-secret',
    '--name', 'nodalx/api/staging',
    '--description', 'NODALX API staging configuration; sending and intake disabled',
    '--secret-string', 'file:///dev/stdin',
    '--profile', 'nodalx-operator', '--region', 'us-east-1',
    '--query', 'ARN', '--output', 'text',
  ], {input: JSON.stringify(config), encoding: 'utf8', maxBuffer: 1024 * 1024});
  if (result.status !== 0) throw new Error('AWS refused staging secret creation; inspect IAM and secret metadata.');
  const arn = result.stdout.trim();
  if (!/^arn:aws:secretsmanager:us-east-1:560246495281:secret:nodalx\/api\/staging-[A-Za-z0-9]+$/.test(arn)) {
    throw new Error('AWS returned an unexpected staging secret identifier.');
  }
  console.log(`Created staging secret: ${arn}`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
