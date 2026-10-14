import {createDecipheriv, createPublicKey, diffieHellman, generateKeyPairSync, hkdfSync, randomBytes} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {parseAwsApiSecret} from './load-aws-api-secret.mjs';

// Stage 6C feature-gate toggle. The operator can write the secret but cannot read
// it; EC2 can read but cannot write. Relay ciphertext, decrypt only in memory,
// and submit the complete new JSON through stdin. Never print secret values.
const secretId = 'arn:aws:secretsmanager:us-east-1:560246495281:secret:nodalx/api/staging-AUnFpD';
const mode = process.argv[2];
const plans = {
  'support-proxy-stage': {},
  'intake-enable': {RDS_INTAKE_ENABLED: ['false', 'true'], ALLOW_INTAKE_NETWORK: ['false', 'true']},
  'intake-disable': {RDS_INTAKE_ENABLED: ['true', 'false'], ALLOW_INTAKE_NETWORK: ['true', 'false']},
  'support-enable': {SUPPORT_EMAIL_ENABLED: ['false', 'true']},
  'support-disable': {SUPPORT_EMAIL_ENABLED: ['true', 'false']},
  'outbound-enable': {RDS_INTAKE_ENABLED: ['false', 'true'], ALLOW_INTAKE_NETWORK: ['false', 'true'],
    OUTBOUND_EMAIL_ENABLED: ['false', 'true']},
  'outbound-disable': {RDS_INTAKE_ENABLED: ['true', 'false'], ALLOW_INTAKE_NETWORK: ['true', 'false'],
    OUTBOUND_EMAIL_ENABLED: ['true', 'false']},
  'outbound-send-enable': {OUTBOUND_EMAIL_ENABLED: ['false', 'true']},
  'outbound-send-disable': {OUTBOUND_EMAIL_ENABLED: ['true', 'false']},
};
if (!Object.hasOwn(plans, mode)) throw new Error('Expected an approved Stage 6C gate mode.');
const versionArg = process.argv.find(value => value.startsWith('--expected-version='));
const expectedVersion = versionArg?.slice('--expected-version='.length);
if (!/^(?:[0-9a-f]{32}|[0-9a-f-]{36})$/.test(expectedVersion || '')) {
  throw new Error('Expected reviewed staging secret version.');
}
const instanceId = 'i-0a39a885ceb38a8b9';
const region = 'us-east-1';
const profile = 'nodalx-operator';
const allowedIdentity = 'arn:aws:iam::560246495281:user/nodalx-operator';
const expected = {
  SUPPORT_EMAIL_TO: 'support@nodalx.in',
  SUPPORT_EMAIL_FROM: 'NodalX Support <support@nodalx.in>',
  OUTBOUND_EMAIL_FROM: 'NodalX <reply@nodalx.in>',
  RESEND_EMAIL_DOMAIN: 'nodalx.in',
};
const gates = [
  'RDS_INTAKE_ENABLED', 'ALLOW_INTAKE_NETWORK', 'SUPPORT_EMAIL_ENABLED', 'OUTBOUND_EMAIL_ENABLED',
  'ALLOW_PROCESSING_NETWORK', 'MAKE_INTAKE_ENABLED',
];

function aws(args, {input, output = 'json'} = {}) {
  const result = spawnSync('aws', [...args, '--profile', profile, '--region', region,
    '--cli-read-timeout', '12', '--cli-connect-timeout', '5', '--output', output],
  {input, encoding: 'utf8', maxBuffer: 512 * 1024});
  if (result.status !== 0) throw new Error(`AWS ${args[0]} ${args[1]} failed; inspect permissions and service state without printing credentials.`);
  return result.stdout.trim();
}

function currentVersion() {
  const stages = JSON.parse(aws(['secretsmanager', 'describe-secret', '--secret-id', secretId,
    '--query', 'VersionIdsToStages']));
  return Object.entries(stages).find(([, labels]) => labels.includes('AWSCURRENT'))?.[0];
}

try {
  if (aws(['sts', 'get-caller-identity', '--query', 'Arn'], {output: 'text'}) !== allowedIdentity) {
    throw new Error('Expected the MFA-authenticated non-root AWS operator.');
  }
  if (currentVersion() !== expectedVersion) throw new Error('The staging secret version changed; review before updating.');
  if (!process.argv.includes('--apply')) {
    console.log(`Preflight passed: operator and expected secret version match. Use --apply for Stage 6C ${mode}.`);
    process.exit(0);
  }

  const {publicKey, privateKey} = generateKeyPairSync('x25519');
  const receiverPublic = publicKey.export({format: 'der', type: 'spki'}).toString('base64');
  const remoteSource = `
    const {createCipheriv,createPublicKey,diffieHellman,generateKeyPairSync,hkdfSync,randomBytes}=require('node:crypto');
    const {execFileSync}=require('node:child_process');
    try {
      const raw=execFileSync('/usr/bin/aws',['secretsmanager','get-secret-value','--region','us-east-1',
        '--secret-id',${JSON.stringify(secretId)},'--version-id',${JSON.stringify(expectedVersion)},
        '--query','SecretString','--output','text'],{encoding:'utf8',maxBuffer:131072,stdio:['ignore','pipe','ignore']});
      const receiver=createPublicKey({key:Buffer.from(${JSON.stringify(receiverPublic)},'base64'),format:'der',type:'spki'});
      const pair=generateKeyPairSync('x25519');
      const shared=diffieHellman({privateKey:pair.privateKey,publicKey:receiver});
      const key=Buffer.from(hkdfSync('sha256',shared,Buffer.alloc(0),Buffer.from('nodalx-stage6c-v1'),32));
      const iv=randomBytes(12);const cipher=createCipheriv('aes-256-gcm',key,iv);
      const body=Buffer.concat([cipher.update(raw,'utf8'),cipher.final()]);
      process.stdout.write(JSON.stringify({public:pair.publicKey.export({format:'der',type:'spki'}).toString('base64'),
        iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),body:body.toString('base64')}));
    } catch { process.stderr.write('Instance secret relay failed.'); process.exitCode=1; }
  `;
  const encoded = Buffer.from(remoteSource).toString('base64');
  const command = `/usr/bin/node-24 -e 'eval(Buffer.from("${encoded}","base64").toString("utf8"))'`;
  const commandId = aws(['ssm', 'send-command', '--instance-ids', instanceId,
    '--document-name', 'AWS-RunShellScript', '--parameters', JSON.stringify({commands: [command]}),
    '--query', 'Command.CommandId'], {output: 'text'});
  if (!/^[0-9a-f-]{36}$/.test(commandId)) throw new Error('Unexpected SSM command ID.');

  let invocation;
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const result = spawnSync('aws', ['ssm', 'get-command-invocation', '--command-id', commandId,
      '--instance-id', instanceId, '--profile', profile, '--region', region,
      '--query', '{Status:Status,Output:StandardOutputContent}', '--output', 'json'],
    {encoding: 'utf8', maxBuffer: 512 * 1024});
    if (result.status === 0) {
      invocation = JSON.parse(result.stdout);
      if (invocation.Status === 'Success') break;
      if (!['Pending', 'InProgress', 'Delayed'].includes(invocation.Status)) throw new Error('SSM relay failed.');
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
  }
  if (invocation?.Status !== 'Success') throw new Error('SSM relay did not finish.');
  const envelope = JSON.parse(invocation.Output);
  for (const field of ['public', 'iv', 'tag', 'body']) {
    if (typeof envelope[field] !== 'string') throw new Error('Malformed encrypted envelope.');
  }
  const sender = createPublicKey({key: Buffer.from(envelope.public, 'base64'), format: 'der', type: 'spki'});
  const shared = diffieHellman({privateKey, publicKey: sender});
  const key = Buffer.from(hkdfSync('sha256', shared, Buffer.alloc(0), Buffer.from('nodalx-stage6c-v1'), 32));
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
  const raw = Buffer.concat([decipher.update(Buffer.from(envelope.body, 'base64')), decipher.final()]).toString('utf8');
  const config = parseAwsApiSecret(raw);
  if (config.DATA_BACKEND !== 'rds' || !config.RDS_DATABASE_URL.includes('nodalx_api_5e6c94a82810d1')) {
    throw new Error('Unexpected RDS configuration.');
  }
  for (const [field, value] of Object.entries(expected)) {
    if (config[field] !== value) throw new Error(`Unexpected ${field}; review before updating.`);
  }
  for (const field of gates) if (!Object.hasOwn(plans[mode], field) && config[field] !== 'false') {
    throw new Error(`Gate ${field} is enabled; refusing update.`);
  }
  if (config.INTAKE_PROVIDER !== 'rds-direct') throw new Error('Expected direct RDS intake provider.');
  if (!new Set((config.SUPPORT_EMAIL_ALLOWED_ORIGINS || '').split(',').map(value => value.trim()))
    .has('https://nodalx-frontend-8z7kpdrjn-worksushantsaurabh-webs-projects.vercel.app')) {
    throw new Error('Protected Preview support origin is not allowlisted.');
  }
  if (mode === 'support-proxy-stage') {
    if (config.SUPPORT_PROXY_SIGNING_KEY) throw new Error('Signing key already exists; review before any rotation.');
    const signingKey = randomBytes(32).toString('hex');
    const vercel = spawnSync('vercel', ['env', 'add', 'SUPPORT_PROXY_SIGNING_KEY', 'preview',
      '--git-branch', 'nodalx-staging', '--sensitive', '--yes', '--project', 'nodalx-frontend',
      '--scope', 'worksushantsaurabh-webs-projects'],
    {input: signingKey, encoding: 'utf8', maxBuffer: 131072, timeout: 30000});
    if (vercel.status !== 0) throw new Error('Vercel signing-key installation failed; no AWS secret was written.');
    config.SUPPORT_PROXY_SIGNING_KEY = signingKey;
    const origins = new Set(config.SUPPORT_EMAIL_ALLOWED_ORIGINS.split(',').map(value => value.trim()));
    origins.add('https://nodalx-frontend-git-nod-04bf63-worksushantsaurabh-webs-projects.vercel.app');
    config.SUPPORT_EMAIL_ALLOWED_ORIGINS = [...origins].join(',');
  }
  for (const [field, [before, after]] of Object.entries(plans[mode])) {
    if (config[field] !== before) throw new Error(`Unexpected ${field}; review before updating.`);
    config[field] = after;
  }
  parseAwsApiSecret(JSON.stringify(config));
  if (currentVersion() !== expectedVersion) throw new Error('Staging secret changed during review; refusing update.');
  const version = aws(['secretsmanager', 'put-secret-value', '--secret-id', secretId,
    '--secret-string', 'file:///dev/stdin', '--client-request-token', randomBytes(16).toString('hex'),
    '--query', 'VersionId'], {input: JSON.stringify(config), output: 'text'});
  // A caller-supplied ClientRequestToken becomes the version ID (32 hex chars);
  // AWS-generated IDs commonly use the dashed UUID form instead.
  if (!/^(?:[0-9a-f]{32}|[0-9a-f-]{36})$/.test(version)) throw new Error('Unexpected new secret version ID.');
  console.log(`Stage 6C ${mode}. New secret version: ${version}. Previous version: ${expectedVersion}. Other gates remain off.`);
} catch (error) {
  console.error(`Stage 6C intake gate update failed: ${error.message}`);
  process.exitCode = 1;
}
