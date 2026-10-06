import React, {useEffect, useState} from 'react';
import {X, LogIn, AlertCircle, RefreshCw} from 'lucide-react';
import {useNavigate} from 'react-router-dom';
import {requireSupabase} from '../lib/supabase';
import {api} from '../src/services/api';
import {Analytics} from '../lib/analytics';

export async function startGoogleSignIn() {
  if (import.meta.env.VITE_SUPABASE_GOOGLE_ENABLED !== 'true') {
    throw new Error('Google sign-in is not configured. Please use email sign-in.');
  }
  const {error} = await requireSupabase().auth.signInWithOAuth({
    provider: 'google', options: {redirectTo: `${window.location.origin}/auth/callback`},
  });
  if (error) throw error;
}

export default function SignInModal({isOpen, onClose}: {isOpen: boolean; onClose: () => void}) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [company, setCompany] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  useEffect(() => {
    if (!isOpen) {
      setPassword(''); setEmail(''); setFullName(''); setCompany('');
      setError(''); setInfo(''); setMode('signin');
      return;
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {document.body.style.overflow = previous;};
  }, [isOpen]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pending) return;
    setPending(true); setError(''); setInfo('');
    try {
      const client = requireSupabase();
      if (mode === 'forgot') {
        const result = await client.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/auth/callback?flow=recovery`,
        });
        if (result.error) throw result.error;
        setInfo('If this account exists, a password reset link has been sent.');
      } else if (mode === 'signup') {
        const result = await client.auth.signUp({email: email.trim(), password,
          options: {data: {full_name: fullName.trim(), company_name: company.trim()},
            emailRedirectTo: `${window.location.origin}/auth/callback`},
        });
        if (result.error) throw result.error;
        // Confirmed sessions alone may call the server-owned profile bootstrap.
        if (result.data.session) {
          await api.put('/api/user/profile', {displayName: fullName.trim(), workspace: company.trim()});
          onClose(); navigate('/dashboard');
        } else {
          setInfo('Check your email to confirm your account before signing in.');
          setMode('signin'); setPassword('');
        }
      } else {
        const result = await client.auth.signInWithPassword({email: email.trim(), password});
        if (result.error) throw result.error;
        await api.get('/api/user/profile');
        Analytics.signinComplete('email');
        onClose(); navigate('/dashboard');
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Authentication failed. Please retry.');
    } finally {setPending(false);}
  };
  if (!isOpen) return null;
  const input = 'w-full px-4 py-3 g-input text-sm text-text-primary';
  return <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
    <div className="absolute inset-0 modal-backdrop" onClick={onClose} aria-hidden="true" />
    <div className="relative w-full max-w-[420px] g-panel rounded-3xl p-6 sm:p-8 max-h-[90vh] overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="signin-title">
      <button onClick={onClose} aria-label="Close modal" className="absolute top-4 right-4 p-2 text-text-secondary"><X className="w-5 h-5" /></button>
      <LogIn className="mx-auto mb-4 text-accent" />
      <h3 id="signin-title" className="text-center text-2xl font-bold text-text-primary mb-5">{mode === 'signup' ? 'Create account' : mode === 'forgot' ? 'Reset password' : 'Sign in'}</h3>
      {error && <p role="alert" className="mb-4 text-sm text-text-primary"><AlertCircle className="inline w-4 h-4 mr-2" />{error}</p>}
      {info && <p role="status" className="mb-4 text-sm text-text-secondary">{info}</p>}
      <form onSubmit={submit} className="space-y-4">
        {mode === 'signup' && <>
          <label className="block text-sm text-text-secondary">Full name<input className={input} required maxLength={120} value={fullName} onChange={e => setFullName(e.target.value)} autoComplete="name" /></label>
          <label className="block text-sm text-text-secondary">Company name<input className={input} required maxLength={120} value={company} onChange={e => setCompany(e.target.value)} autoComplete="organization" /></label>
        </>}
        <label className="block text-sm text-text-secondary">Email<input className={input} required type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" /></label>
        {mode !== 'forgot' && <label className="block text-sm text-text-secondary">Password<input className={input} required type="password" minLength={mode === 'signup' ? 6 : undefined} value={password} onChange={e => setPassword(e.target.value)} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} /></label>}
        <button disabled={pending} className="w-full py-3 btn-primary rounded-xl disabled:opacity-50">{pending ? <RefreshCw className="w-4 h-4 animate-spin mx-auto" /> : mode === 'signup' ? 'Create account' : mode === 'forgot' ? 'Send reset link' : 'Sign in'}</button>
      </form>
      <div className="flex flex-wrap justify-center gap-4 mt-4 text-sm text-accent">
        {(['signin', 'signup', 'forgot'] as const).filter(value => value !== mode).map(value => <button key={value} disabled={pending} onClick={() => {setMode(value); setError(''); setInfo('');}}>{value === 'signin' ? 'Sign in' : value === 'signup' ? 'Create account' : 'Forgot password?'}</button>)}
      </div>
      <button disabled={pending || import.meta.env.VITE_SUPABASE_GOOGLE_ENABLED !== 'true'} className="w-full mt-5 py-3 g-chip rounded-xl text-text-primary disabled:opacity-50" onClick={async () => {
        setPending(true); setError('');
        try {await startGoogleSignIn();} catch (failure) {setError(failure instanceof Error ? failure.message : 'Google sign-in failed.');}
        finally {setPending(false);}
      }}>Continue with Google</button>
      {import.meta.env.VITE_SUPABASE_GOOGLE_ENABLED !== 'true' && <p className="mt-2 text-xs text-text-secondary">Google sign-in is not configured. Use email instead.</p>}
      <p className="mt-4 text-xs text-text-tertiary">Phone sign-in is unavailable while an SMS provider is not configured. Use email instead.</p>
    </div>
  </div>;
}
