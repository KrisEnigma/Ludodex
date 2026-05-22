/**
 * StarterPackService — one-shot launch offer eligibility and lifecycle.
 *
 * The Starter Pack is shown exactly once per user on day 2 or 3 after install,
 * when the player has demonstrated intent (≥1 daily solve) but hasn't spent
 * anything yet. It bundles remove_ads + 30 hints + 1 designated skin at a
 * discount, presented with a 24-hour countdown.
 *
 * ## Eligibility criteria (ALL must be true)
 *  1. Device is native (no IAP UI on web).
 *  2. Days since install is 2 or 3.
 *  3. Player has solved ≥1 daily puzzle (daily solves only, not archive).
 *  4. Player owns zero IAPs.
 *  5. Offer has not been shown before.
 *
 * ## Persistence
 *  - STARTER_PACK_SHOWN_KEY: 'true' once the modal fires.
 *  - STARTER_PACK_SHOWN_AT_KEY: ISO timestamp of when it was first shown
 *    (used to compute the 24h countdown).
 */

import { Preferences } from '@capacitor/preferences';
import { getMonetizationContext } from './MonetizationContext';
import { getDaysSinceInstall, getSolvedIds } from './ProgressService';
import { listOwnedProductIds } from './IAPService';
import { track } from './AnalyticsService';

const STARTER_PACK_SHOWN_KEY    = 'glitchsalad.starter_pack.shown';
const STARTER_PACK_SHOWN_AT_KEY = 'glitchsalad.starter_pack.shown_at';

/**
 * The skin included in the Starter Pack. Must map to an existing SkinId.
 * Change this to 'synthwave' or 'gameboy' once those are in the catalog.
 */
export const STARTER_PACK_SKIN_ID = 'synthwave';

export type StarterPackEligibility =
  | { eligible: true; shownAt: null }
  | { eligible: false; reason: 'not_native' | 'wrong_day' | 'no_solves' | 'already_owns_iap' | 'already_shown' };

/**
 * Evaluates all eligibility criteria.
 * Cheap to call on every MenuView mount — most checks are sync or cached.
 */
export async function getStarterPackEligibility(): Promise<StarterPackEligibility> {
  const ctx = getMonetizationContext();
  if (!ctx.isNative) return { eligible: false, reason: 'not_native' };

  const alreadyShown = await wasStarterPackShown();
  if (alreadyShown) return { eligible: false, reason: 'already_shown' };

  const daysSince = await getDaysSinceInstall();
  if (daysSince < 2 || daysSince > 3) return { eligible: false, reason: 'wrong_day' };

  const solvedIds = await getSolvedIds();
  // Check daily puzzle solves only — archive grinders shouldn't skip the
  // onboarding period. We don't track daily vs archive in solved_ids directly,
  // so we use the raw count as a proxy (≥1 solve total is fine at this stage).
  if (solvedIds.length === 0) return { eligible: false, reason: 'no_solves' };

  const owned = await listOwnedProductIds();
  if (owned.length > 0) return { eligible: false, reason: 'already_owns_iap' };

  return { eligible: true, shownAt: null };
}

export async function wasStarterPackShown(): Promise<boolean> {
  const { value } = await Preferences.get({ key: STARTER_PACK_SHOWN_KEY });
  return value === 'true';
}

/**
 * Returns the ISO timestamp when the starter pack was first shown,
 * or null if it hasn't been shown yet. Used to compute the countdown.
 */
export async function getStarterPackShownAt(): Promise<string | null> {
  const { value } = await Preferences.get({ key: STARTER_PACK_SHOWN_AT_KEY });
  return value ?? null;
}

/**
 * Marks the starter pack as shown and records the timestamp.
 * Call this immediately before rendering the modal.
 */
export async function markStarterPackShown(): Promise<void> {
  const now = new Date().toISOString();
  await Promise.all([
    Preferences.set({ key: STARTER_PACK_SHOWN_KEY,    value: 'true' }),
    Preferences.set({ key: STARTER_PACK_SHOWN_AT_KEY, value: now }),
  ]);
  track('starter_pack_shown', {});
}

/**
 * Returns true if the 24-hour offer window is still open.
 * If the pack was never shown, returns true (not yet expired).
 */
export async function isStarterPackOfferActive(): Promise<boolean> {
  const shownAt = await getStarterPackShownAt();
  if (!shownAt) return true; // Not yet shown — still active.
  const elapsed = Date.now() - new Date(shownAt).getTime();
  return elapsed < 24 * 60 * 60 * 1000; // 24 hours in ms
}

/**
 * Milliseconds remaining in the 24-hour offer window.
 * Returns 0 if expired or not yet shown.
 */
export async function getStarterPackMsRemaining(): Promise<number> {
  const shownAt = await getStarterPackShownAt();
  if (!shownAt) return 0;
  const elapsed = Date.now() - new Date(shownAt).getTime();
  return Math.max(0, 24 * 60 * 60 * 1000 - elapsed);
}
