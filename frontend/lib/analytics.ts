/**
 * Analytics module — typed, provider-neutral event helpers.
 *
 * All calls are fire-and-forget: wrapped in try/catch, never block UI.
 * Events are forwarded only to an explicitly installed `AnalyticsSink` and
 * only after the deployment opt-in plus browser consent. Firebase Analytics
 * was retired during the Supabase migration; no external tracker is installed
 * by default, so in production these helpers are no-ops. In development,
 * events are printed to the console so instrumentation can still be verified.
 */

import {analyticsEnabled, getAnalyticsSink, readAnalyticsConsent, writeAnalyticsConsent} from './analyticsConsent';

const collectionAllowed = () => analyticsEnabled() && readAnalyticsConsent() === true;

export function syncAnalyticsConsent() {
  try {
    getAnalyticsSink()?.setCollectionEnabled(collectionAllowed());
  } catch {
    // Never crash the app on analytics failure
  }
}

export function updateAnalyticsConsent(allowed: boolean): boolean {
  const saved = writeAnalyticsConsent(allowed);
  syncAnalyticsConsent();
  return saved;
}

// ─── Internals ─────────────────────────────────────────────────────────────

function track(eventName: string, params?: Record<string, string | number | boolean>): void {
  try {
    const sink = getAnalyticsSink();
    if (sink && collectionAllowed()) {
      sink.track(eventName, params);
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
  formError(_errorMessage: string) {
    track('form_error', { reason: 'submission_failed' });
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
