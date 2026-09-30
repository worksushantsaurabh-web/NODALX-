#!/usr/bin/env node
// Read-only backup preserving Firestore's typed REST values and document paths.
// Usage: node scripts/backup-firestore.mjs PROJECT ABSOLUTE_OUTPUT_DIRECTORY
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile, readFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const [project, output] = process.argv.slice(2);
if (!/^[a-z][a-z0-9-]+$/.test(project || '') || !output || !path.isAbsolute(output)) {
  throw new Error('Usage: backup-firestore.mjs PROJECT ABSOLUTE_OUTPUT_DIRECTORY (new directory only)');
}
await mkdir(output, { mode: 0o700 });
const root = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`;
let token;
let expiry = 0;
async function request(url, body) {
  if (Date.now() >= expiry) {
    token = execFileSync(process.env.GCLOUD_BIN || 'gcloud', ['auth', 'print-access-token'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    expiry = Date.now() + 45 * 60 * 1000;
  }
  const response = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) throw new Error(`Firestore read failed (${response.status}); backup incomplete`);
  return response.json();
}
const documents = [];
let collections = 0;
async function walk(parent) {
  let pageToken;
  do {
    const page = await request(`${parent}:listCollectionIds`, { pageSize: 100, ...(pageToken ? { pageToken } : {}) });
    for (const id of page.collectionIds || []) {
      collections++;
      let next;
      do {
        const url = new URL(`${parent}/${encodeURIComponent(id)}`);
        url.searchParams.set('pageSize', '100');
        // Traverse missing ancestor documents too: subcollections can outlive parents.
        url.searchParams.set('showMissing', 'true');
        if (next) url.searchParams.set('pageToken', next);
        const listing = await request(url);
        for (const doc of listing.documents || []) {
          if (doc.createTime || doc.updateTime) documents.push(doc);
          await walk(`https://firestore.googleapis.com/v1/${doc.name.split('/').map(encodeURIComponent).join('/')}`);
        }
        next = listing.nextPageToken;
      } while (next);
    }
    pageToken = page.nextPageToken;
  } while (pageToken);
}
await walk(root);
if (new Set(documents.map((d) => d.name)).size !== documents.length) throw new Error('Duplicate document paths');
const data = JSON.stringify(documents, null, 2);
const file = path.join(output, 'documents.json');
await writeFile(`${file}.partial`, data, { mode: 0o600, flag: 'wx' });
const reread = await readFile(`${file}.partial`, 'utf8');
if (reread !== data || JSON.parse(reread).length !== documents.length) throw new Error('Backup verification failed');
await rename(`${file}.partial`, file);
await writeFile(path.join(output, 'manifest.json'), JSON.stringify({
  project, database: '(default)', completedAt: new Date().toISOString(),
  documents: documents.length, collections,
  sha256: createHash('sha256').update(data).digest('hex'),
  format: 'firestore-rest-v1', consistentSnapshot: false,
  excludes: ['Firebase Auth accounts', 'Storage objects', 'rules', 'indexes', 'secrets'],
}, null, 2), { mode: 0o600, flag: 'wx' });
console.log(`Verified ${documents.length} documents across ${collections} collections. No document contents logged.`);
