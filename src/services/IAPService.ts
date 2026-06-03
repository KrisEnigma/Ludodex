import { Capacitor } from '@capacitor/core';
import { track } from './AnalyticsService';
import { getMonetizationContext } from './MonetizationContext';
import { grantHints } from './HintService';
import { isEarned } from './AchievementService';
import { SKINS, type SkinId } from '../skins/registry';

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

/**
 * Purchase source context — passed through to analytics so we can segment
 * conversion by where in the product the purchase was initiated.
 */
export type PurchaseSource =
  | 'skin_preview'
  | 'hint_store'
  | 'hint_store_loss_recovery'
  | 'starter_pack'
  | 'settings_remove_ads'
  | 'unknown';

/**
 * Canonical product IDs. Keep in sync with RevenueCat dashboard and
 * Play Console / App Store Connect entries.
 *
 * PRICES: Never hardcode display prices in UI strings. Prices shown in the UI
 * must come from getProductInfo().priceLabel, which RevenueCat populates with
 * the local-currency formatted price at runtime. The fallback labels below are
 * USD defaults shown only while the store SDK is loading.
 */
export const PRODUCT_IDS = {
  REMOVE_ADS:   'remove_ads',
  HINTS_10:     'hints_10',
  HINTS_50:     'hints_50',
  HINTS_200:    'hints_200',
  STARTER_PACK: 'starter_pack',
  SKIN_NEON_HORIZON: 'skin_neon_horizon',
  SKIN_GAMEBOY:   'skin_gameboy',
  // Multi-skin bundle (referenced by skins' bundleProductId). Owning it unlocks
  // every skin whose bundleProductId points here.
  SKIN_BUNDLE:    'skin_bundle',
} as const;

/**
 * How many hints each consumable pack grants. Used in HintStoreSheet to
 * show counts without duplicating this mapping in the UI layer.
 */
export const HINT_PACK_GRANTS: Record<string, number> = {
  [PRODUCT_IDS.HINTS_10]:  10,
  [PRODUCT_IDS.HINTS_50]:  50,
  [PRODUCT_IDS.HINTS_200]: 200,
  // Starter pack includes 30 hints as part of a bundle.
  [PRODUCT_IDS.STARTER_PACK]: 30,
};

const FALLBACK_CATALOG: Record<string, ProductInfo> = {
  [PRODUCT_IDS.REMOVE_ADS]:   { id: PRODUCT_IDS.REMOVE_ADS,   priceLabel: '$2.99', fallbackPriceLabel: '$2.99' },
  [PRODUCT_IDS.HINTS_10]:     { id: PRODUCT_IDS.HINTS_10,     priceLabel: '$0.99', fallbackPriceLabel: '$0.99' },
  [PRODUCT_IDS.HINTS_50]:     { id: PRODUCT_IDS.HINTS_50,     priceLabel: '$2.99', fallbackPriceLabel: '$2.99' },
  [PRODUCT_IDS.HINTS_200]:    { id: PRODUCT_IDS.HINTS_200,    priceLabel: '$7.99', fallbackPriceLabel: '$7.99' },
  [PRODUCT_IDS.STARTER_PACK]: { id: PRODUCT_IDS.STARTER_PACK, priceLabel: '$2.99', fallbackPriceLabel: '$2.99' },
  [PRODUCT_IDS.SKIN_NEON_HORIZON]: { id: PRODUCT_IDS.SKIN_NEON_HORIZON, priceLabel: '$1.99', fallbackPriceLabel: '$1.99' },
  [PRODUCT_IDS.SKIN_GAMEBOY]:   { id: PRODUCT_IDS.SKIN_GAMEBOY,   priceLabel: '$1.99', fallbackPriceLabel: '$1.99' },
  [PRODUCT_IDS.SKIN_BUNDLE]:    { id: PRODUCT_IDS.SKIN_BUNDLE,    priceLabel: '$2.99', fallbackPriceLabel: '$2.99' },
};

export async function initIAP(): Promise<void> {
  const ctx = getMonetizationContext();
  if (!ctx.isNative) return;
  // TODO(native): Initialize RevenueCat SDK.
  //   import { Purchases } from '@revenuecat/purchases-capacitor';
  //   const apiKey = ctx.platform === 'ios'
  //     ? import.meta.env.VITE_RC_IOS_KEY
  //     : import.meta.env.VITE_RC_ANDROID_KEY;
  //   await Purchases.configure({ apiKey });
}

export async function isOwned(productId: string): Promise<boolean> {
  const ctx = getMonetizationContext();
  if (!ctx.isNative) return false;
  // TODO(native): Query entitlements from RevenueCat.
  //   const info = await Purchases.getCustomerInfo();
  //   return info.customerInfo.entitlements.active[productId] !== undefined;
  return false;
}

/**
 * Single source of truth for whether the player owns a given skin.
 * Checks entitlement sources in priority order:
 *   1. Always-free (productId === null) → owned
 *   2. Web — all skins free (no IAP surface on web; skins are a native monetization path)
 *   3. Achievement unlock → native only
 *   4. IAP (RevenueCat) or bundle → native only
 *
 * This is the only function callers should use to gate skin access.
 */
export async function isSkinOwned(skinId: SkinId): Promise<boolean> {
  const skin = SKINS.find((s) => s.id === skinId);
  if (!skin) return false;

  // Always-free skin (free on every platform).
  if (skin.productId === null) return true;

  // On web, all skins are free — there's no IAP surface and skins are
  // a native-only monetization path.
  const ctx = getMonetizationContext();
  if (!ctx.isNative) return true;

  // Achievement-based unlock.
  if (skin.unlockedByAchievement) {
    if (await isEarned(skin.unlockedByAchievement)) return true;
  }

  // IAP-based unlock.
  if (skin.productId) {
    if (await isOwned(skin.productId)) return true;
    if (skin.bundleProductId && await isOwned(skin.bundleProductId)) return true;
  }

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
  source: PurchaseSource = 'unknown'
): Promise<PurchaseResult> {
  const info = await getProductInfo(productId);
  const priceUsd = info?.fallbackPriceLabel ?? '';

  track('iap_purchase_started', { product_id: productId, source });

  const ctx = getMonetizationContext();
  if (!ctx.isNative) {
    const result = { status: 'unavailable', productId, reason: 'web' } as const;
    track('iap_purchase_failed', { product_id: productId, reason: result.reason, source });
    return result;
  }

  // TODO(native): Trigger RevenueCat purchase flow.
  //   try {
  //     const result = await Purchases.purchaseProduct({ productIdentifier: productId });
  //     return { status: 'success', productId };
  //   } catch (err) { ...map to PurchaseStatus... }

  const result = { status: 'failed', productId, reason: 'not-implemented' } as const;
  track('iap_purchase_failed', { product_id: productId, reason: result.reason ?? result.status, source });
  return result;
}

/**
 * Convenience wrapper: purchase a hint pack and, on success, immediately
 * grant the hints to the player's pool.
 */
export async function purchaseHintPack(
  productId: typeof PRODUCT_IDS.HINTS_10 | typeof PRODUCT_IDS.HINTS_50 | typeof PRODUCT_IDS.HINTS_200,
  source: PurchaseSource = 'hint_store'
): Promise<PurchaseResult> {
  const result = await purchase(productId, source);
  if (result.status === 'success') {
    const count = HINT_PACK_GRANTS[productId] ?? 0;
    if (count > 0) {
      await grantHints(count);
    }
    track('iap_purchased', { product_id: productId, source });
  } else if (result.status === 'cancelled') {
    track('iap_declined', { product_id: productId, source });
  } else {
    track('iap_failed', { product_id: productId, error_code: result.reason ?? result.status });
  }
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
