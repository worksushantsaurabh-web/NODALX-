import {createHash, randomBytes} from 'node:crypto';
import {mkdirSync, mkdtempSync, readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createClient} from '@supabase/supabase-js';

export async function prepareIntakeBinding({environment, accessToken}, options = {}) {
  const origin = new URL(environment.SUPABASE_URL);
  const project = environment.SUPABASE_EXPECTED_PROJECT_REF;
  if (environment.INTAKE_ENVIRONMENT !== 'staging' || !/^[a-z0-9]{20}$/.test(project || '') ||
    origin.href !== `https://${project}.supabase.co/` || !environment.SUPABASE_PUBLISHABLE_KEY ||
    typeof accessToken !== 'string' || !/^[A-Za-z0-9_.-]{20,8192}$/.test(accessToken)) {
    throw new Error('Verified staging configuration and owner session are required.');
  }
  const client = (options.createClient || createClient)(origin.origin, environment.SUPABASE_PUBLISHABLE_KEY, {
    auth: {persistSession: false, autoRefreshToken: false, detectSessionInUrl: false},
    global: {headers: {Authorization: `Bearer ${accessToken}`},
      fetch: (input, init) => fetch(input, {...init, signal: AbortSignal.timeout(10000)})},
  });
  const identity = await client.auth.getUser(accessToken);
  const user = identity.data?.user;
  if (identity.error || !user || user.is_anonymous || !(user.email_confirmed_at || user.phone_confirmed_at) ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(user.id)) throw new Error('Verified owner session required.');
  const binding = await client.from('identity_bindings').select('workspace_id').eq('auth_user_id', user.id).single();
  const workspace = binding.data?.workspace_id;
  if (binding.error || !/^[A-Za-z0-9_:-]{1,150}$/.test(workspace || '')) throw new Error('Owned workspace binding required.');
  const sourceToken = environment.INTAKE_SOURCE_TOKEN || randomBytes(32).toString('base64url');
  if (!/^[A-Za-z0-9_-]{32,256}$/.test(sourceToken) ||
    [environment.MAKE_INTAKE_TOKEN, environment.MAKE_PROCESSING_TOKEN].includes(sourceToken)) {
    throw new Error('A distinct source credential is required.');
  }
  const sourceHash = createHash('sha256').update(sourceToken).digest('hex');
  const sql = `BEGIN;
DO $binding$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.identity_bindings b JOIN auth.users u ON u.id = b.auth_user_id
    WHERE b.auth_user_id = '${user.id}'::uuid AND b.workspace_id = '${workspace}'
      AND NOT coalesce(u.is_anonymous, false)
      AND (u.email_confirmed_at IS NOT NULL OR u.phone_confirmed_at IS NOT NULL)
  ) THEN RAISE EXCEPTION 'Verified owner binding changed'; END IF;
  INSERT INTO private.intake_sources (workspace_id, secret_hash, enabled, source_kind)
    VALUES ('${workspace}', '${sourceHash}', false, 'website')
    ON CONFLICT (secret_hash) DO NOTHING;
  IF NOT EXISTS (SELECT 1 FROM private.intake_sources
    WHERE secret_hash = '${sourceHash}' AND workspace_id = '${workspace}' AND NOT enabled AND source_kind = 'website')
    THEN RAISE EXCEPTION 'Source already active or bound elsewhere'; END IF;
END;
$binding$;
COMMIT;
`;
  return {sourceToken, sql};
}

async function main() {
  try {
    const input = readFileSync(0, 'utf8');
    if (Buffer.byteLength(input) > 12000) throw new Error();
    const payload = JSON.parse(input);
    if (!payload || Object.keys(payload).some(key => key !== 'accessToken')) throw new Error();
    const prepared = await prepareIntakeBinding({environment: process.env, accessToken: payload.accessToken});
    const root = resolve(import.meta.dirname, '../.private-backups');
    mkdirSync(root, {recursive: true, mode: 0o700});
    const directory = mkdtempSync(`${root}/intake-setup-`);
    writeFileSync(`${directory}/source-token`, prepared.sourceToken, {mode: 0o600, flag: 'wx'});
    writeFileSync(`${directory}/binding.sql`, prepared.sql, {mode: 0o600, flag: 'wx'});
    console.log(`Prepared disabled source binding in ${directory}. No cloud settings were changed.`);
  } catch {
    console.error('Intake preparation failed. Check staging configuration and verified owner session privately.');
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
