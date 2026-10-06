import {execFileSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const projectRoot = fileURLToPath(new URL('../', import.meta.url));

export function localToolEnvironment() {
  const dockerDirectory = '/Applications/Docker.app/Contents/Resources/bin';
  return {...process.env, SUPABASE_TELEMETRY_DISABLED: '1',
    PATH: existsSync(path.join(dockerDirectory, 'docker')) ? `${dockerDirectory}${path.delimiter}${process.env.PATH || ''}` : process.env.PATH,
  };
}

export function readLocalSupabaseConfig() {
  const config = JSON.parse(execFileSync(path.join(projectRoot, 'node_modules/.bin/supabase'), ['status', '-o', 'json'], {
    cwd: projectRoot, env: localToolEnvironment(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
  }));
  const url = new URL(config.API_URL);
  if (url.hostname !== '127.0.0.1' || url.protocol !== 'http:') throw new Error('Only the local Supabase stack is allowed.');
  return config;
}
