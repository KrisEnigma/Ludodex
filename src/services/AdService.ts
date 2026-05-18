import { Capacitor } from '@capacitor/core';
import { AdMob, InterstitialAdPluginEvents } from '@capacitor-community/admob';
import { hasEntitlement } from './IAPService';

const TEST_INTERSTITIAL_ANDROID = 'ca-app-pub-3940256099942544/1033173712';
const TEST_INTERSTITIAL_IOS = 'ca-app-pub-3940256099942544/4411468910';

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

export async function initAds() {
  if (!Capacitor.isNativePlatform()) return;
  if (initialized) return;

  await AdMob.initialize({
    initializeForTesting: shouldUseTestAds(),
    testingDevices: []
  });

  await AdMob.addListener(InterstitialAdPluginEvents.Loaded, () => {
    interstitialReady = true;
  });

  await AdMob.addListener(InterstitialAdPluginEvents.FailedToLoad, () => {
    interstitialReady = false;
  });

  await AdMob.addListener(InterstitialAdPluginEvents.FailedToShow, () => {
    interstitialReady = false;
  });

  await AdMob.addListener(InterstitialAdPluginEvents.Dismissed, () => {
    interstitialReady = false;
    void prepareInterstitialIfNeeded();
  });

  initialized = true;
  await prepareInterstitialIfNeeded();
}

export async function maybeShowInterstitial(solvedCount: number) {
  if (!Capacitor.isNativePlatform()) return;
  if (!initialized) {
    await initAds();
  }

  const adsRemoved = await hasEntitlement('remove_ads');
  if (adsRemoved) return;

  // Show an interstitial after every 2 completed puzzles.
  if (solvedCount <= 0 || solvedCount % 2 !== 0) return;

  if (!interstitialReady) {
    await prepareInterstitialIfNeeded();
  }

  if (!interstitialReady) return;

  try {
    await AdMob.showInterstitial();
    // Loaded state will reset on dismiss listener; this keeps preloading robust.
    interstitialReady = false;
    await prepareInterstitialIfNeeded();
  } catch (error) {
    interstitialReady = false;
    console.warn('AdMob showInterstitial failed', error);
    await prepareInterstitialIfNeeded();
  }
}
