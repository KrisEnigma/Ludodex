import { Capacitor } from '@capacitor/core';

export type Platform = 'ios' | 'android' | 'web';

export type MonetizationContext = {
  platform: Platform;
  isNative: boolean;
  canPurchase: boolean;
  canShowAds: boolean;
};

export function getMonetizationContext(): MonetizationContext {
  const raw = Capacitor.getPlatform();
  const platform: Platform = raw === 'ios' ? 'ios' : raw === 'android' ? 'android' : 'web';
  const isNative = Capacitor.isNativePlatform();
  return {
    platform,
    isNative,
    canPurchase: isNative,
    canShowAds: isNative
  };
}