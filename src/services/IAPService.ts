import { Capacitor } from '@capacitor/core';
import { Purchases } from '@revenuecat/purchases-capacitor';

const FALLBACK_RC_KEY = 'RC_KEY';

export async function initIAP() {
  if (!Capacitor.isNativePlatform()) return;
  const apiKey = import.meta.env.VITE_REVENUECAT_API_KEY?.trim() || FALLBACK_RC_KEY;
  await Purchases.configure({ apiKey });
}

export async function hasEntitlement(id: string): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  const { customerInfo } = await Purchases.getCustomerInfo();
  return id in customerInfo.entitlements.active;
}

export async function restorePurchases() {
  if (!Capacitor.isNativePlatform()) return;
  await Purchases.restorePurchases();
}
