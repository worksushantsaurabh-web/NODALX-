import type {SupabaseClient} from '@supabase/supabase-js';

type RecoveryAuth = Pick<SupabaseClient['auth'], 'verifyOtp' | 'updateUser' | 'signOut'>;

export async function verifyRecoveryCode(auth: RecoveryAuth, email: string, input: string): Promise<void> {
  const token = input.replace(/\s+/g, '');
  if (!/^\d{6,8}$/.test(token)) throw new Error('Enter the complete recovery code.');
  const result = await auth.verifyOtp({email: email.trim(), token, type: 'recovery'});
  if (result.error) throw result.error;
}

export async function updateRecoveredPassword(auth: RecoveryAuth, password: string): Promise<void> {
  if (password.length < 6) throw new Error('Password must be at least 6 characters.');
  const updated = await auth.updateUser({password});
  if (updated.error) throw updated.error;
  const signedOut = await auth.signOut();
  if (signedOut.error) throw signedOut.error;
}
