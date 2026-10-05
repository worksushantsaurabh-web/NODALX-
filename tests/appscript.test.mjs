import assert from 'node:assert/strict';
import {createHash, randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {runInNewContext} from 'node:vm';

const source = readFileSync(new URL('../appscript/nodalx-intake.gs', import.meta.url), 'utf8');
const inquiry = {name: 'Test User', email: 'test@example.invalid', company: 'Test Company', message: 'Please send pricing', service: 'Import processing', requestId: 'test-request-001'};

function scriptFixture({initialRows = [], secret = 'fixture-secret', lockFails = false, mailFails = false} = {}) {
  const rows = initialRows.map(row => [...row]);
  const messages = [];
  const locks = {acquired: 0, released: 0};
  function range(row, column, height = 1, width = 1) {
    return {
      getValues: () => Array.from({length: height}, (_, offset) => Array.from({length: width}, (_, cell) => rows[row - 1 + offset]?.[column - 1 + cell] ?? '')),
      getValue: () => rows[row - 1]?.[column - 1] ?? '',
      setValues(values) {
        values.forEach((valuesRow, offset) => {
          rows[row - 1 + offset] ||= [];
          valuesRow.forEach((value, cell) => {rows[row - 1 + offset][column - 1 + cell] = value;});
        });
        return this;
      },
      setFontWeight() {return this;},
      setBackground() {return this;},
      setFontColor() {return this;},
      createTextFinder(text) {
        return {
          matchEntireCell() {return this;},
          matchCase() {return this;},
          findNext() {
            const offset = rows.slice(row - 1, row - 1 + height).findIndex(values => values[column - 1] === text);
            return offset < 0 ? null : {getRow: () => row + offset};
          },
        };
      },
    };
  }
  const sheet = {getLastRow: () => rows.length, getRange: range, appendRow: values => rows.push([...values]), autoResizeColumns() {}, setFrozenRows() {}};
  const spreadsheet = {getSheets: () => [sheet], getUrl: () => 'https://example.invalid/sheet'};
  const context = {
    PropertiesService: {getScriptProperties: () => ({getProperty: name => ({INTAKE_SECRET: secret, SHEET_ID: 'fixture-sheet'}[name])})},
    SpreadsheetApp: {openById: id => {assert.equal(id, 'fixture-sheet'); return spreadsheet;}},
    Utilities: {getUuid: randomUUID, DigestAlgorithm: {SHA_256: 'sha256'}, Charset: {UTF_8: 'utf8'}, computeDigest: (algorithm, content, encoding) => [...createHash(algorithm).update(content, encoding).digest()]},
    ContentService: {MimeType: {JSON: 'application/json', TEXT: 'text/plain'}, createTextOutput: text => ({text, setMimeType() {return this;}})},
    LockService: {getScriptLock: () => ({waitLock() {if (lockFails) throw Error('fixture lock timeout'); locks.acquired++;}, releaseLock() {locks.released++;}})},
    MailApp: {sendEmail: message => {if (mailFails) throw Error('fixture mail failure'); messages.push(message);}},
    console: {log() {}, error() {}},
  };
  runInNewContext(source, context);
  return {rows, messages, locks, context,
    post: (payload = inquiry, suppliedSecret = secret) => JSON.parse(context.doPost({parameter: {secret: suppliedSecret}, postData: {contents: typeof payload === 'string' ? payload : JSON.stringify(payload)}}).text),
    get: (action, suppliedSecret = secret) => JSON.parse(context.doGet({parameter: {secret: suppliedSecret, action}}).text),
  };
}

test('Apps Script stores one row and sends notifications only once across identical retries', () => {
  const fixture = scriptFixture();
  const first = fixture.post();
  const second = fixture.post();
  assert.equal(first.success, true);
  assert.equal(first.duplicate, false);
  assert.equal(second.duplicate, true);
  assert.equal(second.rowId, inquiry.requestId);
  assert.equal(fixture.rows.length, 2);
  assert.equal(fixture.rows[1][16], inquiry.service);
  assert.match(fixture.rows[1][17], /^[a-f0-9]{64}$/);
  assert.equal(fixture.messages.length, 2);
  assert.deepEqual(fixture.locks, {acquired: 2, released: 2});
});

test('Apps Script rejects a changed inquiry reusing a request ID without overwriting the original', () => {
  const fixture = scriptFixture();
  fixture.post();
  assert.equal(fixture.post({...inquiry, message: 'Different message'}).code, 'IDEMPOTENCY_CONFLICT');
  assert.equal(fixture.rows.length, 2);
  assert.equal(fixture.rows[1][6], inquiry.message);
  assert.equal(fixture.messages.length, 2);
});

test('Apps Script fails closed and validates before writing or locking', () => {
  const fixture = scriptFixture();
  assert.equal(fixture.post(inquiry, 'wrong').message, 'Unauthorized');
  for (const payload of ['{', 'null', '[]', {...inquiry, name: ''}, {...inquiry, email: 'invalid'}, {...inquiry, service: {}}, {...inquiry, message: 'x'.repeat(12001)}, {...inquiry, requestId: 'short'}]) {
    assert.equal(fixture.post(payload).success, false);
  }
  assert.equal(scriptFixture({secret: ''}).post().message, 'Unauthorized');
  assert.equal(fixture.rows.length, 0);
  assert.equal(fixture.messages.length, 0);
  assert.deepEqual(fixture.locks, {acquired: 0, released: 0});
});

test('Apps Script extends compatible legacy headings but refuses unexpected sheet columns', () => {
  const populated = scriptFixture();
  populated.post();
  const legacy = populated.rows[0].slice(0, 16);
  const fixture = scriptFixture({initialRows: [legacy]});
  assert.equal(fixture.post().success, true);
  assert.deepEqual(fixture.rows[0].slice(16), ['Service', 'Payload Hash']);
  const unexpected = scriptFixture({initialRows: [[...legacy, 'Other business data']]});
  assert.equal(unexpected.post().success, false);
  assert.equal(unexpected.rows.length, 1);
  assert.equal(unexpected.rows[0][16], 'Other business data');
  const wrong = scriptFixture({initialRows: [['Unrelated tab']]});
  assert.equal(wrong.post().success, false);
  assert.equal(wrong.rows[0][0], 'Unrelated tab');
});

test('Apps Script treats formula-like inquiry fields as literal text and keeps ordinary messages intact', () => {
  const fixture = scriptFixture();
  assert.equal(fixture.post({...inquiry, name: '=1+1', company: '+SUM(1,2)', phone: '+12345678', message: '@formula'}).success, true);
  assert.equal(fixture.rows[1][1], "'=1+1");
  assert.equal(fixture.rows[1][4], "'+SUM(1,2)");
  assert.equal(fixture.rows[1][3], "'+12345678");
  assert.equal(fixture.rows[1][6], "'@formula");
});

test('Apps Script lock and email failures do not cause unsafe lock releases or discard captured rows', () => {
  const locked = scriptFixture({lockFails: true});
  assert.equal(locked.post().success, false);
  assert.equal(locked.rows.length, 0);
  assert.equal(locked.locks.released, 0);
  const mail = scriptFixture({mailFails: true});
  assert.equal(mail.post().success, true);
  assert.equal(mail.rows.length, 2);
  assert.equal(mail.post().duplicate, true);
});

test('Apps Script health is authorized, read-only and does not disclose inquiry contents', () => {
  const fixture = scriptFixture();
  assert.equal(fixture.get('health', 'wrong').message, 'Unauthorized');
  assert.equal(fixture.rows.length, 0);
  assert.deepEqual(fixture.get('health'), {success: true, configured: true, sheetAccessible: true, rows: 0});
  assert.equal(fixture.rows.length, 0);
  fixture.post();
  assert.equal(fixture.get('health').rows, 1);
  assert.equal(JSON.stringify(fixture.get('health')).includes(inquiry.email), false);
  const list = fixture.get('list');
  assert.equal(list.customers[0].service, inquiry.service);
  assert.equal(JSON.stringify(list).includes(fixture.rows[1][17]), false);
});
