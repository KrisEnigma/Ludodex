import { Capacitor } from '@capacitor/core';
import { AdMob, InterstitialAdPluginEvents } from '@capacitor-community/admob';
import { isOwned } from './IAPService';
import { getMonetizationContext } from './MonetizationContext';

const TEST_INTERSTITIAL_ANDROID = 'ca-app-pub-3940256099942544/1033173712';
const TEST_INTERSTITIAL_IOS = 'ca-app-pub-3940256099942544/4411468910';
const PRODUCT_REMOVE_ADS = 'remove_ads';

function shouldUseTestAds(): boolean {
  const value = import.meta.env.VITE_ADMOB_USE_TEST_IDS;
  if (!value) return true;
  return value !== 'false';
}

let initialized = false;
let preparing = false;
let interstitialReady = false;

function getInterstitialAdId(): string {
  const platform = Capacitor.getPlatform();
  const androidEnv = import.meta.env.VITE_ADMOB_INTERSTITIAL_ANDROID?.trim();
  const iosEnv = import.meta.env.VITE_ADMOB_INTERSTITIAL_IOS?.trim();

  if (platform === 'android') {
    return shouldUseTestAds() ? TEST_INTERSTITIAL_ANDROID : androidEnv || TEST_INTERSTITIAL_ANDROID;
  }

  if (platform === 'ios') {
    return shouldUseTestAds() ? TEST_INTERSTITIAL_IOS : iosEnv || TEST_INTERSTITIAL_IOS;
  }

  return TEST_INTERSTITIAL_ANDROID;
}

async function prepareInterstitialIfNeeded() {
  if (!Capacitor.isNativePlatform()) return;
  if (!initialized || preparing || interstitialReady) return;

  preparing = true;
  try {
    await AdMob.prepareInterstitial({
      adId: getInterstitialAdId(),
      isTesting: shouldUseTestAds(),
      immersiveMode: true
    });
  } catch (error) {
    console.warn('AdMob prepareInterstitial failed', error);
  } finally {
    preparing = false;
  }
}

export async function initAds(): Promise<void> {
  const ctx = getMonetizationContext();
  if (!ctx.isNative) return;
  // TODO(native): Initialize @capacitor-community/admob.
  //   await AdMob.initialize({ initializeForTesting: __DEV__ });
  //   Trigger UMP consent flow (EU/UK GDPR) and, on iOS, ATT prompt.
}

export async function maybeShowInterstitial(solvedCount: number): Promise<void> {
  const ctx = getMonetizationContext();
  if (!ctx.canShowAds) return;
  if (solvedCount <= 0) return;
  if (solvedCount % 2 !== 0) return;
  if (await isOwned(PRODUCT_REMOVE_ADS)) return;
  // TODO(native): Prepare + show interstitial.
  //   await AdMob.prepareInterstitial({ adId: AD_UNIT_INTERSTITIAL_* });
  //   await AdMob.showInterstitial();
}

export function canShowAds(): boolean {
  return getMonetizationContext().canShowAds;
}
