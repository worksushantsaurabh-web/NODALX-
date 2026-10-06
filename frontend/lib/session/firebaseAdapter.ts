/**
 * TEMPORARY Firebase implementation of the session boundary.
 *
 * This is the only module (besides sign-in UI still pending migration) that
 * should touch Firebase Auth user objects. Replace it with a Supabase adapter
 * in Phase 3 of docs/runbooks/supabase-migration-instructions.md; consumers do
 * not change.
 */
import {onAuthStateChanged, signOut, type User as FirebaseUser} from 'firebase/auth';
import {auth} from '../firebase';
import {toSessionUser, type SessionProvider, type SessionUser} from './core';

const mapUser = (user: FirebaseUser | null): SessionUser | null => (user ? toSessionUser(user) : null);

export const firebaseSessionProvider: SessionProvider = {
  name: 'firebase',
  isAvailable: () => auth !== null,
  getCurrentUser: () => mapUser(auth?.currentUser ?? null),
  getAccessToken: async (options) => {
    const current = auth?.currentUser;
    return current ? current.getIdToken(options?.forceRefresh === true) : null;
  },
  onSessionChange: (listener) => {
    if (!auth) {
      listener(null);
      return () => {};
    }
    return onAuthStateChanged(auth, (user) => listener(mapUser(user)));
  },
  signOut: async () => {
    if (auth) await signOut(auth);
  },
};
