import {test} from 'node:test';
import assert from 'node:assert/strict';
import {analyticsEnabled, getAnalyticsSink, installAnalyticsSink, readAnalyticsConsent, writeAnalyticsConsent} from './analyticsConsent.ts';

test('analytics defaults to no consent and inaccessible storage fails closed', () => {
  assert.equal(readAnalyticsConsent({getItem: () => null}), null);
  assert.equal(readAnalyticsConsent({getItem: () => 'unexpected'}), null);
  assert.equal(readAnalyticsConsent({getItem: () => {throw Error('Storage blocked');}}), null);
  assert.equal(writeAnalyticsConsent(true, {setItem: () => {throw Error('Storage blocked');}}), false);
});

test('a saved decline remains separate from a saved grant', () => {
  let value = '';
  const storage = {getItem: () => value, setItem: (key: string, next: string) => {value = next;}};
  assert.equal(writeAnalyticsConsent(true, storage), true);
  assert.equal(readAnalyticsConsent(storage), true);
  assert.equal(writeAnalyticsConsent(false, storage), true);
  assert.equal(readAnalyticsConsent(storage), false);
});

test('no external tracker is installed by default, so analytics stays disabled', () => {
  assert.equal(getAnalyticsSink(), null);
  assert.equal(analyticsEnabled({VITE_ANALYTICS_ENABLED: 'true'}), false);
  assert.equal(analyticsEnabled({}), false);
});

test('analytics requires both an installed tracker and the deployment opt-in', (t) => {
  t.after(() => installAnalyticsSink(null));
  installAnalyticsSink({name: 'test', track: () => {}, setCollectionEnabled: () => {}});
  assert.equal(analyticsEnabled({VITE_ANALYTICS_ENABLED: 'false'}), false);
  assert.equal(analyticsEnabled({VITE_ANALYTICS_ENABLED: 'true'}), true);
});
