import {createClient, type SupabaseClient} from '@supabase/supabase-js';

const url = import.meta.env?.VITE_SUPABASE_URL;
const publishableKey = import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY;

function initializeSupabase(): SupabaseClient | null {
  if (!url || !publishableKey) return null;
  try {
    return createClient(url, publishableKey, {
      auth: {flowType: 'pkce', autoRefreshToken: true, persistSession: true, detectSessionInUrl: true},
    });
  } catch {return null;}
}

export const supabase = initializeSupabase();

export function requireSupabase(): SupabaseClient {
  if (!supabase) throw new Error('Authentication is not configured for this environment.');
  return supabase;
}
