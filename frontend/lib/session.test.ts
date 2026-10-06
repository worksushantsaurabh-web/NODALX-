import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  authorizationHeader,
  getAccessToken,
  getCurrentSessionUser,
  getSessionProvider,
  isSessionAvailable,
  onSessionChange,
  registerSessionProvider,
  toSessionUser,
  unavailableSessionProvider,
  type SessionProvider,
  type SessionUser,
} from './session/core.ts';

function fakeProvider(overrides: Partial<SessionProvider> = {}): SessionProvider & {emit(u: SessionUser | null): void} {
  const listeners = new Set<(u: SessionUser | null) => void>();
  let current: SessionUser | null = null;
  return {
    name: 'fake',
    isAvailable: () => true,
    getCurrentUser: () => current,
    getAccessToken: async () => (current ? `token-for-${current.uid}` : null),
    onSessionChange: (listener) => {
      listeners.add(listener);
      listener(current);
      return () => listeners.delete(listener);
    },
    signOut: async () => {
      current = null;
      listeners.forEach((l) => l(null));
    },
    emit(u) {
      current = u;
      listeners.forEach((l) => l(u));
    },
    ...overrides,
  };
}

test('with no provider registered there is no user, token or auth header', async (t) => {
  t.after(() => registerSessionProvider(unavailableSessionProvider));
  registerSessionProvider(unavailableSessionProvider);
  assert.equal(getSessionProvider().name, 'none');
  assert.equal(isSessionAvailable(), false);
  assert.equal(getCurrentSessionUser(), null);
  assert.equal(await getAccessToken(), null);
  assert.deepEqual(await authorizationHeader(), {});
  const seen: Array<SessionUser | null> = [];
  onSessionChange((u) => seen.push(u))();
  assert.deepEqual(seen, [null]);
});

test('a fabricated client identity cannot satisfy the session guard', async (t) => {
  t.after(() => registerSessionProvider(unavailableSessionProvider));
  const storage = new Map<string, string>([
    ['nodalx_user', JSON.stringify({uid: 'attacker', email: 'a@example.com'})],
  ]);
  (globalThis as any).localStorage = {getItem: (k: string) => storage.get(k) ?? null};
  (globalThis as any).__nodalxGetIdToken = async () => 'forged-token';
  t.after(() => {
    delete (globalThis as any).localStorage;
    delete (globalThis as any).__nodalxGetIdToken;
  });

  registerSessionProvider(unavailableSessionProvider);
  assert.equal(getCurrentSessionUser(), null);
  assert.equal(await getAccessToken(), null);

  // A provider that reports unavailable is never trusted, even if it claims a user.
  registerSessionProvider(fakeProvider({
    isAvailable: () => false,
    getCurrentUser: () => toSessionUser({uid: 'attacker'}),
    getAccessToken: async () => 'forged-token',
  }));
  assert.equal(getCurrentSessionUser(), null);
  assert.equal(await getAccessToken(), null);
});

test('session changes propagate sign-in, identity switch and sign-out', async (t) => {
  t.after(() => registerSessionProvider(unavailableSessionProvider));
  const provider = fakeProvider();
  registerSessionProvider(provider);
  const seen: Array<string | null> = [];
  const unsubscribe = onSessionChange((u) => seen.push(u?.uid ?? null));

  provider.emit(toSessionUser({uid: 'user-a', email: 'a@example.com'}));
  assert.deepEqual(await authorizationHeader(), {Authorization: 'Bearer token-for-user-a'});
  provider.emit(toSessionUser({uid: 'user-b'}));
  assert.equal(await getAccessToken(), 'token-for-user-b');
  await provider.signOut();
  assert.equal(await getAccessToken(), null);
  unsubscribe();
  provider.emit(toSessionUser({uid: 'user-c'}));

  assert.deepEqual(seen, [null, 'user-a', 'user-b', null]);
});

test('empty or non-string tokens are treated as signed out', async (t) => {
  t.after(() => registerSessionProvider(unavailableSessionProvider));
  registerSessionProvider(fakeProvider({getAccessToken: async () => ''}));
  assert.equal(await getAccessToken(), null);
  assert.deepEqual(await authorizationHeader(), {});
});

test('forceRefresh is forwarded to the provider', async (t) => {
  t.after(() => registerSessionProvider(unavailableSessionProvider));
  const calls: unknown[] = [];
  registerSessionProvider(fakeProvider({getAccessToken: async (o) => {calls.push(o?.forceRefresh); return 't';}}));
  await getAccessToken({forceRefresh: true});
  await getAccessToken();
  assert.deepEqual(calls, [true, undefined]);
});

test('toSessionUser maps provider profiles without leaking extra fields', () => {
  const raw = {uid: 'u1', email: 'jo@example.com', displayName: null, phoneNumber: null, photoURL: null, providerData: ['x']};
  assert.deepEqual(toSessionUser(raw), {uid: 'u1', displayName: 'jo', email: 'jo@example.com', phoneNumber: undefined, photoURL: ''});
  assert.equal(toSessionUser({uid: 'u2'}).displayName, 'User');
});
