import { Capacitor } from '@capacitor/core';

export type Platform = 'ios' | 'android' | 'web';

export type MonetizationContext = {
  platform: Platform;
  isNative: boolean;
  canPurchase: boolean;
  /**
   * True on native builds where interstitial ads are available.
   * Does NOT account for the remove_ads entitlement — callers that need
   * that check must call `isOwned('remove_ads')` separately.
   */
  canShowInterstitials: boolean;
  /**
   * True on native builds where rewarded ads are available.
   * Always true on native regardless of remove_ads ownership —
   * remove_ads removes interstitials only; rewarded ads remain opt-in.
   */
  canShowRewardedAds: boolean;
  /**
   * True on web, where we use banner ads (AdSense / equivalent) instead
   * of interstitials and rewarded video.
   */
  canShowBannerAds: boolean;
};

export function getMonetizationContext(): MonetizationContext {
  const raw = Capacitor.getPlatform();
  const platform: Platform = raw === 'ios' ? 'ios' : raw === 'android' ? 'android' : 'web';
  const isNative = Capacitor.isNativePlatform();
  return {
    platform,
    isNative,
    canPurchase: isNative,
    canShowInterstitials: isNative,
    canShowRewardedAds: isNative,
    canShowBannerAds: !isNative,
  };
}
