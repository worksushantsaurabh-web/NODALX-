import {existsSync, readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readLocalSupabaseConfig} from './local-supabase.mjs';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const rdsHostPattern = /^nodalx-db\.[a-z0-9-]+\.[a-z0-9-]+\.rds\.amazonaws\.com$/i;

function loadEnvFile(name) {
  const file = path.join(projectRoot, name);
  if (!existsSync(file)) return {};
  const values = {};
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (!match) continue;
    let value = match[2].trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    values[match[1]] = value;
  }
  return values;
}

// Dual-mode test target. Default stays the Docker local Supabase stack.
// TEST_TARGET=hosted-rds points DB traffic at RDS nodalx_app and Auth at the
// hosted Supabase project, matching the production topology. The service-role
// key must be a real value in gitignored .env.local; placeholders fail closed.
export function readTestTargetConfig() {
  if (process.env.TEST_TARGET !== 'hosted-rds') return readLocalSupabaseConfig();
  const env = {...loadEnvFile('.env.local'), ...loadEnvFile('.env.rds.local'), ...process.env};
  const rawRds = env.RDS_DATABASE_URL || '';
  let rdsUrl;
  try {
    rdsUrl = new URL(rawRds);
  } catch {
    throw new Error('TEST_TARGET=hosted-rds requires a valid RDS_DATABASE_URL in .env.rds.local.');
  }
  if (!rdsHostPattern.test(rdsUrl.hostname) || rdsUrl.pathname !== '/postgres' || rdsUrl.searchParams.get('sslmode') !== 'require') {
    throw new Error('TEST_TARGET=hosted-rds requires the nodalx-db RDS URL in maintenance form (path /postgres, sslmode=require).');
  }
  rdsUrl.pathname = '/nodalx_app';
  rdsUrl.searchParams.delete('sslmode');
  let authUrl;
  try {
    authUrl = new URL(env.SUPABASE_URL || '');
  } catch {
    throw new Error('TEST_TARGET=hosted-rds requires the hosted SUPABASE_URL in .env.local.');
  }
  if (authUrl.protocol !== 'https:' || !/^[a-z0-9]+\.supabase\.co$/i.test(authUrl.hostname)) {
    throw new Error('TEST_TARGET=hosted-rds requires the hosted Supabase Auth URL.');
  }
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!serviceKey.startsWith('eyJ')) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing or still a placeholder. Put the real value in gitignored .env.local — never in chat or git.');
  }
  const publishableKey = env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
  if (!publishableKey) throw new Error('A hosted SUPABASE_PUBLISHABLE_KEY is required in .env.local.');
  return {
    mode: 'hosted-rds',
    API_URL: authUrl.origin,
    SERVICE_ROLE_KEY: serviceKey,
    PUBLISHABLE_KEY: publishableKey,
    RDS_DATABASE_URL: rdsUrl.toString(),
  };
}

// Same call shape as the docker-psql helper: `sql(statement)` returns the
// first cell of the first row as a string for single-value SELECTs, else ''.
// Always await it — the hosted path is asynchronous.
export async function createHostedSql(config) {
  const {default: pg} = await import('pg');
  const ca = readFileSync(path.join(projectRoot, 'certs/rds-us-east-1-bundle.pem'), 'utf8');
  const client = new pg.Client({
    connectionString: config.RDS_DATABASE_URL,
    ssl: {ca, rejectUnauthorized: true},
    connectionTimeoutMillis: 10000,
  });
  await client.connect();
  const sql = async statement => {
    const result = await client.query(statement);
    const cell = result.rows[0] && Object.values(result.rows[0])[0];
    return cell === null || cell === undefined ? '' : String(cell);
  };
  sql.json = async statement => {
    const result = await client.query(statement);
    const cell = result.rows[0] && Object.values(result.rows[0])[0];
    return typeof cell === 'string' ? JSON.parse(cell) : cell;
  };
  sql.close = () => client.end();
  return sql;
}
