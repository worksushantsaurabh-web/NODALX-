import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSupabaseSessionProvider} from './session/supabaseAdapter.ts';

test('a late verified identity cannot repopulate the session after sign-out', async () => {
  let callback: any;
  let resolve: any;
  const verified = new Promise<any>(done => {resolve = done;});
  const client: any = {auth: {
    onAuthStateChange: (listener: any) => {callback = listener; return {data: {subscription: {unsubscribe() {}}}};},
    getUser: () => verified,
    signOut: async () => ({error: null}),
  }};
  const provider = createSupabaseSessionProvider(client);
  const seen: unknown[] = [];
  const unsubscribe = provider.onSessionChange(user => seen.push(user));
  callback('SIGNED_IN', {access_token: 'synthetic', user: {id: 'user-a'}});
  await new Promise(done => setTimeout(done, 10));
  await provider.signOut();
  resolve({data: {user: {id: 'user-a', email: 'a@example.test'}}, error: null});
  await new Promise(done => setTimeout(done, 10));
  assert.equal(provider.getCurrentUser(), null);
  assert.deepEqual(seen, [null]);
  unsubscribe();
});

test('unconfigured Supabase provider never exposes an identity or token', async () => {
  const provider = createSupabaseSessionProvider(null);
  assert.equal(provider.isAvailable(), false);
  assert.equal(await provider.getAccessToken(), null);
  const stop = provider.onSessionChange(user => assert.equal(user, null));
  stop();
});

test('pending token lookup cannot return a credential after sign-out', async () => {
  let resolveSession: any;
  const client: any = {auth: {
    getSession: () => new Promise(resolve => {resolveSession = resolve;}),
    getUser: async () => ({data: {user: {id: 'user-a'}}, error: null}),
    signOut: async () => ({error: null}),
  }};
  const provider = createSupabaseSessionProvider(client);
  const pending = provider.getAccessToken();
  await provider.signOut();
  resolveSession({data: {session: {access_token: 'stale'}}, error: null});
  assert.equal(await pending, null);
  assert.equal(provider.getCurrentUser(), null);
});

test('same-user refresh events do not discard the refreshed token', async () => {
  let callback: any;
  const session = {access_token: 'fresh', user: {id: 'user-a'}};
  const client: any = {auth: {
    onAuthStateChange: (listener: any) => {callback = listener; return {data: {subscription: {unsubscribe() {}}}};},
    getUser: async () => ({data: {user: {id: 'user-a'}}, error: null}),
    refreshSession: async () => {callback('TOKEN_REFRESHED', session); return {data: {session}, error: null};},
  }};
  const provider = createSupabaseSessionProvider(client);
  const stop = provider.onSessionChange(() => {});
  callback('SIGNED_IN', session);
  await new Promise(done => setTimeout(done, 10));
  assert.equal(await provider.getAccessToken({forceRefresh: true}), 'fresh');
  stop();
});

test('provider network failure fails closed without leaving a stale user', async () => {
  const client: any = {auth: {getSession: async () => {throw new Error('network');}}};
  const provider = createSupabaseSessionProvider(client);
  assert.equal(await provider.getAccessToken(), null);
  assert.equal(provider.getCurrentUser(), null);
});
