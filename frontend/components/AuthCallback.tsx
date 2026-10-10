import {useEffect, useState} from 'react';
import {requireSupabase} from '../lib/supabase';
import {api} from '../src/services/api';

/** Fixed callback path; never reads a caller-supplied redirect destination. */
export default function AuthCallback() {
  const recovery = new URLSearchParams(window.location.search).get('flow') === 'recovery';
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  useEffect(() => {
    let active = true;
    const finish = async () => {
      const client = requireSupabase();
      // getSession waits for SDK PKCE callback initialization to finish.
      const session = await client.auth.getSession();
      if (session.error || !session.data.session) throw new Error('The link is invalid or expired. Request a new link.');
      const verified = await client.auth.getUser();
      if (verified.error || !verified.data.user) throw new Error('Unable to verify your session.');
      if (!active) return;
      if (recovery) setReady(true);
      else {
        await api.get('/api/user/profile');
        if (active) window.location.replace('/#/dashboard');
      }
    };
    void finish().catch(failure => {if (active) setError(failure instanceof Error ? failure.message : 'Authentication callback failed.');});
    return () => {active = false;};
  }, [recovery]);
  return <main className="min-h-screen bg-bg text-text-primary flex items-center justify-center p-6">
    <div className="w-full max-w-sm bg-surface border border-border rounded-xl p-6">
      <h1 className="text-xl font-semibold mb-4">{recovery ? 'Choose a new password' : 'Confirming sign-in'}</h1>
      {error && <p role="alert" className="text-sm mb-4">{error}</p>}
      {ready && <form onSubmit={async event => {
        event.preventDefault(); setPending(true); setError('');
        try {
          const result = await requireSupabase().auth.updateUser({password});
          if (result.error) throw result.error;
          await requireSupabase().auth.signOut();
          window.location.replace('/');
        } catch (failure) {setError(failure instanceof Error ? failure.message : 'Password update failed.');}
        finally {setPending(false);}
      }}>
        <label className="block text-sm">New password<input required minLength={6} type="password" autoComplete="new-password" className="w-full g-input p-3 my-3" value={password} onChange={event => setPassword(event.target.value)} /></label>
        <button disabled={pending} className="w-full btn-primary py-3 rounded-lg">{pending ? 'Saving…' : 'Update password'}</button>
      </form>}
      {!ready && !error && <p role="status">Verifying your account…</p>}
      <a className="block mt-4 text-accent text-sm" href="/">Return to NodalX</a>
    </div>
  </main>;
}
