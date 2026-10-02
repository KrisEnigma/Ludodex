/**
 * AdService — ad lifecycle management for Ludodex.
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
import { Capacitor } from '@capacitor/core';
import {
  AdMob,
  AdmobConsentStatus,
  InterstitialAdPluginEvents,
  RewardAdPluginEvents,
} from '@capacitor-community/admob';
import { isOwned, PRODUCT_IDS } from './IAPService';
import { getMonetizationContext } from './MonetizationContext';
import { track } from './AnalyticsService';

// ── Tunable constants ─────────────────────────────────────────────────────────

/** Fire an interstitial every N solves. Counter persists across sessions. */
const AD_EVERY_N_SOLVES = 2;

/** Max interstitials per cold start. Prevents archive grinders from drowning. */
const SESSION_CAP = 2;

// ── Preferences keys ──────────────────────────────────────────────────────────

const SOLVES_SINCE_LAST_INTERSTITIAL_KEY = 'ludodex.ad.solves_since_last';
const PENDING_INTERSTITIAL_KEY           = 'ludodex.ad.pending_interstitial';

// ── AdMob test IDs ────────────────────────────────────────────────────────────

const TEST_INTERSTITIAL_ANDROID = 'ca-app-pub-3940256099942544/1033173712';
const TEST_INTERSTITIAL_IOS     = 'ca-app-pub-3940256099942544/4411468910';
const TEST_REWARDED_ANDROID     = 'ca-app-pub-3940256099942544/5224354917';
const TEST_REWARDED_IOS         = 'ca-app-pub-3940256099942544/1712485313';

// ── Session state (resets on cold start) ──────────────────────────────────────

let initialized    = false;
let initPromise: Promise<void> | null = null;
let privacyOptionsRequired = false;
let preparing      = false;
let interstitialReady = false;
let sessionAdCount = 0;
/** Settles when the current win-exit interstitial check (and any ad) is over. */
let fullScreenAdGate: Promise<unknown> = Promise.resolve();

// ── Helpers ───────────────────────────────────────────────────────────────────

function shouldUseTestAds(): boolean {
  const value = import.meta.env.VITE_ADMOB_USE_TEST_IDS;
  if (!value) return true;
  return value !== 'false';
}

function getRewardedAdId(): string {
  const platform = getMonetizationContext().platform;
  const androidEnv = (import.meta.env.VITE_ADMOB_REWARDED_ANDROID as string | undefined)?.trim();
  const iosEnv     = (import.meta.env.VITE_ADMOB_REWARDED_IOS     as string | undefined)?.trim();

  if (platform === 'android') {
    return shouldUseTestAds() ? TEST_REWARDED_ANDROID : (androidEnv || TEST_REWARDED_ANDROID);
  }
  if (platform === 'ios') {
    return shouldUseTestAds() ? TEST_REWARDED_IOS : (iosEnv || TEST_REWARDED_IOS);
  }
  return TEST_REWARDED_ANDROID;
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
 * DEV "Native player" mode (Dev overlay): the browser reports a native
 * context but the AdMob plugin is inert, so ads are faked with a plain
 * full-screen card. Lets the cadence, the Remove Ads skip and the rewarded
 * grant be tested without a device. Compiled out of production.
 */
function isDevFakeAds(): boolean {
  return import.meta.env.DEV && getMonetizationContext().isNative && !Capacitor.isNativePlatform();
}

function showDevFakeAd(kind: 'interstitial' | 'rewarded'): Promise<void> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.setAttribute('role', 'dialog');
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:10000;display:flex;flex-direction:column;align-items:center;' +
      'justify-content:center;gap:16px;background:#111;color:#fff;font:600 16px system-ui,sans-serif;';
    const label = document.createElement('div');
    label.textContent = kind === 'rewarded' ? 'TEST REWARDED AD' : 'TEST INTERSTITIAL AD';
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = kind === 'rewarded' ? 'Close (reward earned)' : 'Close';
    close.style.cssText = 'padding:10px 18px;border-radius:8px;border:1px solid #fff;background:none;color:#fff;font:inherit;';
    close.addEventListener('click', () => {
      overlay.remove();
      resolve();
    });
    overlay.append(label, close);
    document.body.append(overlay);
  });
}

/**
 * Initialize AdMob: consent first, then ads. Idempotent — safe to call from
 * both boot (returning players) and the end of onboarding (first launch).
 * No-op on web.
 *
 * Order (Google UMP + Apple ATT guidance):
 *  1. AdMob.initialize — the plugin wires its consent executor here; it does
 *     not request any ads.
 *  2. UMP consent info; show the GDPR form when required (EEA/UK).
 *  3. iOS ATT prompt if not determined yet (no-op on Android).
 *  4. Ads are enabled only when UMP says `canRequestAds`.
 */
export function initAds(): Promise<void> {
  if (!initPromise) initPromise = runInitAds();
  return initPromise;
}

async function runInitAds(): Promise<void> {
  const ctx = getMonetizationContext();
  if (!ctx.isNative) return;
  if (isDevFakeAds()) {
    initialized = true;
    return;
  }

  try {
    await AdMob.initialize({
      initializeForTesting: shouldUseTestAds(),
    });
  } catch (err) {
    console.warn('[AdService] AdMob.initialize failed', err);
    return; // ads stay disabled for this session
  }

  let canRequestAds = true;
  try {
    let consentInfo = await AdMob.requestConsentInfo({ tagForUnderAgeOfConsent: false });
    if (consentInfo.status === AdmobConsentStatus.REQUIRED && consentInfo.isConsentFormAvailable) {
      consentInfo = await AdMob.showConsentForm();
    }
    canRequestAds = consentInfo.canRequestAds;
    privacyOptionsRequired =
      String(consentInfo.privacyOptionsRequirementStatus) === 'REQUIRED';
  } catch (consentErr) {
    // UMP can fail offline or on unsupported devices. Outside the EEA ads
    // may still be requested; inside it, UMP's own state keeps them
    // non-personalised.
    console.warn('[AdService] UMP consent flow failed (non-fatal)', consentErr);
  }

  if (ctx.platform === 'ios') {
    try {
      const { status } = await AdMob.trackingAuthorizationStatus();
      if (status === 'notDetermined') await AdMob.requestTrackingAuthorization();
    } catch {
      // Older iOS without ATT: nothing to ask.
    }
  }

  if (!canRequestAds) {
    track('ads_consent_blocked', {});
    return;
  }
  initialized = true;
  void prepareInterstitialIfNeeded();
}

/** True once consent is settled and ads may be requested this session. */
export function isAdsReady(): boolean {
  return initialized;
}

/**
 * EEA/UK players must be able to change their ad consent later (UMP
 * "privacy options entry point"). Settings shows a button when this is true.
 */
export function isAdPrivacyOptionsRequired(): boolean {
  return privacyOptionsRequired;
}

export async function showAdPrivacyOptions(): Promise<void> {
  try {
    await AdMob.showPrivacyOptionsForm();
  } catch (err) {
    console.warn('[AdService] showPrivacyOptionsForm failed', err);
  }
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
export function fireInterstitialIfPending(): Promise<boolean> {
  const run = runFireInterstitial();
  // Set synchronously, so a view mounted in the same tick already waits.
  fullScreenAdGate = run.catch(() => false);
  return run;
}

/**
 * Resolves once no interstitial is on screen. The Router waits on this
 * before starting a newly shown view, so e.g. Play Again's puzzle timer
 * doesn't run underneath the ad.
 */
export function afterFullScreenAd(): Promise<void> {
  return fullScreenAdGate.then(() => undefined);
}

async function runFireInterstitial(): Promise<boolean> {
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

  // Consent not settled / refused, or AdMob failed to start.
  if (!initialized) return false;

  sessionAdCount += 1;
  track('interstitial_shown', { placement: 'win_exit', session_ad_count: sessionAdCount });

  if (isDevFakeAds()) {
    await showDevFakeAd('interstitial');
    return true;
  }

  await prepareInterstitialIfNeeded();
  if (interstitialReady) {
    interstitialReady = false;
    // showInterstitial resolves once the ad is presented; wait for it to be
    // dismissed (or to fail) so callers know when the screen is theirs again.
    const handles: Array<{ remove: () => Promise<void> }> = [];
    try {
      const closed = new Promise<void>((resolve) => {
        void AdMob.addListener(InterstitialAdPluginEvents.Dismissed, () => resolve()).then((h) => handles.push(h));
        void AdMob.addListener(InterstitialAdPluginEvents.FailedToShow, () => resolve()).then((h) => handles.push(h));
        window.setTimeout(resolve, 90_000); // never block the app on a lost event
      });
      await AdMob.showInterstitial();
      await closed;
    } catch (err) {
      console.warn('[AdService] showInterstitial failed', err);
    } finally {
      handles.forEach((h) => void h.remove());
    }
    void prepareInterstitialIfNeeded(); // pre-load next
  }

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

  if (isDevFakeAds()) {
    await showDevFakeAd('rewarded');
    return 'rewarded';
  }

  try {
    await AdMob.prepareRewardVideoAd({
      adId: getRewardedAdId(),
      isTesting: shouldUseTestAds(),
    });
    // `result.type` is the reward TYPE configured in AdMob (e.g. "hint"), not
    // an event name, so comparing it to RewardAdPluginEvents.Rewarded was
    // always false. Use the Rewarded event (fires when the reward is earned),
    // with a non-zero reward amount as a fallback signal.
    let rewardEventFired = false;
    const rewardListener = await AdMob.addListener(RewardAdPluginEvents.Rewarded, () => {
      rewardEventFired = true;
    });
    let result: { amount?: number } | undefined;
    try {
      result = await AdMob.showRewardVideoAd();
    } finally {
      void rewardListener.remove();
    }
    const rewarded = rewardEventFired || (result?.amount ?? 0) > 0;
    track('rewarded_ad_completed', { placement: 'hint', rewarded });
    return rewarded ? 'rewarded' : 'skipped';
  } catch (err) {
    console.warn('[AdService] showRewardVideoAd failed', err);
    return 'unavailable';
  }
}

/** Whether the current context supports native ads at all. */
export function canShowAds(): boolean {
  const ctx = getMonetizationContext();
  return ctx.canShowInterstitials || ctx.canShowRewardedAds;
}
