import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  User as FirebaseUser,
  onAuthStateChanged,
  signOut
} from 'firebase/auth';
import { auth } from '../lib/firebase';

interface User {
  uid: string;
  displayName: string;
  email: string;
  phoneNumber?: string;
  photoURL: string;
}

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  login: (userData?: User) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function firebaseUserToUser(fbUser: FirebaseUser): User {
  return {
    uid: fbUser.uid,
    displayName: fbUser.displayName || fbUser.email?.split('@')[0] || 'User',
    email: fbUser.email || '',
    phoneNumber: fbUser.phoneNumber || undefined,
    photoURL: fbUser.photoURL || '',
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Authentication state comes from Firebase only. It used to be seeded from
  // localStorage, which meant anyone could write a `nodalx_user` object and
  // satisfy the client-side route guard. The real data was still protected
  // server-side, but the gate itself was decorative.
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!auth) {
      setIsLoading(false);
      return;
    }

    // Expose a getter rather than a cached token string. A token copied onto
    // `window` is readable by any injected or third-party script, and the cached
    // copy went stale after Firebase's ~1h expiry. getIdToken() transparently
    // refreshes, so callers always receive a currently-valid credential.
    (window as any).__nodalxGetIdToken = () =>
      auth?.currentUser ? auth.currentUser.getIdToken() : Promise.resolve(null);

    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      setFirebaseUser(fbUser);
      // A null fbUser means Firebase has no session, which must clear the UI
      // unconditionally. Previously this branch only cleared when the
      // localStorage copy was also gone, so signing out in another tab or a
      // revoked session left a stale "logged in" view with a dead token.
      setUser(fbUser ? firebaseUserToUser(fbUser) : null);
      setIsLoading(false);
    });

    return () => {
      unsubscribe();
      delete (window as any).__nodalxGetIdToken;
    };
  }, []);

  const login = async (userData?: User) => {
    // Firebase's onAuthStateChanged is the source of truth; this only applies an
    // optimistically supplied profile while that resolves.
    if (userData) setUser(userData);
  };

  const logout = async () => {
    try {
      if (auth) await signOut(auth);
    } catch (error) {
      console.error('Firebase sign out error:', error);
    }
    setUser(null);
    setFirebaseUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, firebaseUser, login, logout, isLoading, setIsLoading }}>
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
