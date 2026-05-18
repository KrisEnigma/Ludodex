import { Capacitor } from '@capacitor/core';
import { Purchases } from '@revenuecat/purchases-capacitor';

export async function initIAP() {
  if (!Capacitor.isNativePlatform()) return;
  await Purchases.configure({ apiKey: 'RC_KEY' });
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
