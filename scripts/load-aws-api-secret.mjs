import {execFileSync} from 'node:child_process';

const required = ['RDS_DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY'];
const forbidden = /^(?:AWS_|VITE_|NODE_OPTIONS$|PATH$|HOME$|LD_)/;

export function parseAwsApiSecret(raw) {
  let secret;
  try { secret = JSON.parse(raw); }
  catch { throw new Error('API secret is not valid JSON.'); }
  if (!secret || typeof secret !== 'object' || Array.isArray(secret)) {
    throw new Error('API secret must be a JSON object.');
  }
  for (const [key, value] of Object.entries(secret)) {
    if (!/^[A-Z][A-Z0-9_]*$/.test(key) || forbidden.test(key) ||
      typeof value !== 'string' || value.length > 8192 || value.includes('\0')) {
      throw new Error('API secret contains an unsupported entry.');
    }
  }
  if (required.some(key => !secret[key])) throw new Error('API secret is missing required settings.');
  if (secret.DATA_BACKEND !== 'rds') throw new Error('API secret must select RDS.');
  return secret;
}

export function loadAwsApiSecret(secretId = process.env.NODALX_API_SECRET_ID) {
  if (!secretId || !/^arn:aws:secretsmanager:us-east-1:[0-9]{12}:secret:nodalx\/api\/[A-Za-z0-9/_+=.@-]+$/.test(secretId)) {
    throw new Error('Approved NODALX API secret ARN is required.');
  }
  let raw;
  try {
    raw = execFileSync('/usr/bin/aws', ['secretsmanager', 'get-secret-value',
      '--region', 'us-east-1', '--secret-id', secretId, '--query', 'SecretString',
      '--output', 'text', '--no-cli-pager'],
    {encoding: 'utf8', maxBuffer: 131072, stdio: ['ignore', 'pipe', 'ignore']});
  } catch {
    throw new Error('Could not load NODALX API configuration from Secrets Manager.');
  }
  return parseAwsApiSecret(raw);
}
