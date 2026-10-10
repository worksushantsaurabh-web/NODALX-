import {copyFile, mkdtemp, mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
export const workerFiles = ['package.json', 'package-lock.json', 'server/processing-worker.mjs',
  'server/processing-daemon.mjs', 'server/gemini-processor.mjs', 'server/rds-client.mjs',
  'server/nodalx-v3-result.mjs',
  'certs/rds-us-east-1-bundle.pem', 'scripts/start-cloud-processing-worker.mjs'];

export async function packageProcessingWorker() {
  const directory = await mkdtemp(path.join(tmpdir(), 'nodalx-worker-'));
  await mkdir(path.join(directory, 'server'));
  await mkdir(path.join(directory, 'scripts'));
  await mkdir(path.join(directory, 'certs'));
  for (const file of workerFiles) await copyFile(path.join(root, file), path.join(directory, file));
  await copyFile(path.join(root, 'scripts/processing-worker.Dockerfile'), path.join(directory, 'Dockerfile'));
  return directory;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const directory = await packageProcessingWorker();
  console.log(`Worker-only build context: ${directory}`);
  console.log('Contains reviewed source and manifests only. No environment files or credentials.');
}
