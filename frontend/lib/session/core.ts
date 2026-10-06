/**
 * Provider-neutral session boundary.
 *
 * UI code and API clients depend on this module instead of a specific identity
 * SDK. The active Supabase provider is registered once at startup.
 * This file must stay free of SDK imports
 * so it can be unit-tested and so swapping providers never touches consumers.
 *
 * Security property: the only way to obtain a signed-in `SessionUser` is from
 * the registered provider's own session callback. Nothing here reads identity
 * from localStorage, URL parameters or caller-supplied objects, so a fabricated
 * client identity cannot satisfy the route guard. Server endpoints still verify
 * the bearer token independently; this guard is a UX gate, not authorization.
 */

export interface SessionUser {
  uid: string;
  displayName: string;
  email: string;
  phoneNumber?: string;
  photoURL: string;
}

export interface SessionProvider {
  /** Stable provider name for diagnostics, e.g. `firebase`, `supabase`, `none`. */
  readonly name: string;
  /** False when the SDK is not configured or failed to initialize. */
  isAvailable(): boolean;
  /** The provider's current signed-in user, or null. */
  getCurrentUser(): SessionUser | null;
  /**
   * A currently valid bearer token for the signed-in user, or null when signed
   * out or unavailable. Implementations must refresh rather than return a stale
   * cached string. `forceRefresh` requests a fresh token from the provider.
   */
  getAccessToken(options?: {forceRefresh?: boolean}): Promise<string | null>;
  /** Subscribe to sign-in/sign-out/identity changes. Returns an unsubscribe. */
  onSessionChange(listener: (user: SessionUser | null) => void): () => void;
  signOut(): Promise<void>;
}

/** Provider used when no identity SDK is configured. Never reports a user. */
export const unavailableSessionProvider: SessionProvider = Object.freeze({
  name: 'none',
  isAvailable: () => false,
  getCurrentUser: () => null,
  getAccessToken: async () => null,
  onSessionChange: (listener: (user: SessionUser | null) => void) => {
    listener(null);
    return () => {};
  },
  signOut: async () => {},
});

let activeProvider: SessionProvider = unavailableSessionProvider;

export function registerSessionProvider(provider: SessionProvider): void {
  activeProvider = provider;
}

export function getSessionProvider(): SessionProvider {
  return activeProvider;
}

export function isSessionAvailable(): boolean {
  return activeProvider.isAvailable();
}

export function getCurrentSessionUser(): SessionUser | null {
  return activeProvider.isAvailable() ? activeProvider.getCurrentUser() : null;
}

export async function getAccessToken(options?: {forceRefresh?: boolean}): Promise<string | null> {
  const provider = activeProvider;
  if (!provider.isAvailable()) return null;
  const token = await provider.getAccessToken(options);
  if (provider !== activeProvider) return null;
  return typeof token === 'string' && token.length > 0 ? token : null;
}

export function onSessionChange(listener: (user: SessionUser | null) => void): () => void {
  return activeProvider.onSessionChange(listener);
}

export async function signOutSession(): Promise<void> {
  await activeProvider.signOut();
}

/** Bearer header for authenticated requests; empty when there is no session. */
export async function authorizationHeader(options?: {forceRefresh?: boolean}): Promise<Record<string, string>> {
  const token = await getAccessToken(options);
  return token ? {Authorization: `Bearer ${token}`} : {};
}

/** Map provider-specific profile fields to the UI-facing user shape. */
export function toSessionUser(raw: {
  uid: string;
  displayName?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  photoURL?: string | null;
}): SessionUser {
  return {
    uid: raw.uid,
    displayName: raw.displayName || raw.email?.split('@')[0] || 'User',
    email: raw.email || '',
    phoneNumber: raw.phoneNumber || undefined,
    photoURL: raw.photoURL || '',
  };
}
