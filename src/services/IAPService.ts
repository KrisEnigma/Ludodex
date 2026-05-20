import { Capacitor } from '@capacitor/core';
import { track } from './AnalyticsService';
import { getMonetizationContext } from './MonetizationContext';

const FALLBACK_RC_KEY = 'RC_KEY';

export type PurchaseStatus = 'success' | 'cancelled' | 'failed' | 'unavailable';

export type PurchaseResult = {
  status: PurchaseStatus;
  productId: string;
  reason?: string;
};

export type ProductInfo = {
  id: string;
  /** Localized, formatted price string from the store (e.g. "$0.99", "0,99 €"). */
  priceLabel: string;
  /** Fallback price label used when the store SDK has not loaded a value. */
  fallbackPriceLabel: string;
};

const FALLBACK_CATALOG: Record<string, ProductInfo> = {
  remove_ads:      { id: 'remove_ads',      priceLabel: '$1.99', fallbackPriceLabel: '$1.99' },
  skin_synthwave:  { id: 'skin_synthwave',  priceLabel: '$0.99', fallbackPriceLabel: '$0.99' },
  skin_pixel:      { id: 'skin_pixel',      priceLabel: '$0.99', fallbackPriceLabel: '$0.99' },
  skin_bundle:     { id: 'skin_bundle',     priceLabel: '$1.99', fallbackPriceLabel: '$1.99' }
};

export async function initIAP(): Promise<void> {
  const ctx = getMonetizationContext();
  if (!ctx.isNative) return;
  // TODO(native): Initialize RevenueCat SDK with platform-specific public API key.
  //   import { Purchases } from '@revenuecat/purchases-capacitor';
  //   await Purchases.configure({ apiKey: ctx.platform === 'ios' ? IOS_KEY : ANDROID_KEY });
}

export async function isOwned(productId: string): Promise<boolean> {
  const ctx = getMonetizationContext();
  if (!ctx.isNative) return false;
  // TODO(native): Query entitlements from RevenueCat.
  //   const info = await Purchases.getCustomerInfo();
  //   return info.customerInfo.entitlements.active[productId] !== undefined;
  return false;
}

export async function listProducts(): Promise<ProductInfo[]> {
  const ctx = getMonetizationContext();
  if (!ctx.isNative) return [];
  // TODO(native): Fetch real product info from the store via RevenueCat.
  //   const offerings = await Purchases.getOfferings();
  //   ...map to ProductInfo with real localized prices...
  return Object.values(FALLBACK_CATALOG);
}

export async function getProductInfo(productId: string): Promise<ProductInfo | null> {
  const products = await listProducts();
  if (products.length > 0) {
    return products.find(p => p.id === productId) ?? null;
  }
  return FALLBACK_CATALOG[productId] ?? null;
}

export async function purchase(
  productId: string,
  source: 'skin_preview' | 'unknown' = 'unknown'
): Promise<PurchaseResult> {
  track('iap_purchase_started', { product_id: productId, source });
  const ctx = getMonetizationContext();
  if (!ctx.isNative) {
    const result = { status: 'unavailable', productId, reason: 'web' } as const;
    track('iap_purchase_failed', {
      product_id: productId,
      reason: result.reason,
      source
    });
    return result;
  }
  // TODO(native): Trigger RevenueCat purchase flow.
  //   try {
  //     const result = await Purchases.purchaseProduct({ productIdentifier: productId });
  //     return { status: 'success', productId };
  //   } catch (err) { ...map to PurchaseStatus... }
  const result = { status: 'failed', productId, reason: 'not-implemented' } as const;
  track('iap_purchase_failed', {
    product_id: productId,
    reason: result.reason ?? result.status,
    source
  });
  return result;
}

export async function restorePurchases(): Promise<PurchaseResult[]> {
  const ctx = getMonetizationContext();
  if (!ctx.isNative) return [];
  // TODO(native): Restore via RevenueCat.
  //   const info = await Purchases.restorePurchases();
  //   ...map entitlements to PurchaseResult[]...
  return [];
}

/** @deprecated Use `isOwned(productId)` per call instead. Kept for SettingsView's current shape. */
export async function listOwnedProductIds(): Promise<string[]> {
  const ctx = getMonetizationContext();
  if (!ctx.isNative) return [];
  // TODO(native): Map active entitlements to product IDs.
  return [];
}
