import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, type Auth } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, type Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

let app: ReturnType<typeof initializeApp> | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

try {
  const useEmulators = import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true';
  if (useEmulators && !firebaseConfig.projectId?.startsWith('demo-')) {
    throw new Error('Local emulator mode requires a demo- Firebase project ID.');
  }
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  if (useEmulators) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099');
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
  }
} catch (e) {
  app = null;
  auth = null;
  db = null;
  console.warn('Firebase initialization failed — running without auth:', (e as Error).message);
}

/**
 * Return the Auth instance or fail with a diagnosable error.
 *
 * `auth` and `db` are nullable because initialization is allowed to fail, so
 * every consumer previously dereferenced a possibly-null value. That surfaced
 * as an opaque `TypeError: Cannot read properties of null` at click time. These
 * accessors turn it into a clear message at the boundary.
 */
export function requireAuth(): Auth {
  if (!auth) {
    throw new Error(
      'Firebase Auth is not initialized. Check VITE_FIREBASE_* configuration.'
    );
  }
  return auth;
}

/**
 * Return the Firestore instance or fail with a diagnosable error.
 * @return {Firestore} The initialized Firestore instance.
 */
export function requireDb(): Firestore {
  if (!db) {
    throw new Error(
      'Firestore is not initialized. Check VITE_FIREBASE_* configuration.'
    );
  }
  return db;
}

export { auth, db };
export default app;
