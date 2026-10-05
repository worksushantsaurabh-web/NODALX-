import {mkdir, copyFile, readdir} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const destination = resolve(root, 'aws/build/intake');
const files = ['server/contact.mjs', 'aws/handlers/contact.mjs'];

async function existingFiles(directory, prefix = '') {
  let entries;
  try {entries = await readdir(directory, {withFileTypes: true});} catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  const found = [];
  for (const entry of entries) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink()) throw Error('Refusing to package a symbolic link.');
    if (entry.isDirectory()) found.push(...await existingFiles(resolve(directory, entry.name), relative));
    else found.push(relative);
  }
  return found;
}

const existing = await existingFiles(destination);
if (existing.some(file => !files.includes(file))) throw Error('Unexpected files in the intake bundle. Use a clean staging directory.');
for (const file of files) {
  const output = resolve(destination, file);
  await mkdir(dirname(output), {recursive: true});
  await copyFile(resolve(root, file), output);
}
console.log('Prepared dependency-free AWS intake bundle with exactly two allowlisted source files. Nothing deployed.');
