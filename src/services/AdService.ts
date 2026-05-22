/**
 * AdService — ad lifecycle management for GlitchSalad.
 *
 * ## Architecture
 *
 * Three ad surfaces, each independently gated:
 *
 *  1. **Interstitials** (native only)
 *     Fired on the route transition *away* from WinView — never on the
 *     WinView itself. The celebration stays pristine.
 *     - Cadence: every 2 solves, persisted across sessions.
 *     - Remove Ads: skips the show but still advances the counter (fair UX).
 *     - Session cap: 2 per cold start.
 *
 *  2. **Rewarded ads** (native only)
 *     Opt-in. Player watches a short ad to earn a bonus hint.
 *     NOT affected by the remove_ads entitlement — remove_ads removes
 *     interstitials only; rewarded ads remain available as an earning path.
 *     Daily limit tracked in HintService.AD_HINT_DAILY_LIMIT.
 *
 *  3. **Banner ads** (web only)
 *     Shown via AdSense or equivalent. Completely separate init path;
 *     never shown on native.
 *
 * ## Interstitial timing flow
 *
 *  GameView (after solve) → recordSolveForInterstitial()
 *    Sets pendingInterstitial flag in Preferences when counter hits 2.
 *
 *  Router (on pop/replace away from 'win') → fireInterstitialIfPending()
 *    Reads flag, shows ad (or skips for remove_ads owners), clears flag.
 */

import { Preferences } from '@capacitor/preferences';
import { AdMob } from '@capacitor-community/admob';
import { isOwned, PRODUCT_IDS } from './IAPService';
import { getMonetizationContext } from './MonetizationContext';
import { track } from './AnalyticsService';

// ── Tunable constants ─────────────────────────────────────────────────────────

/** Fire an interstitial every N solves. Counter persists across sessions. */
const AD_EVERY_N_SOLVES = 2;

/** Max interstitials per cold start. Prevents archive grinders from drowning. */
const SESSION_CAP = 2;

// ── Preferences keys ──────────────────────────────────────────────────────────

const SOLVES_SINCE_LAST_INTERSTITIAL_KEY = 'glitchsalad.ad.solves_since_last';
const PENDING_INTERSTITIAL_KEY           = 'glitchsalad.ad.pending_interstitial';

// ── AdMob test IDs ────────────────────────────────────────────────────────────

const TEST_INTERSTITIAL_ANDROID = 'ca-app-pub-3940256099942544/1033173712';
const TEST_INTERSTITIAL_IOS     = 'ca-app-pub-3940256099942544/4411468910';

// ── Session state (resets on cold start) ──────────────────────────────────────

let initialized    = false;
let preparing      = false;
let interstitialReady = false;
let sessionAdCount = 0;

// ── Helpers ───────────────────────────────────────────────────────────────────

function shouldUseTestAds(): boolean {
  const value = import.meta.env.VITE_ADMOB_USE_TEST_IDS;
  if (!value) return true;
  return value !== 'false';
}

function getInterstitialAdId(): string {
  const platform = getMonetizationContext().platform;
  const androidEnv = (import.meta.env.VITE_ADMOB_INTERSTITIAL_ANDROID as string | undefined)?.trim();
  const iosEnv     = (import.meta.env.VITE_ADMOB_INTERSTITIAL_IOS     as string | undefined)?.trim();

  if (platform === 'android') {
    return shouldUseTestAds() ? TEST_INTERSTITIAL_ANDROID : (androidEnv || TEST_INTERSTITIAL_ANDROID);
  }
  if (platform === 'ios') {
    return shouldUseTestAds() ? TEST_INTERSTITIAL_IOS : (iosEnv || TEST_INTERSTITIAL_IOS);
  }
  return TEST_INTERSTITIAL_ANDROID;
}

async function prepareInterstitialIfNeeded(): Promise<void> {
  if (!initialized || preparing || interstitialReady) return;
  preparing = true;
  try {
    await AdMob.prepareInterstitial({
      adId: getInterstitialAdId(),
      isTesting: shouldUseTestAds(),
      immersiveMode: true,
    });
    interstitialReady = true;
  } catch (err) {
    console.warn('[AdService] prepareInterstitial failed', err);
  } finally {
    preparing = false;
  }
}

async function readSolvesSinceLast(): Promise<number> {
  const { value } = await Preferences.get({ key: SOLVES_SINCE_LAST_INTERSTITIAL_KEY });
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

async function writeSolvesSinceLast(n: number): Promise<void> {
  await Preferences.set({ key: SOLVES_SINCE_LAST_INTERSTITIAL_KEY, value: String(n) });
}

async function readPendingInterstitial(): Promise<boolean> {
  const { value } = await Preferences.get({ key: PENDING_INTERSTITIAL_KEY });
  return value === 'true';
}

async function writePendingInterstitial(pending: boolean): Promise<void> {
  await Preferences.set({ key: PENDING_INTERSTITIAL_KEY, value: String(pending) });
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Initialize AdMob. Call from main.ts after Sentry, before Router.
 * No-op on web.
 */
export async function initAds(): Promise<void> {
  const ctx = getMonetizationContext();
  if (!ctx.isNative) return;
  // TODO(native): Initialize AdMob + UMP consent flow.
  //   await AdMob.initialize({ initializeForTesting: shouldUseTestAds() });
  //   Run EU/UK GDPR UMP consent and iOS ATT prompt here.
  initialized = true;
  void prepareInterstitialIfNeeded();
}

/**
 * Initialize web banner ads (AdSense or equivalent).
 * Call from main.ts on web builds only.
 * No-op on native.
 */
export async function initBannerAds(): Promise<void> {
  const ctx = getMonetizationContext();
  if (!ctx.canShowBannerAds) return;
  // TODO(web): Bootstrap AdSense / equivalent banner ad SDK.
  //   (window as any).adsbygoogle = (window as any).adsbygoogle || [];
  //   Insert ad slot elements into the DOM as appropriate.
}

/**
 * Called after every puzzle solve (daily + archive, uniformly).
 * Increments the persistent solve counter and sets pendingInterstitial = true
 * when the threshold is reached. Does NOT show the ad — that happens in
 * fireInterstitialIfPending() on the next WinView exit.
 */
export async function recordSolveForInterstitial(): Promise<void> {
  const ctx = getMonetizationContext();
  if (!ctx.canShowInterstitials) return;

  const current = await readSolvesSinceLast();
  const next = current + 1;

  if (next >= AD_EVERY_N_SOLVES) {
    // Threshold reached: arm the pending flag and reset the counter.
    await Promise.all([
      writePendingInterstitial(true),
      writeSolvesSinceLast(0),
    ]);
  } else {
    await writeSolvesSinceLast(next);
  }
}

/**
 * Called by Router when navigating away from WinView (Done, Play Again, Back).
 * Shows a pending interstitial if:
 *   - pendingInterstitial flag is set
 *   - session cap not reached
 *   - player does not own remove_ads
 *
 * If the player owns remove_ads, the flag is cleared and the counter resets
 * without showing an ad — we still credit the "skip" for analytics.
 *
 * Returns true if an ad was shown, false otherwise.
 */
export async function fireInterstitialIfPending(): Promise<boolean> {
  const ctx = getMonetizationContext();
  if (!ctx.canShowInterstitials) return false;

  const isPending = await readPendingInterstitial();
  if (!isPending) return false;

  // Always clear the flag — whether we show or skip.
  await writePendingInterstitial(false);

  if (sessionAdCount >= SESSION_CAP) return false;

  // Remove Ads: skip show, track the skip.
  if (await isOwned(PRODUCT_IDS.REMOVE_ADS)) {
    track('interstitial_skipped_remove_ads', {});
    return false;
  }

  sessionAdCount += 1;
  track('interstitial_shown', { placement: 'win_exit', session_ad_count: sessionAdCount });

  // TODO(native): Show the interstitial.
  //   await prepareInterstitialIfNeeded();
  //   if (interstitialReady) {
  //     interstitialReady = false;
  //     await AdMob.showInterstitial();
  //     void prepareInterstitialIfNeeded(); // pre-load next
  //   }

  return true;
}

/**
 * Show a rewarded ad in exchange for a bonus hint.
 *
 * Returns:
 *  - 'rewarded'    — player watched the full ad.
 *  - 'skipped'     — player dismissed before completion.
 *  - 'unavailable' — ads not available (web, not initialized).
 *
 * NOT gated by remove_ads ownership. Remove Ads removes interstitials only.
 * Callers must call HintService.consumeAdHintSlot() + grantHints(1) on 'rewarded'.
 */
export async function showRewardedAdForHint(): Promise<'rewarded' | 'skipped' | 'unavailable'> {
  const ctx = getMonetizationContext();
  if (!ctx.canShowRewardedAds) return 'unavailable';
  if (!initialized) return 'unavailable';

  // TODO(native): Show a real rewarded ad via AdMob.
  //   try {
  //     await AdMob.prepareRewardVideoAd({ adId: getRewardedAdId(), isTesting: shouldUseTestAds() });
  //     const result = await AdMob.showRewardVideoAd();
  //     const rewarded = result.type === RewardAdPluginEvents.Rewarded;
  //     track('rewarded_ad_completed', { placement: 'hint', rewarded });
  //     return rewarded ? 'rewarded' : 'skipped';
  //   } catch {
  //     return 'unavailable';
  //   }

  // Stub: always reward on native until the real AdMob call lands.
  track('rewarded_ad_completed', { placement: 'hint' });
  return 'rewarded';
}

/** Whether the current context supports native ads at all. */
export function canShowAds(): boolean {
  const ctx = getMonetizationContext();
  return ctx.canShowInterstitials || ctx.canShowRewardedAds;
}
