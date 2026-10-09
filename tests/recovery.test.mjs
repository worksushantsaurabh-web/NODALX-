import assert from 'node:assert/strict';
import {test} from 'node:test';
import {updateRecoveredPassword, verifyRecoveryCode} from '../frontend/lib/recovery.ts';

test('recovery code is verified for the requested email and cannot be skipped', async () => {
  const calls = [];
  const auth = {
    verifyOtp: async input => {calls.push(input); return {error: null};},
  };
  await assert.rejects(verifyRecoveryCode(auth, 'owner@example.test', '123'), /complete recovery code/);
  assert.equal(calls.length, 0);
  await verifyRecoveryCode(auth, ' owner@example.test ', '123 456');
  assert.deepEqual(calls, [{email: 'owner@example.test', token: '123456', type: 'recovery'}]);
});

test('password update follows recovery verification and signs out', async () => {
  const calls = [];
  const auth = {
    verifyOtp: async () => {calls.push('verify'); return {error: null};},
    updateUser: async ({password}) => {calls.push(password); return {error: null};},
    signOut: async () => {calls.push('sign-out'); return {error: null};},
  };
  await verifyRecoveryCode(auth, 'owner@example.test', '123456');
  await updateRecoveredPassword(auth, 'new-password');
  assert.deepEqual(calls, ['verify', 'new-password', 'sign-out']);
});

test('a failed password update does not sign out a recoverable session', async () => {
  let signedOut = false;
  const auth = {
    updateUser: async () => ({error: new Error('password rejected')}),
    signOut: async () => {signedOut = true; return {error: null};},
  };
  await assert.rejects(updateRecoveredPassword(auth, 'new-password'), /password rejected/);
  assert.equal(signedOut, false);
});
