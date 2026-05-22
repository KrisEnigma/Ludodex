import { Capacitor } from '@capacitor/core';
import posthog from 'posthog-js';
import type { PostHogInterface } from 'posthog-js';
import { getLang } from '../i18n';

const APP_VERSION = (import.meta.env.VITE_APP_VERSION as string | undefined) ?? '0.1.0';

let initialized = false;

/**
 * Initializes PostHog. Safe to call multiple times; second and subsequent
 * calls are no-ops. When VITE_POSTHOG_KEY is unset, initialization is skipped
 * entirely, no SDK loads, no network calls happen, and `track()` becomes a no-op.
 *
 * Call after Sentry but before route setup so the first navigation events fire.
 */
export function initAnalytics(): void {
  if (initialized) return;
  const key = import.meta.env.VITE_POSTHOG_KEY;
  if (!key) return;

  const host = import.meta.env.VITE_POSTHOG_HOST ?? 'https://eu.i.posthog.com';

  posthog.init(key, {
    api_host: host,
    // Anonymous-only — never call posthog.identify() with personal info.
    person_profiles: 'identified_only',
    // Respect Do Not Track and global privacy controls.
    respect_dnt: true,
    // Don't auto-capture clicks/pageviews — we send explicit events only.
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    // Disable session recording on web (we may revisit post-launch).
    disable_session_recording: true,
    // Lower flush interval on mobile-style connections.
    request_batching: true,
    // Keep payload small.
    sanitize_properties: (properties: Record<string, unknown>) => properties,
    loaded: (instance: PostHogInterface) => {
      // Super properties: sent with every event. No PII.
      instance.register({
        app_version: APP_VERSION,
        platform: Capacitor.getPlatform(),
        is_native: Capacitor.isNativePlatform(),
        locale: getLang(),
        environment:
          import.meta.env.MODE === 'production' ? 'production' : 'development'
      });
    }
  });

  initialized = true;
}

/**
 * Update locale super property when the user switches language mid-session.
 * Called from the language toggle in Settings.
 */
export function updateLocale(): void {
  if (!initialized) return;
  posthog.register({ locale: getLang() });
}

/**
 * Mark this user as a payer (after a successful purchase). Sets a person
 * property visible in PostHog cohorts. No PII; no email, no name.
 */
export function setPaidStatus(isPaid: boolean, ownedProductIds: string[] = []): void {
  if (!initialized) return;
  posthog.setPersonProperties({
    is_paid: isPaid,
    owned_products: ownedProductIds
  });
}

/**
 * Record an event. Properties must be a flat object of primitives — strings,
 * numbers, booleans. Do not pass nested objects, Dates, or anything else.
 *
 * Never pass PII. The only identifiers acceptable as values are public puzzle
 * IDs, public achievement IDs, public product IDs, and view names.
 */
export function track(
  eventName: AnalyticsEvent,
  properties?: Record<string, string | number | boolean>
): void {
  if (!initialized) return;
  try {
    posthog.capture(eventName, properties);
  } catch {
    // Capture failures are non-critical.
  }
}

/**
 * The canonical list of events we track. Adding a new event = adding to this
 * union. Keeps the taxonomy honest and prevents typo-named events.
 *
 * Naming convention:
 *  - noun_verb (entity first): puzzle_started, hint_used
 *  - iap_* for all purchase funnel events
 *  - *_tapped for CTA tap/click events
 */
export type AnalyticsEvent =
  // ── App lifecycle ──────────────────────────────────────────────────────────
  | 'app_opened'
  | 'view_opened'

  // ── Tutorial ───────────────────────────────────────────────────────────────
  | 'tutorial_step_viewed'
  | 'tutorial_completed'
  | 'tutorial_skipped'

  // ── Puzzle ─────────────────────────────────────────────────────────────────
  | 'puzzle_started'
  | 'puzzle_solved'
  | 'puzzle_abandoned'

  // ── Hints ──────────────────────────────────────────────────────────────────
  | 'hint_used'
  | 'hint_store_opened'           // context: 'menu' | 'loss_recovery'
  | 'rewarded_ad_completed'       // placement: 'hint'

  // ── Skins / achievements ───────────────────────────────────────────────────
  | 'skin_preview_entered'
  | 'skin_preview_buy_tapped'
  | 'skin_preview_cancelled'
  | 'achievement_unlocked'

  // ── IAP purchase funnel ────────────────────────────────────────────────────
  | 'iap_purchase_started'        // legacy — kept for IAPService.purchase() compat
  | 'iap_purchase_succeeded'      // legacy — kept for existing call sites
  | 'iap_purchase_failed'         // legacy — kept for existing call sites
  | 'iap_restore_tapped'
  | 'iap_offered'                 // product surfaced to user (store opened / modal shown)
  | 'iap_purchased'               // purchase succeeded (new, richer event)
  | 'iap_declined'                // user dismissed without buying
  | 'iap_failed'                  // purchase attempt failed (new, richer event)

  // ── Starter Pack ──────────────────────────────────────────────────────────
  | 'starter_pack_shown'
  | 'starter_pack_purchased'
  | 'starter_pack_declined'

  // ── Ads ────────────────────────────────────────────────────────────────────
  | 'ad_impression'               // legacy alias kept for backward compat
  | 'interstitial_shown'          // placement: 'win_exit'
  | 'interstitial_skipped_remove_ads'

  // ── Share ──────────────────────────────────────────────────────────────────
  | 'share_string_generated'
  | 'share_button_tapped'         // share_method: 'native_share' | 'clipboard'

  // ── Web / cross-promo ─────────────────────────────────────────────────────
  | 'web_install_cta_tapped';     // platform: 'android' | 'ios'
