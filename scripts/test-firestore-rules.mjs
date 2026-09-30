import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(new URL('../frontend/package.json', import.meta.url));
const { initializeApp, deleteApp } = require('firebase/app');
const { getFirestore, connectFirestoreEmulator, doc, setDoc, getDoc, updateDoc } = require('firebase/firestore');
if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Emulator required');
const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
const app = initializeApp({ projectId: 'demo-nodalx-security', apiKey: 'demo' });
const db = getFirestore(app);
connectFirestoreEmulator(db, host, Number(port), { mockUserToken: { sub: 'rules-test-user', user_id: 'rules-test-user' } });
const denied = (operation) => assert.rejects(operation, (e) => e.code === 'permission-denied');
try {
  const user = doc(db, 'users/rules-test-user');
  await denied(setDoc(user, { uid: 'rules-test-user', tier: 'full' }));
  await denied(setDoc(user, { uid: 'someone-else', tier: 'free' }));
  await setDoc(user, { uid: 'rules-test-user', tier: 'free' });
  assert.equal((await getDoc(user)).data().tier, 'free');
  await denied(updateDoc(user, { tier: 'full' }));
  await denied(setDoc(doc(db, 'users/rules-test-user/profile/main'), { subscription: { tier: 'enterprise' } }));
  await denied(getDoc(doc(db, 'users/another-user')));
  await denied(setDoc(doc(db, 'inquiries/client-created'), { customerId: 'rules-test-user' }));
  console.log('Rules: free signup allowed; tier escalation, profile writes, cross-tenant reads and direct intake denied.');
} finally {
  await deleteApp(app);
}
