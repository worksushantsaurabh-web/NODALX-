import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {localToolEnvironment, projectRoot} from './local-supabase.mjs';

const result = spawnSync(path.join(projectRoot, 'node_modules/.bin/supabase'), ['test', 'db'], {
  cwd: projectRoot, env: localToolEnvironment(), stdio: 'inherit',
});
process.exit(result.status ?? 1);
