import React, { useState } from 'react';
import { CheckCircle2, Key, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import { api } from '../src/services/api';

interface Props {
  onRedemptionSuccess: () => void;
}

type Status = 'idle' | 'loading' | 'success' | 'error';

export default function AccessKeyRedemption({ onRedemptionSuccess }: Props) {
  const [keyValue, setKeyValue] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [newTier, setNewTier] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = keyValue.trim();
    if (!trimmed) return;

    setStatus('loading');
    setErrorMessage('');

    try {
      const result = await api.post<{ success: boolean; tier: string }>(
        '/api/user/redeem-key',
        { key: trimmed },
      );

      setNewTier(result.tier);
      setStatus('success');
      onRedemptionSuccess();
    } catch (err: unknown) {
      setStatus('error');
      const message = (err as Error).message || '';
      if (message.includes('does not exist')) {
        setErrorMessage('This access key does not exist. Please check and try again.');
      } else if (message.includes('already been redeemed')) {
        setErrorMessage('This access key has already been redeemed.');
      } else if (message.includes('Authentication') || message.includes('401')) {
        setErrorMessage('You must be signed in to redeem a key.');
      } else {
        setErrorMessage(message || 'Something went wrong. Please try again.');
      }
    }
  };

  if (status === 'success') {
    return (
      <div className="rounded-2xl border border-emerald-200/60 bg-emerald-50 p-6 dark:border-emerald-500/20 dark:bg-emerald-500/10">
        <div className="flex items-start gap-4">
          <div className="rounded-full bg-emerald-100 p-2 dark:bg-emerald-500/20">
            <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="font-semibold text-emerald-900 dark:text-emerald-200">
              Access key redeemed!
            </p>
            <p className="mt-1 text-sm text-emerald-800/80 dark:text-emerald-200/70">
              Your account has been upgraded to the{' '}
              <span className="font-bold capitalize">{newTier}</span> plan.
              Premium features are now unlocked.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-white/10 dark:bg-white/5">
      <div className="mb-5 flex items-center gap-3">
        <div className="rounded-xl bg-neutral-100 dark:bg-neutral-800 p-2.5">
          <Sparkles className="h-5 w-5 text-black dark:text-white" />
        </div>
        <div>
          <h3 className="font-bold text-neutral-900 dark:text-white">Redeem Access Key</h3>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Enter your access key to unlock full plan features.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <Key className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400 dark:text-neutral-500" />
          <input
            type="text"
            value={keyValue}
            onChange={(e) => {
              setKeyValue(e.target.value);
              if (status === 'error') setStatus('idle');
            }}
            placeholder="Paste your access key here…"
            disabled={status === 'loading'}
            className="w-full rounded-xl border border-neutral-200 bg-neutral-50 py-3 pl-10 pr-4 text-sm text-neutral-900 placeholder-neutral-400 outline-none transition focus:border-neutral-400 focus:ring-2 focus:ring-neutral-400/20 disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder-neutral-500 dark:focus:border-neutral-500"
          />
        </div>

        {status === 'error' && (
          <div className="flex items-start gap-2 rounded-xl border border-red-200/60 bg-red-50 px-4 py-3 dark:border-red-500/20 dark:bg-red-500/10">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
            <p className="text-sm text-red-700 dark:text-red-300">{errorMessage}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={status === 'loading' || !keyValue.trim()}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-black dark:bg-white px-4 py-3 text-sm font-bold text-white transition hover:bg-neutral-800 dark:hover:bg-neutral-200 text-white dark:text-black disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === 'loading' ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Redeeming…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Redeem Key
            </>
          )}
        </button>
      </form>
    </div>
  );
}
