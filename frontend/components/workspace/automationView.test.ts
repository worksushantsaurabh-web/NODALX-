import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  exceptionActions,
  exceptionSummary,
  exceptionTitle,
  formatFrequency,
  formatNextRun,
  mergeExceptionPages,
  openExceptionCount,
  policyConsequence,
  policyExplanation,
  recipeStatusDetail,
  recipeStatusLabel,
  type ImportException,
  type Recipe,
} from './automationView.ts';

const recipe = (overrides: Partial<Recipe> = {}): Recipe => ({
  id: 'r1',
  name: 'Website leads',
  mode: 'import',
  status: 'active',
  enabled: true,
  pauseReason: null,
  initialPolicy: 'baseline',
  frequencyMinutes: 15,
  rowCap: 25,
  dailyCreditCap: 0,
  mapping: {message: 'Message'},
  sourceIdColumn: 'Order ID',
  baselineAppliedAt: 1,
  nextRunAt: null,
  lastRunAt: null,
  lastSuccessfulRunAt: null,
  ...overrides,
});

const exception = (overrides: Partial<ImportException> = {}): ImportException => ({
  id: 'e1',
  type: 'record_edited',
  state: 'open',
  detail: 'A source record changed after approval.',
  hint: 'Review this record.',
  recipeId: 'r1',
  recipeName: 'Website leads',
  scope: 'A-1',
  recordKey: 'A-1',
  count: 1,
  firstSeenAt: 0,
  lastSeenAt: 0,
  ...overrides,
});

test('status label and detail never imply a paused recipe is still checking', () => {
  assert.equal(recipeStatusLabel(recipe()), 'Checking automatically');
  assert.equal(recipeStatusDetail(recipe()), 'Every 15 minutes.');
  assert.equal(recipeStatusLabel(recipe({status: 'draft', enabled: false})), 'Not enabled');
  assert.equal(
    recipeStatusDetail(recipe({status: 'draft', enabled: false})),
    'Preview and confirm the recipe to start checking this source.',
  );
  // A paused recipe surfaces the server-authored reason verbatim.
  assert.equal(recipeStatusLabel(recipe({status: 'paused', enabled: false})), 'Paused');
  assert.equal(
    recipeStatusDetail(recipe({status: 'paused', pauseReason: 'The source headings changed after approval.'})),
    'The source headings changed after approval.',
  );
  // A pause with no recorded reason must not fabricate one.
  assert.equal(
    recipeStatusDetail(recipe({status: 'paused', pauseReason: null})),
    'Automation is paused until you resume it.',
  );
});

test('frequency formatting covers minutes, hours, days and junk input', () => {
  assert.equal(formatFrequency(1), '1 minute');
  assert.equal(formatFrequency(15), '15 minutes');
  assert.equal(formatFrequency(60), '1 hour');
  assert.equal(formatFrequency(90), '1.5 hours');
  assert.equal(formatFrequency(1440), '1 day');
  assert.equal(formatFrequency(2880), '2 days');
  // Nonsensical values must not render as "NaN" or an empty schedule.
  assert.equal(formatFrequency(0), 'on the configured schedule');
  assert.equal(formatFrequency(-5), 'on the configured schedule');
  assert.equal(formatFrequency(Number.NaN), 'on the configured schedule');
});

test('next run is described relatively and never as a negative wait', () => {
  const now = 1_000_000_000_000;
  assert.equal(formatNextRun(null, now), 'No check scheduled');
  assert.equal(formatNextRun(now - 5000, now), 'Due now');
  assert.equal(formatNextRun(now + 60_000, now), 'Next check in 1 minute');
  assert.equal(formatNextRun(now + 15 * 60_000, now), 'Next check in 15 minutes');
  assert.equal(formatNextRun(now + 3_600_000, now), 'Next check in 1 hour');
  assert.equal(formatNextRun(now + 86_400_000, now), 'Next check in 1 day');
});

test('first-run policy states the irreversible outcome in both directions', () => {
  assert.match(policyExplanation('baseline'), /without importing/);
  assert.match(policyExplanation('backlog'), /already exist now/);
  assert.match(policyConsequence('baseline', 12), /will not be imported and will not use credits/);
  assert.match(policyConsequence('baseline', 1), /1 existing row will not be imported/);
  assert.match(policyConsequence('backlog', 0), /0 existing eligible rows will be imported/);
  // A missing preview count must read honestly rather than as NaN.
  assert.match(policyConsequence('backlog', null), /0 existing eligible rows/);
});

test('exception actions expose only what the API accepts and never offer retry', () => {
  assert.deepEqual(exceptionActions(exception()), ['acknowledge', 'ignore']);
  assert.deepEqual(exceptionActions(exception({state: 'acknowledged'})), ['ignore']);
  assert.deepEqual(exceptionActions(exception({state: 'resolved'})), []);
  // There is no retry endpoint, so no state may advertise one.
  for (const state of ['open', 'acknowledged', 'resolved'] as const) {
    assert.equal(exceptionActions(exception({state})).includes('retry' as never), false);
  }
});

test('exception titles map known types and fall back safely', () => {
  assert.equal(exceptionTitle(exception()), 'A source record changed');
  assert.equal(exceptionTitle(exception({type: 'schema_drift'})), 'Source headings changed');
  assert.equal(exceptionTitle(exception({type: 'budget_exhausted'})), 'Daily budget reached');
  assert.equal(exceptionTitle(exception({type: 'something_new'})), 'Automation needs review');
});

test('exception summary includes record, repeat count and stays finite', () => {
  assert.equal(
    exceptionSummary(exception()),
    'A source record changed after approval. Record A-1.',
  );
  assert.match(exceptionSummary(exception({count: 4})), /Seen 4 times\./);
  // No record key means no dangling "Record undefined."
  assert.equal(
    exceptionSummary(exception({recordKey: null, count: 1})),
    'A source record changed after approval.',
  );
});

test('merged pages deduplicate by id and open count only counts open items', () => {
  const pages = [
    [exception({id: 'a'}), exception({id: 'b', state: 'acknowledged'})],
    [exception({id: 'b'}), exception({id: 'c'})],
  ];
  assert.deepEqual(mergeExceptionPages(pages).map(item => item.id), ['a', 'b', 'c']);
  assert.equal(openExceptionCount(pages), 2);
  assert.equal(openExceptionCount([]), 0);
});