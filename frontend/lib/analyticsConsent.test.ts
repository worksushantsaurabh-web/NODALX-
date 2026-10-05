import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readAnalyticsConsent, writeAnalyticsConsent} from './analyticsConsent.ts';

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
