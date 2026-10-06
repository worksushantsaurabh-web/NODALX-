/**
 * Application entry point for the session boundary. Importing this module
 * registers the active identity provider. Consumers import from here.
 */
import {registerSessionProvider} from './core';
import {supabase} from '../supabase';
import {createSupabaseSessionProvider} from './supabaseAdapter';

export const supabaseSessionProvider = createSupabaseSessionProvider(supabase);
registerSessionProvider(supabaseSessionProvider);

export {
  authorizationHeader,
  getAccessToken,
  getCurrentSessionUser,
  getSessionProvider,
  isSessionAvailable,
  onSessionChange,
  signOutSession,
  type SessionProvider,
  type SessionUser,
} from './core';
