/**
 * Analytics — thin PostHog wrapper.
 * Import `analytics` and call track() anywhere in the renderer.
 * All calls are no-ops if PostHog fails to load.
 */
import posthog from 'posthog-js';

posthog.init('phc_D5EbtZnQE2bMVR29mpQonfACCkkfiVwHBzse5kpTuJKt', {
  api_host: 'https://us.i.posthog.com',
  defaults: '2026-01-30',
  // Don't capture page views — this is a single-page Electron app
  capture_pageview: false,
  // Respect system Do Not Track
  respect_dnt: true,
});

export const analytics = {
  /** Fire a named event with optional properties. */
  track(event: string, props?: Record<string, unknown>) {
    try {
      posthog.capture(event, props);
    } catch {
      // never crash the app over analytics
    }
  },

  /** Identify a user (called after onboarding if we have any ID). */
  identify(distinctId: string, props?: Record<string, unknown>) {
    try {
      posthog.identify(distinctId, props);
    } catch { /* ignore */ }
  },
};
