import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readdir, readFile} from 'node:fs/promises';
import path from 'node:path';
import {packageProcessingWorker, workerFiles} from '../scripts/package-processing-worker.mjs';

test('worker packaging includes only reviewed runtime files and no environment files', async () => {
  const directory = await packageProcessingWorker();
  const files = (await readdir(directory, {recursive: true})).filter(file => !['server', 'scripts', 'certs'].includes(file)).sort();
  assert.deepEqual(files, ['Dockerfile', ...workerFiles].sort());
  const docker = await readFile(path.join(directory, 'Dockerfile'), 'utf8');
  assert.match(docker, /USER node/);
  assert.match(docker, /--omit=dev --ignore-scripts/);
  assert.match(docker, /COPY server\/.*server\/rds-client\.mjs/);
  assert.match(docker, /COPY certs\/rds-us-east-1-bundle\.pem/);
  assert.doesNotMatch(docker, /COPY \. /);
});
