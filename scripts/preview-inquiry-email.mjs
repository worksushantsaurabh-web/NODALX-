import {readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {runInNewContext} from 'node:vm';

const source = await readFile(new URL('../appscript/nodalx-intake.gs', import.meta.url), 'utf8');
const context = {};
runInNewContext(source, context);
const payload = {
  name: 'Priya Sharma',
  email: 'preview@example.invalid',
  company: 'Acme Operations',
  service: 'custom-integration',
};
const preview = context.buildUserConfirmationEmail(payload, 'preview-inquiry-001');
const output = resolve(process.argv[2] || '/private/tmp/nodalx-inquiry-email.html');
await writeFile(output, preview.htmlBody, {mode: 0o600});
console.log(`Synthetic confirmation preview saved to ${output}. No email sent or spreadsheet changed.`);
