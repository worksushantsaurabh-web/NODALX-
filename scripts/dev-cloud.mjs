import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));

function hostedSupabaseUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && /^[a-z0-9]+\.supabase\.co$/.test(url.hostname) &&
      url.pathname === '/' && !url.username && !url.password && !url.search && !url.hash;
  } catch {
    return false;
  }
}

const {SUPABASE_URL, VITE_SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY,
  VITE_SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY} = process.env;
if (!hostedSupabaseUrl(SUPABASE_URL) || SUPABASE_URL !== VITE_SUPABASE_URL ||
  !SUPABASE_PUBLISHABLE_KEY || SUPABASE_PUBLISHABLE_KEY !== VITE_SUPABASE_PUBLISHABLE_KEY ||
  (process.env.DATA_BACKEND !== 'rds' && !SUPABASE_SERVICE_ROLE_KEY)) {
  console.error('Configure matching hosted Supabase URLs and publishable keys in root .env.local. Hosted database mode also needs a server-only service role key.');
  process.exit(1);
}

const environment = {
  ...process.env,
  API_BACKEND_PORT: '5000',
  SUPABASE_ACCOUNT_API_PORT: '5000',
  VITE_API_BASE_URL: '',
  VITE_AUTH_REDIRECT_ORIGIN: 'http://127.0.0.1:5173',
  ALLOW_INTAKE_NETWORK: 'false',
  ALLOW_PROCESSING_NETWORK: 'false',
  MAKE_INTAKE_ENABLED: 'false',
  OUTBOUND_EMAIL_ENABLED: 'false',
};

const children = [
  spawn(process.execPath, ['scripts/dev-supabase-api.mjs'], {cwd: projectRoot, env: environment, stdio: 'inherit'}),
  spawn('npm', ['--prefix', 'frontend', 'run', 'dev', '--', '--host', '127.0.0.1', '--port', '5173', '--strictPort'],
    {cwd: projectRoot, env: environment, stdio: 'inherit'}),
];

let stopping = false;
function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  children.forEach(child => child.kill('SIGTERM'));
  process.exitCode = exitCode;
}
children.forEach(child => {
  child.on('error', () => {console.error('A development service could not start.'); stop(1);});
  child.on('exit', code => stop(code || 0));
});
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
