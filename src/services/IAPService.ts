import { Capacitor } from '@capacitor/core';
import { Purchases } from '@revenuecat/purchases-capacitor';
import { track } from './AnalyticsService';
import { getMonetizationContext } from './MonetizationContext';
import { grantHints } from './HintService';
import { isEarned } from './AchievementService';
import { SKINS, type SkinId, type SkinMeta } from '../skins/registry';
import { isWebAvailable, WEB_SKIN_IDS, PROMO_SKIN_ID } from '../skins/webConfig';

const FALLBACK_RC_KEY = 'RC_KEY';

// ── Dev mode ──────────────────────────────────────────────────────────────────
// Only active on the Vite dev server (import.meta.env.DEV = true).
// Completely tree-shaken from production builds — zero runtime cost.

const DEV_SIM_KEY = 'dev_sim_platform';

if (import.meta.env.DEV) {
  // Mount the floating dev overlay (tap to toggle between dev/web-player mode)
  import('../dev/DevOverlay').then(m => m.initDevOverlay());
}

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
  SKIN_NEON_HORIZON:  'skin_neon_horizon',
  SKIN_GAMEBOY:       'skin_gameboy',
  SKIN_RING_OF_LIGHT: 'skin_ring_of_light',
  SKIN_LORD_OF_TERROR:'skin_lord_of_terror',
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
  [PRODUCT_IDS.SKIN_NEON_HORIZON]:  { id: PRODUCT_IDS.SKIN_NEON_HORIZON,  priceLabel: '$1.99', fallbackPriceLabel: '$1.99' },
  [PRODUCT_IDS.SKIN_GAMEBOY]:       { id: PRODUCT_IDS.SKIN_GAMEBOY,       priceLabel: '$1.99', fallbackPriceLabel: '$1.99' },
  [PRODUCT_IDS.SKIN_RING_OF_LIGHT]: { id: PRODUCT_IDS.SKIN_RING_OF_LIGHT, priceLabel: '$1.99', fallbackPriceLabel: '$1.99' },
  [PRODUCT_IDS.SKIN_LORD_OF_TERROR]:{ id: PRODUCT_IDS.SKIN_LORD_OF_TERROR,priceLabel: '$1.99', fallbackPriceLabel: '$1.99' },
  [PRODUCT_IDS.SKIN_BUNDLE]:        { id: PRODUCT_IDS.SKIN_BUNDLE,        priceLabel: '$2.99', fallbackPriceLabel: '$2.99' },
};

/**
 * Synchronous skin accessibility check for boot-time resolution.
 * Web (incl. dev web-sim): uses isWebAvailable — fully synchronous.
 * Native / dev full-access: returns true (async RevenueCat check deferred to refreshEntitlements).
 */
export function isSkinAccessibleSync(skinId: SkinId): boolean {
  if (import.meta.env.DEV && sessionStorage.getItem(DEV_SIM_KEY) !== 'web') return true;
  const ctx = getMonetizationContext();
  if (!ctx.isNative) return isWebAvailable(skinId);
  return true; // native: optimistic — entitlement check is async
}

/**
 * Skins that should be shown in the skin gallery for the current context.
 * Dev full-access: all skins.
 * Web (or web-player simulation): only isWebAvailable skins.
 * Native: all skins.
 */
export function getVisibleSkins(): SkinMeta[] {
  if (import.meta.env.DEV && sessionStorage.getItem(DEV_SIM_KEY) !== 'web') return SKINS;
  const ctx = getMonetizationContext();
  if (!ctx.isNative) return SKINS.filter((s) => isWebAvailable(s.id));
  return SKINS;
}

export async function initIAP(): Promise<void> {
  const ctx = getMonetizationContext();
  if (!ctx.isNative) return;
  const apiKey: string =
    ctx.platform === 'ios'
      ? (import.meta.env.VITE_RC_IOS_KEY as string | undefined) ?? FALLBACK_RC_KEY
      : (import.meta.env.VITE_RC_ANDROID_KEY as string | undefined) ?? FALLBACK_RC_KEY;
  await Purchases.configure({ apiKey });
}

export async function isOwned(productId: string): Promise<boolean> {
  const ctx = getMonetizationContext();
  if (!ctx.isNative) return false;
  try {
    const { customerInfo } = await Purchases.getCustomerInfo();
    return customerInfo.entitlements.active[productId] !== undefined;
  } catch (err) {
    console.warn('[IAPService] isOwned query failed', err);
    return false;
  }
}

/**
 * Single source of truth for whether the player owns a given skin.
 * Resolution order:
 *   1. Dev server (localhost): full access unless simulating web player
 *   2. Web build: only skins listed in webConfig.ts (all free, no IAP)
 *   3. Native — always-free skins (productId: null)
 *   4. Native — achievement unlock
 *   5. Native — IAP / bundle (RevenueCat)
 *
 * This is the only function callers should use to gate skin access.
 */
export async function isSkinOwned(skinId: SkinId): Promise<boolean> {
  const skin = SKINS.find((s) => s.id === skinId);
  if (!skin) return false;

  // Dev: full unlock unless explicitly simulating the web player experience.
  if (import.meta.env.DEV && sessionStorage.getItem(DEV_SIM_KEY) !== 'web') return true;

  // Web: only skins in webConfig are available (all free on web, no IAP surface).
  const ctx = getMonetizationContext();
  if (!ctx.isNative) return isWebAvailable(skinId);

  // Native: always-free skins.
  if (skin.productId === null) return true;

  // Native: achievement-based unlock.
  if (skin.unlockedByAchievement && await isEarned(skin.unlockedByAchievement)) return true;

  // Native: IAP / bundle unlock.
  if (await isOwned(skin.productId)) return true;
  if (skin.bundleProductId && await isOwned(skin.bundleProductId)) return true;

  return false;
}

export async function listProducts(): Promise<ProductInfo[]> {
  const ctx = getMonetizationContext();
  if (!ctx.isNative) return [];
  try {
    const offeringsResult = await Purchases.getOfferings();
    const packages = offeringsResult.current?.availablePackages ?? [];
    if (packages.length === 0) return Object.values(FALLBACK_CATALOG);
    return packages.map((pkg) => {
      const id = pkg.product.identifier;
      return {
        id,
        priceLabel: pkg.product.priceString,
        fallbackPriceLabel: FALLBACK_CATALOG[id]?.fallbackPriceLabel ?? pkg.product.priceString,
      };
    });
  } catch (err) {
    console.warn('[IAPService] listProducts failed, using fallback catalog', err);
    return Object.values(FALLBACK_CATALOG);
  }
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

  try {
    const offeringsResult = await Purchases.getOfferings();
    const packages = offeringsResult.current?.availablePackages ?? [];
    const pkg = packages.find((p) => p.product.identifier === productId);
    if (!pkg) {
      const result = { status: 'failed' as const, productId, reason: 'product-not-found' };
      track('iap_purchase_failed', { product_id: productId, reason: result.reason, source });
      return result;
    }
    await Purchases.purchasePackage({ aPackage: pkg });
    track('iap_purchased', { product_id: productId, source });
    return { status: 'success', productId };
  } catch (err: unknown) {
    const code: string = (err as { code?: string })?.code ?? '';
    if (code === 'PURCHASE_CANCELLED') {
      return { status: 'cancelled', productId };
    }
    const result = { status: 'failed' as const, productId, reason: code || 'unknown' };
    track('iap_purchase_failed', { product_id: productId, reason: result.reason, source });
    return result;
  }
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
  try {
    const { customerInfo } = await Purchases.restorePurchases();
    return Object.keys(customerInfo.entitlements.active).map((id) => ({
      status: 'success' as const,
      productId: id,
    }));
  } catch (err) {
    console.warn('[IAPService] restorePurchases failed', err);
    return [];
  }
}

/** @deprecated Use `isOwned(productId)` per call instead. Kept for SettingsView's current shape. */
export async function listOwnedProductIds(): Promise<string[]> {
  const ctx = getMonetizationContext();
  if (!ctx.isNative) return [];
  try {
    const { customerInfo } = await Purchases.getCustomerInfo();
    return Object.keys(customerInfo.entitlements.active);
  } catch (err) {
    console.warn('[IAPService] listOwnedProductIds failed', err);
    return [];
  }
}
