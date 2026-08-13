/**
 * Analytics module — wraps Firebase logEvent with typed helpers.
 *
 * All calls are fire-and-forget: wrapped in try/catch, never block UI.
 * In development, events are printed to the console instead of (or alongside)
 * being sent to Firebase so you can verify instrumentation without opening
 * the Firebase DebugView.
 *
 * To see events in Firebase DebugView during testing, open the app with:
 *   ?debug_mode=1   in the URL
 * Firebase will then surface events in real-time at:
 *   https://console.firebase.google.com → Analytics → DebugView
 */

import { getAnalytics, logEvent } from 'firebase/analytics';
import app from './firebase';

// ─── Internals ─────────────────────────────────────────────────────────────

function getAnalyticsInstance() {
  try {
    return getAnalytics(app);
  } catch {
    return null;
  }
}

function track(eventName: string, params?: Record<string, string | number | boolean>): void {
  try {
    const instance = getAnalyticsInstance();
    if (instance) {
      logEvent(instance, eventName, params);
    }
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.debug(`%c[Analytics] ${eventName}`, 'color:#0d9488;font-weight:bold', params ?? '');
    }
  } catch {
    // Never crash the app on analytics failure
  }
}

// ─── Typed event helpers ────────────────────────────────────────────────────
//
// Each function maps to exactly one event name. Parameters are typed at the
// call site so you can't accidentally mis-spell a property.

export const Analytics = {

  // ── Homepage CTAs ─────────────────────────────────────────────────────────

  /** "Get Early Access" button clicked anywhere on the marketing page */
  ctaClick(source: 'hero' | 'closing_cta' | 'footer' | 'navbar') {
    track('cta_click', { source });
  },

  /** Secondary nav-scroll CTA clicked ("See how it works", section links) */
  navScrollClick(target: string) {
    track('nav_scroll_click', { target });
  },

  // ── Inquiry form ──────────────────────────────────────────────────────────

  /** User interacted with the inquiry form for the first time (first field focus) */
  formStart() {
    track('form_start');
  },

  /** User clicked Submit — regardless of outcome */
  formSubmit() {
    track('form_submit');
  },

  /** Inquiry submitted and server confirmed success */
  formSuccess() {
    track('form_success');
    track('generate_lead'); // Firebase standard event — appears in built-in reports
  },

  /** Submission failed (network or server error) */
  formError(errorMessage: string) {
    track('form_error', { error: errorMessage.slice(0, 100) });
  },

  // ── Onboarding modal ──────────────────────────────────────────────────────

  /** "Get Early Access" modal opened */
  onboardingOpen(source?: 'hero' | 'closing_cta' | 'footer') {
    track('onboarding_open', source ? { source } : undefined);
  },

  /** User clicked "Continue with Google" inside the onboarding modal */
  onboardingGoogleClick() {
    track('onboarding_google_click');
  },

  /** Modal was closed (X or backdrop) before completing auth */
  onboardingAbandon() {
    track('onboarding_abandon');
  },

  /** New user successfully authenticated and reached the dashboard */
  signupComplete(method: 'google' | 'email' | 'phone') {
    track('sign_up', { method }); // Firebase standard event
    track('signup_complete', { method });
  },

  // ── Sign-in (returning user) ───────────────────────────────────────────────

  /** Sign-in modal opened (returning user) */
  signinOpen() {
    track('signin_open');
  },

  /** Returning user successfully authenticated */
  signinComplete(method: 'google' | 'email' | 'phone') {
    track('login', { method }); // Firebase standard event
  },

  /** Authentication attempt failed */
  signinError(method: string, errorCode: string) {
    track('signin_error', { method, error_code: errorCode.slice(0, 50) });
  },

  // ── Activation (post-signup) ───────────────────────────────────────────────

  /** User generated their first API key — primary activation event */
  apiKeyGenerated() {
    track('api_key_generated');
    track('tutorial_complete'); // Firebase standard event — maps to "onboarding complete"
  },

  /** User connected an integration */
  integrationConnected(integration: 'google_sheets' | 'slack' | 'email') {
    track('integration_connected', { integration });
  },

  /** User sent a test inquiry through the dashboard */
  testInquirySent() {
    track('test_inquiry_sent');
  },

  // ── Feedback ──────────────────────────────────────────────────────────────

  /** Micro-survey submitted after a key action */
  surveySubmitted(context: string, rating: number) {
    track('survey_submitted', { context, rating });
  },

  /** Floating feedback widget submitted */
  feedbackSubmitted(category: string) {
    track('feedback_submitted', { category });
  },
};
