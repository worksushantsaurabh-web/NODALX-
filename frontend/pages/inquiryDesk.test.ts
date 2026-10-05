import assert from 'node:assert/strict';
import { test } from 'node:test';
import { activityTime, matchesFilter, parseInquiries, priorityReasons, selectQueue, settleSource } from './inquiryDesk.ts';

const inquiry = (fields: Record<string, unknown> = {}) => parseInquiries([{ id: '1', ...fields }], 'backend').records[0];

test('status filters normalize whitespace and case without substring matches', () => {
  for (const status of [' NEW ', 'Pending', 'review', 'Needs Review']) assert.ok(matchesFilter(inquiry({ status }), 'review'));
  for (const status of ['', 'unknown', 'unqualified', 'inactive', 'preview', 'not contacted', 'spam review', 'qualified']) {
    assert.equal(matchesFilter(inquiry({ status }), 'review'), false);
    assert.equal(matchesFilter(inquiry({ status }), 'contacted'), false);
    assert.equal(matchesFilter(inquiry({ status }), 'spam'), false);
    assert.ok(matchesFilter(inquiry({ status }), 'all'));
  }
  assert.ok(matchesFilter(inquiry({ status: ' CONTACTED ' }), 'contacted'));
  assert.ok(matchesFilter(inquiry({ status: ' SPAM ' }), 'spam'));
  for (const status of [' WON ', 'Lost']) {
    assert.ok(matchesFilter(inquiry({ status }), 'closed'));
    assert.equal(matchesFilter(inquiry({ status, intent: 'purchase', urgency: 'high' }), 'priority'), false);
  }
});

test('intent and urgency independently establish priority, never fit score', () => {
  assert.ok(matchesFilter(inquiry({ intent: 'low', urgency: ' HIGH ' }), 'priority'));
  assert.ok(matchesFilter(inquiry({ intent: ' Purchase ', urgency: 'low' }), 'priority'));
  assert.equal(priorityReasons(inquiry({ intent: 'high', urgency: 'high' })).length, 2);
  assert.equal(matchesFilter(inquiry({ intent: 'partnership', fit_score: 100 }), 'priority'), false);
  assert.equal(matchesFilter(inquiry({ status: 'spam', intent: 'purchase', urgency: 'high' }), 'priority'), false);
  assert.equal(matchesFilter(inquiry({ intent: 'high-ish', urgency: 'higher' }), 'priority'), false);
});

test('search covers all four fields, combines with filters, and does not mutate input', () => {
  const rows = [inquiry({ name: 'Ada', email: 'ada@example.com', company: 'Acme', message: 'Custom integration', status: 'New' })];
  for (const query of [' ADA ', 'example.com', 'acme', 'INTEGRATION']) assert.equal(selectQueue(rows, 'review', query, 'priority').length, 1);
  assert.equal(selectQueue(rows, 'spam', 'Ada', 'newest').length, 0);
  assert.notEqual(selectQueue(rows, 'all', '', 'oldest'), rows);
});

test('priority order follows documented buckets and ignores fit scale', () => {
  const rows = [
    inquiry({ id: 'spam', status: 'Spam', urgency: 'high' }),
    inquiry({ id: 'other', status: 'Contacted', fit_score: 100 }),
    inquiry({ id: 'review', status: 'New' }),
    inquiry({ id: 'hot', urgency: 'high', intent: 'low', fit_score: 0 }),
  ];
  assert.deepEqual(selectQueue(rows, 'all', '', 'priority').map(row => row.id), ['hot', 'review', 'other', 'spam']);
});

test('activity sorts safely, unknown dates last in both directions, stable ties', () => {
  const rows = [inquiry({ id: 'invalid', last_active: 'Just now' }), inquiry({ id: 'b', last_active: '2026-02-01' }), inquiry({ id: 'a', last_active: '2026-02-01' }), inquiry({ id: 'old', last_active: '2025-01-01' })];
  assert.deepEqual(selectQueue(rows, 'all', '', 'newest').map(row => row.id), ['a', 'b', 'old', 'invalid']);
  assert.deepEqual(selectQueue(rows, 'all', '', 'oldest').map(row => row.id), ['old', 'a', 'b', 'invalid']);
  assert.equal(activityTime(''), null);
  assert.equal(activityTime('invalid'), null);
});

test('source identity prevents cross-source collisions, omits unsafe IDs, preserves honest unknowns and zero scores', () => {
  const backend = inquiry({ fit_score: 0 });
  const script = parseInquiries([{ id: '1' }], 'apps-script').records[0];
  assert.notEqual(backend.key, script.key);
  assert.equal(script.source, 'apps-script');
  assert.equal(backend.fit_score, '0');
  assert.equal(backend.last_active, '');
  assert.equal(backend.status, '');
  const result = parseInquiries([null, {}, { id: 'dup' }, { id: 'dup' }, { id: 0 }], 'backend');
  assert.equal(result.skipped, 4);
  assert.equal(result.records[0].id, '0');
  assert.throws(() => parseInquiries({ error: 'bad' }, 'backend'));
});

test('failed and unusable refreshes preserve records and successful fetch time', () => {
  const previous = { records: [inquiry()], fetchedAt: 100, warning: null };
  const failed = settleSource(previous, { status: 'rejected', reason: new Error('offline') }, 200);
  assert.equal(failed.records, previous.records);
  assert.equal(failed.fetchedAt, 100);
  assert.match(failed.warning!, /not fresh/);
  const unusable = settleSource(previous, { status: 'fulfilled', value: { records: [], skipped: 2 } }, 200);
  assert.equal(unusable.fetchedAt, 100);
  assert.equal(unusable.records, previous.records);
});

test('successful empty refresh clears old data, partial usable response carries warning', () => {
  const previous = { records: [inquiry()], fetchedAt: 100, warning: null };
  const empty = settleSource(previous, { status: 'fulfilled', value: { records: [], skipped: 0 } }, 200);
  assert.deepEqual(empty, { records: [], fetchedAt: 200, warning: null });
  const partial = settleSource(previous, { status: 'fulfilled', value: { records: [inquiry({ id: 'new' })], skipped: 1 } }, 300);
  assert.equal(partial.records[0].id, 'new');
  assert.equal(partial.fetchedAt, 300);
  assert.match(partial.warning!, /1 records omitted/);
});

test('partial source failure refreshes only the successful source, even with colliding IDs', () => {
  const backend = { records: [inquiry()], fetchedAt: 100, warning: null };
  const script = { records: parseInquiries([{ id: '1', name: 'Sheet record' }], 'apps-script').records, fetchedAt: 100, warning: null };
  const nextBackend = settleSource(backend, { status: 'fulfilled', value: parseInquiries([{ id: '1', name: 'Updated backend' }], 'backend') }, 200);
  const nextScript = settleSource(script, { status: 'rejected', reason: 'Offline' }, 200);
  assert.equal(nextBackend.fetchedAt, 200);
  assert.equal(nextScript.fetchedAt, 100);
  assert.equal(nextScript.records[0].name, 'Sheet record');
  assert.equal(new Set([...nextBackend.records, ...nextScript.records].map(row => row.key)).size, 2);
});
