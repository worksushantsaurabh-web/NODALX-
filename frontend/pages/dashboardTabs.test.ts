import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveDashboardTab} from './dashboardTabs.ts';

test('legacy dashboard links resolve to the consolidated screen', () => {
  assert.equal(resolveDashboardTab('reports'), 'overview');
  assert.equal(resolveDashboardTab('integration'), 'connections');
  assert.equal(resolveDashboardTab('inquiries'), 'inquiries');
  assert.equal(resolveDashboardTab('connectors'), 'connectors');
});

test('the automation screen is reachable by its own tab and by a legacy alias', () => {
  assert.equal(resolveDashboardTab('automation'), 'automation');
  assert.equal(resolveDashboardTab('automation', 'overview'), 'automation');
  // "recipes" and "exceptions" were never shipped tabs; they must not resolve
  // to the automation screen by accident.
  assert.equal(resolveDashboardTab('recipes', 'automation'), 'automation');
  assert.equal(resolveDashboardTab('exceptions', 'overview'), 'overview');
});

test('invalid query values cannot switch to an unrelated screen', () => {
  assert.equal(resolveDashboardTab('command-center', 'inquiries'), 'inquiries');
  assert.equal(resolveDashboardTab(null), 'overview');
  assert.equal(resolveDashboardTab('constructor', 'invalid'), 'inquiries');
});
