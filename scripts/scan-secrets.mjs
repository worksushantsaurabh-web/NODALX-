#!/usr/bin/env node
/**
 * Secret scanner for tracked files.
 *
 * The previous CI guard only failed when a file named `.env` was tracked. That
 * is a filename check, not a secret check, so a hardcoded credential in an
 * ordinary source file passed straight through — which is how a static proxy
 * secret ended up in the public bundle and in every commit of the history.
 *
 * This scans the content of every tracked file for credential shapes. It is
 * intentionally a small, dependency-free deny-list rather than a full entropy
 * analyser: the goal is to catch the mistakes actually made in this repo, with
 * no false-positive noise.
 *
 * Usage: node scripts/scan-secrets.mjs [--staged]
 *   (default) scans every file tracked by git
 *   --staged  scans only files staged for commit
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const SECRET_PATTERNS = [
  {
    name: 'Google Apps Script deployment id',
    // /macros/s/AKfycb... is a live, unauthenticated endpoint when deployed.
    regex: /macros\/s\/A[a-zA-Z0-9_-]{20,}/g,
  },
  {
    name: 'Google OAuth client secret',
    regex: /\bGOCSPX-[A-Za-z0-9_-]{20,}/g,
  },
  {
    name: 'private key block',
    regex: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/g,
  },
  {
    name: 'AWS access key id',
    regex: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g,
  },
  {
    name: 'Slack token',
    regex: /\bxox[abprs]-[A-Za-z0-9-]{10,}/g,
  },
  {
    name: 'OpenAI-style API key',
    regex: /\bsk-[A-Za-z0-9]{20,}\b/g,
  },
  {
    name: 'GitHub token',
    regex: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g,
  },
  {
    name: 'Stripe live secret key',
    regex: /\bsk_live_[A-Za-z0-9]{20,}\b/g,
  },
  {
    name: 'JSON web token',
    regex: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
  },
  {
    name: 'hardcoded shared-secret header',
    // A literal assigned to a header/key/secret/token name in source.
    regex: /['"]x-app-proxy['"]\s*:\s*['"][A-Za-z0-9_-]{16,}['"]/gi,
  },
];

/**
 * Paths allowed to contain patterns, e.g. documentation with fake examples.
 * Every entry must be justified: an allowlist is how scanners get defeated.
 */
const ALLOWED_FILES = new Set([
  'frontend/.env.example',
  'functions/.env.example',
  'backend/.env.example',
  'scripts/scan-secrets.mjs',
]);

/** Directories whose contents are not source and are not scanned. */
const SKIP_DIR_PREFIXES = ['node_modules/', 'dist/', '_archive/', '.git/'];

const stagedOnly = process.argv.includes('--staged');

function trackedFiles() {
  const args = stagedOnly
    ? ['diff', '--cached', '--name-only', '--diff-filter=ACMR']
    : ['ls-files'];
  const out = execFileSync('git', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  return out.split('\n').map((line) => line.trim()).filter(Boolean);
}

const files = trackedFiles();
const findings = [];

for (const file of files) {
  if (SKIP_DIR_PREFIXES.some((prefix) => file.startsWith(prefix))) continue;

  let content;
  try {
    const buffer = readFileSync(file);
    // Skip binaries rather than scanning their bytes.
    if (buffer.includes(0)) continue;
    content = buffer.toString('utf8');
  } catch {
    continue;
  }

  for (const { name, regex } of SECRET_PATTERNS) {
    const matches = content.match(new RegExp(regex.source, regex.flags));
    if (!matches) continue;

    // A pattern found only inside its own allowlisted file (or the scanner
    // itself, which documents the shapes) is expected.
    if (ALLOWED_FILES.has(file)) continue;

    for (const match of new Set(matches)) {
      // Do not echo the full credential into CI logs.
      const preview = `${match.slice(0, 12)}…${match.slice(-4)}`;
      findings.push({ file, name, preview });
    }
  }
}

if (findings.length) {
  console.error('::error::Secret-like values found in tracked files:\n');
  for (const f of findings) {
    console.error(`  ${f.file}\n    ${f.name}: ${f.preview}`);
  }
  console.error(
    '\nRemove these values, load them from environment variables, and rotate ' +
      'anything that was already published.'
  );
  process.exit(1);
}

console.log(`Scanned ${files.length} tracked files. No secret-like values found.`);
