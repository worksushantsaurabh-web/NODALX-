import {createHash} from 'node:crypto';
import {readFileSync, readdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import pg from 'pg';

// Runs the shared pgTAP suite (supabase/tests/database/*.sql) against a
// dedicated nodalx_test database on the existing RDS instance, so Docker is no
// longer required for SQL/RLS regression testing. The connection is derived
// from RDS_DATABASE_URL but the target database name is a constant: this
// harness can never reach the application database.
//
// Statements are executed sequentially in one session per file (the test files
// are self-contained BEGIN...ROLLBACK scripts); PostgreSQL itself parses each
// statement, the splitter only finds statement boundaries.
const EXPECTED_HOST = 'nodalx-db.c69g2gg22fls.us-east-1.rds.amazonaws.com';
const TEST_DATABASE = 'nodalx_test';
const APP_ROLES = ['anon', 'authenticated', 'service_role'];
const ca = readFileSync(new URL('../certs/rds-us-east-1-bundle.pem', import.meta.url), 'utf8');

export function testDatabaseUrl(rawUrl) {
  if (!rawUrl) throw new Error('RDS_DATABASE_URL is required in .env.rds.local');
  const url = new URL(rawUrl);
  if (url.hostname !== EXPECTED_HOST || url.pathname !== '/postgres' || url.searchParams.get('sslmode') !== 'require') {
    throw new Error('Expected the configured nodalx-db maintenance connection');
  }
  url.pathname = `/${TEST_DATABASE}`;
  url.searchParams.delete('sslmode');
  return url;
}

export function splitStatements(sql) {
  const statements = [];
  let current = '';
  let state = 'normal';
  let dollarTag = '';
  let i = 0;
  const flush = () => {
    const stripped = current.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '').trim();
    if (stripped) statements.push(current.trim());
    current = '';
  };
  while (i < sql.length) {
    const ch = sql[i];
    if (state === 'normal') {
      if (ch === "'") { state = 'single'; current += ch; i += 1; continue; }
      if (ch === '"') { state = 'double'; current += ch; i += 1; continue; }
      if (ch === '-' && sql[i + 1] === '-') { state = 'line'; current += ch; i += 1; continue; }
      if (ch === '/' && sql[i + 1] === '*') { state = 'block'; current += ch; i += 2; continue; }
      const dollar = /^\$[A-Za-z_0-9]*\$/.exec(sql.slice(i));
      if (dollar) { state = 'dollar'; dollarTag = dollar[0]; current += dollarTag; i += dollarTag.length; continue; }
      if (ch === ';') { flush(); i += 1; continue; }
      current += ch;
      i += 1;
      continue;
    }
    if (state === 'single') {
      current += ch;
      if (ch === "'" && sql[i + 1] === "'") { current += sql[i + 1]; i += 2; continue; }
      if (ch === "'") state = 'normal';
      i += 1;
      continue;
    }
    if (state === 'double') {
      current += ch;
      if (ch === '"' && sql[i + 1] === '"') { current += sql[i + 1]; i += 2; continue; }
      if (ch === '"') state = 'normal';
      i += 1;
      continue;
    }
    if (state === 'line') {
      current += ch;
      if (ch === '\n') state = 'normal';
      i += 1;
      continue;
    }
    if (state === 'block') {
      current += ch;
      if (ch === '*' && sql[i + 1] === '/') { current += '/'; state = 'normal'; i += 2; continue; }
      i += 1;
      continue;
    }
    // dollar
    if (sql.startsWith(dollarTag, i)) { current += dollarTag; state = 'normal'; i += dollarTag.length; continue; }
    current += ch;
    i += 1;
  }
  flush();
  return statements;
}

function connect(url) {
  return new pg.Client({connectionString: url.toString(), ssl: {ca, rejectUnauthorized: true}, connectionTimeoutMillis: 7000});
}

async function maintenance(statement, params = []) {
  const url = new URL(testUrl);
  url.pathname = '/postgres';
  const client = connect(url);
  await client.connect();
  try {
    return await client.query(statement, params);
  } finally {
    await client.end();
  }
}

async function ensureDatabase() {
  if (process.argv.includes('--reset')) {
    await maintenance(`DROP DATABASE IF EXISTS ${TEST_DATABASE} WITH (FORCE)`);
    console.log(`Reset: dropped ${TEST_DATABASE}`);
  }
  const check = await maintenance('SELECT 1 FROM pg_database WHERE datname = $1', [TEST_DATABASE]);
  if (check.rows.length) {
    console.log(`Using existing ${TEST_DATABASE}`);
    return;
  }
  await maintenance(`CREATE DATABASE ${TEST_DATABASE}`);
  console.log(`Created ${TEST_DATABASE}`);
}

function migrationSteps() {
  return [
    ['rds/bootstrap.sql', readFileSync(new URL('../rds/bootstrap.sql', import.meta.url), 'utf8')],
    ['rds/test-schema-fixtures.sql', readFileSync(new URL('../rds/test-schema-fixtures.sql', import.meta.url), 'utf8')],
    ...readdirSync(new URL('../supabase/migrations/', import.meta.url))
      .filter(name => name.endsWith('.sql'))
      .sort()
      .map(name => [`supabase/migrations/${name}`, readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8')]),
  ];
}

async function bootstrap(client) {
  await client.query('CREATE SCHEMA IF NOT EXISTS rds_meta');
  await client.query(`CREATE TABLE IF NOT EXISTS rds_meta.schema_migrations (
    name text PRIMARY KEY, sha256 text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now()
  )`);
  for (const [name, sql] of migrationSteps()) {
    const sha256 = createHash('sha256').update(sql).digest('hex');
    const {rows} = await client.query('SELECT sha256 FROM rds_meta.schema_migrations WHERE name = $1', [name]);
    if (rows.length) {
      if (rows[0].sha256 !== sha256) throw new Error(`Migration changed after application: ${name}`);
      continue;
    }
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('INSERT INTO rds_meta.schema_migrations(name, sha256) VALUES($1, $2)', [name, sha256]);
      await client.query('COMMIT');
      console.log(`Applied: ${name}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw new Error(`Migration failed and rolled back: ${name} (${error.code || error.name})`);
    }
  }
  await client.query('CREATE SCHEMA IF NOT EXISTS extensions');
  await client.query('CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions');
  await client.query(`GRANT USAGE ON SCHEMA extensions TO ${APP_ROLES.join(', ')}`);
  console.log('Test database ready (migrations + pgtap).');
}

export function testFiles() {
  return readdirSync(new URL('../supabase/tests/database/', import.meta.url))
    .filter(name => name.endsWith('.sql'))
    .sort()
    .map(name => path.join('supabase', 'tests', 'database', name));
}

export function parseTap(output) {
  const lines = output.split(/\r?\n/);
  const planLine = lines.map(line => /^1\.\.(\d+)\s*$/.exec(line.trim())).find(Boolean);
  if (!planLine) return null;
  return {
    planned: Number(planLine[1]),
    okCount: lines.filter(line => /^ok \d+/.test(line.trim())).length,
    notOk: lines.filter(line => /^not ok \d+/.test(line.trim())).map(line => line.trim()),
  };
}

function redact(text) {
  return String(text).replace(/(\/\/)[^/\s@]+@/g, '$1***@');
}

async function runFile(file) {
  const statements = splitStatements(readFileSync(path.join(projectRoot, file), 'utf8'));
  const client = connect(testUrl);
  await client.connect();
  const lines = [];
  try {
    for (const statement of statements) {
      const result = await client.query(statement);
      for (const row of result.rows || []) lines.push(Object.values(row).map(String).join(' '));
    }
  } catch (error) {
    return {file, statements: statements.length, error: redact(error.message)};
  } finally {
    await client.end();
  }
  return {file, statements: statements.length, tap: parseTap(lines.join('\n'))};
}

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
let testUrl;

async function run() {
  testUrl = testDatabaseUrl(process.env.RDS_DATABASE_URL);
  await ensureDatabase();
  const setup = connect(testUrl);
  await setup.connect();
  try {
    await bootstrap(setup);
  } finally {
    await setup.end();
  }
  const results = [];
  for (const file of testFiles()) results.push(await runFile(file));
  const totals = {planned: 0, okCount: 0, notOk: []};
  let fileErrors = 0;
  for (const result of results) {
    if (result.error) {
      fileErrors += 1;
      console.log(`${result.file}: ERROR ${result.error}`);
      continue;
    }
    if (!result.tap) {
      fileErrors += 1;
      console.log(`${result.file}: ERROR no TAP plan after ${result.statements} statements`);
      continue;
    }
    totals.planned += result.tap.planned;
    totals.okCount += result.tap.okCount;
    totals.notOk.push(...result.tap.notOk.map(line => `${result.file}: ${line}`));
    console.log(`${result.file}: ${result.tap.okCount}/${result.tap.planned} ok`);
  }
  console.log(`Assertions: ${totals.okCount}/${totals.planned} ok across ${results.length} files`);
  if (totals.notOk.length) for (const line of totals.notOk) console.log(`FAIL ${line}`);
  if (fileErrors || totals.notOk.length || totals.okCount !== totals.planned) {
    throw new Error(`SQL suite failed: ${fileErrors} file error(s), ${totals.notOk.length} failing assertion(s)` +
      (totals.okCount !== totals.planned ? `; expected ${totals.planned} ok, got ${totals.okCount}` : ''));
  }
  console.log('All SQL assertions passed on RDS.');
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  run().then(() => process.exit(0)).catch(error => {
    console.error(redact(error.message));
    process.exit(1);
  });
}
