import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  getAccessToken,
  getCurrentSessionUser,
  onSessionChange,
  signOutSession,
  type SessionUser,
} from '../lib/session';

type User = SessionUser;

interface AuthContextType {
  user: User | null;
  login: (userData?: User) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Authentication state comes from the registered session provider only. It
  // used to be seeded from localStorage, which meant anyone could write a
  // `nodalx_user` object and satisfy the client-side route guard. The real data
  // was still protected server-side, but the gate itself was decorative.
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Expose a getter rather than a cached token string. A token copied onto
    // `window` is readable by any injected or third-party script, and a cached
    // copy goes stale after expiry. The session provider refreshes, so callers
    // always receive a currently-valid credential.
    // LEGACY: only the dev-only vertex-ai-proxy-interceptor.js reads this.
    // Remove once that caller is migrated or retired (migration Phase 1.7).
    (window as any).__nodalxGetIdToken = () => getAccessToken();

    const unsubscribe = onSessionChange((sessionUser) => {
      // A null user means the provider has no session, which must clear the UI
      // unconditionally so sign-out in another tab or a revoked session cannot
      // leave a stale "logged in" view with a dead token.
      setUser(sessionUser);
      setIsLoading(false);
    });

    return () => {
      unsubscribe();
      delete (window as any).__nodalxGetIdToken;
    };
  }, []);

  const login = async (_userData?: User) => {
    // The session provider is the source of truth; this only applies an
    // optimistically supplied profile while that resolves.
    setUser(getCurrentSessionUser());
  };

  const logout = async () => {
    try {
      await signOutSession();
    } catch (error) {
      console.error('Sign out error:', error);
    }
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading, setIsLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
