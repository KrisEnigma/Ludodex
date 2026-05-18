import { Capacitor } from '@capacitor/core';

export async function initAds() {
  if (!Capacitor.isNativePlatform()) return;
  // TODO: wire AdMob init and preload flow.
}

export async function maybeShowInterstitial(_solvedCount: number) {
  if (!Capacitor.isNativePlatform()) return;
  // TODO: show every 2 puzzles unless remove_ads entitlement is active.
}
