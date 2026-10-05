import React, {useEffect, useState} from 'react';
import {Link} from 'react-router-dom';
import {analyticsEnabled, readAnalyticsConsent} from '../lib/analyticsConsent';
import {syncAnalyticsConsent, updateAnalyticsConsent} from '../lib/analytics';

function usePreference() {
  const [choice, setChoice] = useState(readAnalyticsConsent);
  const [error, setError] = useState('');
  useEffect(() => {
    const sync = () => {setChoice(readAnalyticsConsent()); syncAnalyticsConsent();};
    window.addEventListener('storage', sync);
    window.addEventListener('nodalx-analytics-consent', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('nodalx-analytics-consent', sync);
    };
  }, []);
  const choose = (allowed: boolean) => {
    if (updateAnalyticsConsent(allowed)) {setChoice(allowed); setError('');}
    else setError('Your browser could not save this preference. Optional analytics stays disabled.');
  };
  return {choice, choose, error};
}

const control = 'min-h-11 rounded-lg border border-border-strong bg-surface px-4 py-2 text-sm font-medium text-text-primary hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent';

export function AnalyticsPreferences() {
  const {choice, choose, error} = usePreference();
  if (!analyticsEnabled()) return <p>Optional analytics is disabled for this deployment.</p>;
  return <div className="space-y-3">
    <p>Optional analytics is {choice === true ? 'enabled' : 'disabled'} in this browser.</p>
    <div className="flex flex-wrap gap-3"><button className={control} aria-pressed={choice === true} onClick={() => choose(true)}>Allow analytics</button><button className={control} aria-pressed={choice !== true} onClick={() => choose(false)}>Disable analytics</button></div>
    {error && <p role="alert">{error}</p>}
  </div>;
}

export default function AnalyticsConsent() {
  const {choice, choose, error} = usePreference();
  if (!analyticsEnabled() || choice !== null) return null;
  return <section aria-label="Optional analytics preference" className="border-t border-border bg-bg px-6 py-6 text-text-primary">
    <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-5">
      <div className="max-w-2xl space-y-2 text-sm leading-relaxed"><h2 className="font-semibold">Optional analytics</h2><p className="text-text-secondary">Allow usage analytics to help us understand which features work. Authentication works with either choice. You can change this in the <Link className="underline" to="/privacy">Privacy Policy</Link>.</p>{error && <p role="alert">{error}</p>}</div>
      <div className="flex flex-wrap gap-3"><button className={control} onClick={() => choose(false)}>Decline</button><button className={control} onClick={() => choose(true)}>Allow analytics</button></div>
    </div>
  </section>;
}
