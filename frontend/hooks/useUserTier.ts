import { useCallback, useEffect, useState } from 'react';
import { api } from '../src/services/api';

type Tier = 'free' | 'full';

interface UserTierState {
  tier: Tier;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useUserTier(): UserTierState {
  const [tier, setTier] = useState<Tier>('free');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    api.get<{ tier: Tier }>('/api/user/tier')
      .then(data => {
        if (!cancelled) {
          setTier(data.tier === 'full' ? 'full' : 'free');
          setError(null);
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err.message || 'Failed to fetch tier');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [tick]);

  return { tier, loading, error, refetch };
}
