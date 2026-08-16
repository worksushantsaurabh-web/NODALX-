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
const AUTH_STORAGE_KEY = 'nodalx_user';

function getStoredUser(): User | null {
  try {
    const storedUser = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!storedUser) return null;

    const user = JSON.parse(storedUser) as User;
    return user.uid && user.displayName && user.email ? user : null;
  } catch {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}

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
  const [user, setUser] = useState<User | null>(getStoredUser);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Start true until we know auth state

  useEffect(() => {
    if (!auth) {
      setIsLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        const mapped = firebaseUserToUser(fbUser);
        setUser(mapped);
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(mapped));
        try {
          const token = await fbUser.getIdToken();
          (window as any).__nodalxFirebaseToken = token;
        } catch {
          (window as any).__nodalxFirebaseToken = null;
        }
      } else {
        const stored = getStoredUser();
        if (!stored) {
          setUser(null);
          localStorage.removeItem(AUTH_STORAGE_KEY);
        }
        (window as any).__nodalxFirebaseToken = null;
      }
      setIsLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = async (userData?: User) => {
    if (userData) {
      setUser(userData);
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userData));
    }
  };

  const logout = async () => {
    try {
      if (auth) await signOut(auth);
    } catch (error) {
      console.error('Firebase sign out error:', error);
    }
    setUser(null);
    setFirebaseUser(null);
    localStorage.removeItem(AUTH_STORAGE_KEY);
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