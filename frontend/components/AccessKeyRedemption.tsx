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
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/15 p-6  ">
        <div className="flex items-start gap-4">
          <div className="rounded-full bg-emerald-500/15 p-2 ">
            <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="font-semibold text-emerald-600 dark:text-emerald-400 ">
              Access key redeemed!
            </p>
            <p className="mt-1 text-sm text-emerald-600/80 dark:text-emerald-400/80 ">
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
    <div className="g-card rounded-2xl p-6  ">
      <div className="mb-5 flex items-center gap-3">
        <div className="rounded-xl g-chip p-2.5">
          <Sparkles className="h-5 w-5 text-accent" />
        </div>
        <div>
          <h3 className="font-bold text-text-primary ">Redeem Access Key</h3>
          <p className="text-sm text-text-tertiary ">
            Enter your access key to unlock full plan features.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <Key className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary " />
          <input
            type="text"
            value={keyValue}
            onChange={(e) => {
              setKeyValue(e.target.value);
              if (status === 'error') setStatus('idle');
            }}
            placeholder="Paste your access key here…"
            disabled={status === 'loading'}
            className="w-full g-input rounded-xl py-3 pl-10 pr-4 text-sm text-text-primary outline-none transition disabled:opacity-60"
          />
        </div>

        {status === 'error' && (
          <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3  ">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400 " />
            <p className="text-sm text-red-600 dark:text-red-400 ">{errorMessage}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={status === 'loading' || !keyValue.trim()}
          className="btn-primary text-[#fff] inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60"
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
