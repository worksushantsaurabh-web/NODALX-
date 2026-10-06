import {spawn} from 'node:child_process';
import {readLocalSupabaseConfig, localToolEnvironment, projectRoot} from './local-supabase.mjs';

let config;
try {config = readLocalSupabaseConfig();}
catch {
  console.error('Start Docker and run npx supabase start in this repository before starting the local app.');
  process.exit(1);
}
const environment = {...localToolEnvironment(), SUPABASE_URL: config.API_URL,
  SUPABASE_PUBLISHABLE_KEY: config.PUBLISHABLE_KEY,
  VITE_SUPABASE_URL: config.API_URL, VITE_SUPABASE_PUBLISHABLE_KEY: config.PUBLISHABLE_KEY,
  VITE_API_BASE_URL: '', API_BACKEND_PORT: '5000', SUPABASE_ACCOUNT_API_PORT: '5000',
};
const children = [
  spawn(process.execPath, ['scripts/dev-supabase-api.mjs'], {cwd: projectRoot, env: environment, stdio: 'inherit'}),
  spawn('npm', ['--prefix', 'frontend', 'run', 'dev', '--', '--host', '127.0.0.1', '--port', '5173', '--strictPort'], {cwd: projectRoot, env: environment, stdio: 'inherit'}),
];
let stopping = false;
function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  children.forEach(child => child.kill('SIGTERM'));
  process.exitCode = exitCode;
}
children.forEach(child => {
  child.on('error', () => {console.error('A local development service could not start.'); stop(1);});
  child.on('exit', code => stop(code || 0));
});
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
