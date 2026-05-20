import { Capacitor } from '@capacitor/core';
import * as Sentry from '@sentry/capacitor';
import * as SentryBrowser from '@sentry/browser';

const APP_VERSION = (import.meta.env.VITE_APP_VERSION as string | undefined) ?? '0.1.0';

let initialized = false;

/**
 * Initializes Sentry. Safe to call multiple times — second and subsequent calls
 * are no-ops. Safe to call when VITE_SENTRY_DSN is unset — initialization is
 * skipped entirely, no network calls happen, and capture helpers below become
 * no-ops.
 *
 * Call this as early as possible in the app lifecycle so startup errors are
 * captured.
 */
export function initSentry(): void {
  if (initialized) return;
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  const environment =
    import.meta.env.MODE === 'production' ? 'production' : 'development';

  Sentry.init(
    {
      dsn,
      release: `glitchsalad@${APP_VERSION}`,
      environment,
      tracesSampleRate: 0,
      // Capture unhandled promise rejections automatically.
      // Capture console.error as breadcrumbs by default.
      // Strip known-noisy errors that don't indicate real problems:
      ignoreErrors: [
        // ResizeObserver loop limit warnings — benign, fires on layout changes.
        /ResizeObserver loop/i,
        // AbortError from fetch timeouts in PuzzleLoader — expected when CDN is slow.
        /AbortError/i,
        /aborted/i,
        // Capacitor plugin "not implemented" errors on web — expected for native-only plugins.
        /"\w+" is not implemented/i,
        // Chrome extension content scripts injecting into the page.
        /chrome-extension/i,
        /moz-extension/i
      ],
      // Tag platform for filtering in the Sentry UI.
      initialScope: {
        tags: {
          platform: Capacitor.getPlatform(),
          native: String(Capacitor.isNativePlatform())
        }
      }
    },
    // The Capacitor SDK wraps the browser SDK; pass init through.
    SentryBrowser.init
  );

  initialized = true;
}

/**
 * Record a navigation event as a breadcrumb. Helps reconstruct what the user
 * did before an error. No personal data — just route names.
 */
export function trackRoute(routeName: string, action: 'push' | 'replace' | 'pop' = 'push'): void {
  if (!initialized) return;
  Sentry.addBreadcrumb({
    category: 'navigation',
    message: `${action}: ${routeName}`,
    level: 'info'
  });
}

/**
 * Capture an exception explicitly. Useful in catch blocks where we'd otherwise
 * just console.warn and swallow.
 */
export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (!initialized) {
    if (error instanceof Error || typeof error === 'string') {
      console.warn('[sentry-disabled]', error, context);
    }
    return;
  }
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

/**
 * Capture a non-error message. Use sparingly — for events worth knowing about
 * but that aren't exceptions (e.g., remote puzzles failed to parse and we
 * fell back to bundled).
 */
export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info'): void {
  if (!initialized) {
    if (level !== 'info') console.warn('[sentry-disabled]', message);
    return;
  }
  Sentry.captureMessage(message, level);
}
