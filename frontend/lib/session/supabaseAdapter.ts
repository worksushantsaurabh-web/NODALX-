import type {SupabaseClient, User} from '@supabase/supabase-js';
import {toSessionUser, type SessionProvider, type SessionUser} from './core.ts';

export function mapSupabaseUser(user: User): SessionUser {
  return toSessionUser({
    uid: user.id,
    email: user.email,
    displayName: typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : null,
    phoneNumber: user.phone,
    photoURL: typeof user.user_metadata?.avatar_url === 'string' ? user.user_metadata.avatar_url : null,
  });
}

export function createSupabaseSessionProvider(client: SupabaseClient | null): SessionProvider {
  let current: SessionUser | null = null;
  let revision = 0;
  let generation = 0;
  let observedIdentity: string | null = null;
  const listeners = new Set<(user: SessionUser | null) => void>();
  let unsubscribe: (() => void) | undefined;

  const publish = (user: SessionUser | null) => {
    current = user;
    listeners.forEach(listener => listener(user));
  };

  const verify = async (accessToken: string | undefined, expectedRevision: number) => {
    if (!client || !accessToken) {
      if (revision === expectedRevision) publish(null);
      return;
    }
    try {
      const {data, error} = await client.auth.getUser(accessToken);
      if (revision !== expectedRevision) return;
      publish(!error && data.user && !data.user.is_anonymous ? mapSupabaseUser(data.user) : null);
    } catch {
      if (revision === expectedRevision) publish(null);
    }
  };

  return {
    name: 'supabase',
    isAvailable: () => client !== null,
    getCurrentUser: () => current,
    getAccessToken: async options => {
      if (!client) return null;
      const expectedGeneration = generation;
      const identity = current?.uid || observedIdentity;
      try {
        const {data, error} = options?.forceRefresh
          ? await client.auth.refreshSession()
          : await client.auth.getSession();
        if (generation !== expectedGeneration) return null;
        if (error || !data.session) {
          publish(null);
          return null;
        }
        const verified = await client.auth.getUser(data.session.access_token);
        if (generation !== expectedGeneration) return null;
        if (verified.error || !verified.data.user || verified.data.user.is_anonymous) {
          publish(null);
          return null;
        }
        if (identity && verified.data.user.id !== identity) return null;
        publish(mapSupabaseUser(verified.data.user));
        return data.session.access_token;
      } catch {
        if (generation === expectedGeneration) publish(null);
        return null;
      }
    },
    onSessionChange: listener => {
      listeners.add(listener);
      if (!client) {
        listener(null);
      } else if (!unsubscribe) {
        const {data} = client.auth.onAuthStateChange((_event, session) => {
          const expectedRevision = ++revision;
          const nextIdentity = session?.user.id || null;
          if (!session || observedIdentity !== nextIdentity) generation++;
          observedIdentity = nextIdentity;
          if (!session) publish(null);
          else {
            if (current && current.uid !== session.user.id) publish(null);
            // Run outside the SDK's auth-state callback/lock before calling getUser.
            setTimeout(() => {void verify(session.access_token, expectedRevision);}, 0);
          }
        });
        unsubscribe = () => data.subscription.unsubscribe();
      } else {
        listener(current);
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          unsubscribe?.();
          unsubscribe = undefined;
          revision++;
          generation++;
          observedIdentity = null;
          current = null;
        }
      };
    },
    signOut: async () => {
      revision++;
      generation++;
      observedIdentity = null;
      publish(null);
      if (!client) return;
      const {error} = await client.auth.signOut();
      if (error) throw error;
    },
  };
}
