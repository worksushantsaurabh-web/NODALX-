import {test} from 'node:test';
import assert from 'node:assert/strict';
import {batchLimit, canSaveRecipeDraft, importReadiness, matchesJob} from './importReadiness.ts';

const usage = {active: true, workflowConfigured: false, remaining: 0, inquiries: 90, intakeReserved: 3, activeJobs: 0, limits: {inquiries: 100, batchRows: 25, concurrentJobs: 1}};

test('import-only ignores analysis credits but respects reserved inquiry allowance', () => {
  assert.equal(batchLimit(20, usage, 'import'), 7);
  assert.equal(batchLimit(20, usage, 'analyze'), 0);
  assert.equal(importReadiness(20, usage, 'import').every(check => check.ready), true);
  assert.equal(importReadiness(20, usage, 'analyze').every(check => check.ready), false);
});

test('readiness fails closed for unloaded, expired, busy and full workspaces', () => {
  assert.equal(batchLimit(20, null, 'import'), 0);
  assert.equal(importReadiness(20, null, 'import').every(check => check.ready), false);
  for (const change of [{active: false}, {activeJobs: 1}, {intakeReserved: 10}]) {
    assert.equal(importReadiness(20, {...usage, ...change}, 'import').every(check => check.ready), false);
  }
  assert.equal(importReadiness(0, usage, 'import')[0].ready, false);
});

test('job filters match titles case-insensitively and exact statuses', () => {
  const job = {title: 'Customer Export.csv', status: 'partial'};
  assert.equal(matchesJob(job, ' EXPORT ', 'all'), true);
  assert.equal(matchesJob(job, 'customer', 'partial'), true);
  assert.equal(matchesJob(job, '', 'completed'), false);
});

test('recipe draft readiness requires identity fields and mode-specific budget', () => {
  const base = {name: 'Website leads', sourceIdColumn: 'Order ID', frequencyMinutes: 1440, rowCap: 25};
  assert.equal(canSaveRecipeDraft({...base, mode: 'import', dailyCreditCap: 0}), true);
  assert.equal(canSaveRecipeDraft({...base, mode: 'analyze', dailyCreditCap: 1}), true);
  assert.equal(canSaveRecipeDraft({...base, mode: 'analyze', dailyCreditCap: 0}), false);
  assert.equal(canSaveRecipeDraft({...base, name: '', mode: 'analyze', dailyCreditCap: 1}), false);
  assert.equal(canSaveRecipeDraft({...base, sourceIdColumn: '', mode: 'analyze', dailyCreditCap: 1}), false);
});
