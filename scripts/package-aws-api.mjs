import {mkdir, copyFile, readdir} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const destination = resolve(root, 'aws/build/api');
const files = [
  'package.json', 'package-lock.json', 'certs/rds-us-east-1-bundle.pem',
  'scripts/load-aws-api-secret.mjs', 'scripts/start-aws-api-from-secrets.mjs',
  'scripts/start-aws-api.mjs',
  'api/automation.mjs', 'api/contact.mjs', 'api/feedback.mjs',
  'api/intake.mjs', 'api/migration.mjs', 'api/resend-inbound.mjs',
  'api/send-email.mjs', 'api/user/profile.mjs',
  'server/aws-api-http.mjs', 'server/api-cors.mjs', 'server/contact.mjs',
  'server/gemini-processor.mjs', 'server/inbound-email.mjs',
  'server/intake-router.mjs', 'server/make-processing.mjs',
  'server/nodalx-v3-input.mjs', 'server/nodalx-v3-result.mjs',
  'server/outbound-email.mjs', 'server/processing-daemon.mjs',
  'server/processing-worker.mjs', 'server/rds-client.mjs',
  'server/supabase-account.mjs', 'server/supabase-workspace.mjs',
];

async function existingFiles(directory, prefix = '') {
  let entries;
  try { entries = await readdir(directory, {withFileTypes: true}); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  const found = [];
  for (const entry of entries) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink()) throw new Error('Refusing a symbolic link in API build.');
    if (entry.isDirectory()) found.push(...await existingFiles(resolve(directory, entry.name), relative));
    else found.push(relative);
  }
  return found;
}

const existing = await existingFiles(destination);
if (existing.some(file => !files.includes(file))) throw new Error('Unexpected file in API build; use a clean staging directory.');
for (const file of files) {
  const output = resolve(destination, file);
  await mkdir(dirname(output), {recursive: true});
  await copyFile(resolve(root, file), output);
}
console.log(`Prepared ${files.length} allowlisted API files in aws/build/api; no secrets or dependencies copied.`);
