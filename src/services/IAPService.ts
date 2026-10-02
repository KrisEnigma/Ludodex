import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { Purchases, type CustomerInfo } from '@revenuecat/purchases-capacitor';
import { track } from './AnalyticsService';
import { getMonetizationContext } from './MonetizationContext';
import { grantHints } from './HintService';
import { scheduleCloudSave } from './CloudSaveService';
import { isEarned } from './AchievementService';
import { SKINS, type SkinId, type SkinMeta } from '../skins/registry';
import { isWebAvailable, WEB_SKIN_IDS, PROMO_SKIN_ID } from '../skins/webConfig';


// ── Dev mode ──────────────────────────────────────────────────────────────────
// Only active on the Vite dev server (import.meta.env.DEV = true).
// Completely tree-shaken from production builds — zero runtime cost.

const DEV_SIM_KEY = 'dev_sim_platform';

if (import.meta.env.DEV) {
  // Mount the floating dev overlay (tap to toggle between dev/web-player mode)
  import('../dev/DevOverlay').then(m => m.initDevOverlay());
}

/** 'pending' = Ask to Buy / deferred payment: it completes (or not) later. */
export type PurchaseStatus = 'success' | 'cancelled' | 'pending' | 'failed' | 'unavailable';

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
  // Not sold for now (non-commercial font, see docs/TODO.md); earn-only.
  SKIN_LORD_OF_TERROR:'skin_lord_of_terror',
  SKIN_MUSHROOM_KINGDOM: 'skin_mushroom_kingdom',
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
  [PRODUCT_IDS.SKIN_MUSHROOM_KINGDOM]: { id: PRODUCT_IDS.SKIN_MUSHROOM_KINGDOM, priceLabel: '$1.99', fallbackPriceLabel: '$1.99' },
  [PRODUCT_IDS.SKIN_BUNDLE]:        { id: PRODUCT_IDS.SKIN_BUNDLE,        priceLabel: '$2.99', fallbackPriceLabel: '$2.99' },
};

/**
 * Synchronous skin accessibility check for boot-time resolution.
 * Web (incl. dev web-sim): uses isWebAvailable — fully synchronous.
 * Native / dev full-access: returns true (async RevenueCat check deferred to refreshEntitlements).
 */
export function isSkinAccessibleSync(skinId: SkinId): boolean {
  if (import.meta.env.DEV && sessionStorage.getItem(DEV_SIM_KEY) === null) return true;
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
  if (import.meta.env.DEV && sessionStorage.getItem(DEV_SIM_KEY) === null) return SKINS;
  const ctx = getMonetizationContext();
  if (!ctx.isNative) return SKINS.filter((s) => isWebAvailable(s.id));
  return SKINS;
}

export async function initIAP(): Promise<void> {
  const ctx = getMonetizationContext();
  if (!ctx.isNative) return;
  if (import.meta.env.DEV && !Capacitor.isNativePlatform()) return; // dev native-sim: skip RevenueCat
  // RevenueCat issues one public SDK key per platform (iOS appl_…, Android goog_…).
  const apiKey = (
    ctx.platform === 'ios'
      ? (import.meta.env.VITE_RC_IOS_KEY as string | undefined)
      : (import.meta.env.VITE_RC_ANDROID_KEY as string | undefined)
  )?.trim();
  if (!apiKey) {
    // Fail loudly instead of configuring with a placeholder key: purchases
    // stay unavailable (calls fail and are handled) until the key is set.
    console.error(`[IAPService] Missing RevenueCat key (VITE_RC_${ctx.platform === 'ios' ? 'IOS' : 'ANDROID'}_KEY) — purchases disabled.`);
    return;
  }
  await Purchases.configure({ apiKey });

  // Purchases can land outside purchase(): Ask to Buy approved later, a
  // pending Android payment clearing, a crash between charge and grant.
  // Every customer-info update re-checks the consumable ledger and tells the
  // UI so newly owned skins unlock.
  await Purchases.addCustomerInfoUpdateListener((info) => {
    void creditConsumables(info).then(() => purchaseListeners.forEach((fn) => fn()));
  });
  try {
    const { customerInfo } = await Purchases.getCustomerInfo();
    await creditConsumables(customerInfo);
  } catch (err) {
    console.warn('[IAPService] initial customer info failed', err);
  }
}

// ── Consumable ledger ─────────────────────────────────────────────────────────
// Hints are local, so each consumable transaction is credited exactly once,
// keyed by its store transaction id. The first run only records a baseline
// (transactions from before this ledger existed are not re-granted).

const CREDITED_TX_KEY = 'ludodex.iap.credited_tx';
const purchaseListeners = new Set<() => void>();

/** Called when purchases change outside the normal flow (e.g. Ask to Buy approved). */
export function onPurchasesUpdated(fn: () => void): () => void {
  purchaseListeners.add(fn);
  return () => purchaseListeners.delete(fn);
}

let crediting: Promise<number> = Promise.resolve(0);

/** Grant hints for consumable transactions not credited yet. Returns hints granted. */
function creditConsumables(info: CustomerInfo): Promise<number> {
  crediting = crediting.then(() => runCredit(info), () => runCredit(info));
  return crediting;
}

async function runCredit(info: CustomerInfo): Promise<number> {
  const txs = (info.nonSubscriptionTransactions ?? []).filter((tx) => HINT_PACK_GRANTS[tx.productIdentifier]);
  const { value } = await Preferences.get({ key: CREDITED_TX_KEY });
  if (value === null) {
    await Preferences.set({ key: CREDITED_TX_KEY, value: JSON.stringify(txs.map((tx) => tx.transactionIdentifier)) });
    return 0;
  }
  let credited: string[] = [];
  try {
    credited = JSON.parse(value) as string[];
  } catch {
    credited = [];
  }
  const seen = new Set(credited);
  let granted = 0;
  for (const tx of txs) {
    if (seen.has(tx.transactionIdentifier)) continue;
    granted += HINT_PACK_GRANTS[tx.productIdentifier] ?? 0;
    seen.add(tx.transactionIdentifier);
  }
  if (granted > 0) {
    // Record first, then grant: a crash in between loses a grant rather than
    // duplicating one on every launch.
    await Preferences.set({ key: CREDITED_TX_KEY, value: JSON.stringify([...seen]) });
    await grantHints(granted);
    scheduleCloudSave();
    track('iap_consumable_credited', { hints: granted });
  }
  return granted;
}

export async function isOwned(productId: string): Promise<boolean> {
  const ctx = getMonetizationContext();
  if (!ctx.isNative) return false;
  if (import.meta.env.DEV && !Capacitor.isNativePlatform()) return false; // dev native-sim: nothing purchased
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
 *   3. Native — achievement unlock (achievement-only if productId is null)
 *   4. Native — always-free skins (productId: null, no achievement gate)
 *   5. Native — IAP / bundle (RevenueCat)
 *
 * This is the only function callers should use to gate skin access.
 */
export async function isSkinOwned(skinId: SkinId): Promise<boolean> {
  const skin = SKINS.find((s) => s.id === skinId);
  if (!skin) return false;

  // Dev: full unlock unless explicitly simulating the web player experience.
  if (import.meta.env.DEV && sessionStorage.getItem(DEV_SIM_KEY) === null) return true;

  // Web: only skins in webConfig are available (all free on web, no IAP surface).
  const ctx = getMonetizationContext();
  if (!ctx.isNative) return isWebAvailable(skinId);

  // Native: achievement-based unlock. Checked BEFORE the free-skin shortcut:
  // a skin with `productId: null` + `unlockedByAchievement` (Terminal,
  // Phosphor) is achievement-only, not free.
  if (skin.unlockedByAchievement) {
    if (await isEarned(skin.unlockedByAchievement)) return true;
    if (skin.productId === null) return false; // no purchase alternative
  } else if (skin.productId === null) {
    // Native: always-free skins (no achievement gate, no product).
    return true;
  }

  // Native: IAP / bundle unlock.
  if (skin.productId && await isOwned(skin.productId)) return true;
  if (skin.bundleProductId && await isOwned(skin.bundleProductId)) return true;

  return false;
}

export async function listProducts(): Promise<ProductInfo[]> {
  const ctx = getMonetizationContext();
  if (!ctx.isNative) return [];
  if (import.meta.env.DEV && !Capacitor.isNativePlatform()) return Object.values(FALLBACK_CATALOG); // dev native-sim
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

/** Store price labels by product id (local currency), with USD fallbacks. */
export async function getPriceLabels(): Promise<Map<string, string>> {
  const labels = new Map<string, string>();
  for (const info of Object.values(FALLBACK_CATALOG)) labels.set(info.id, info.fallbackPriceLabel);
  for (const info of await listProducts()) labels.set(info.id, info.priceLabel);
  return labels;
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
  if (import.meta.env.DEV && !Capacitor.isNativePlatform()) {
    // Dev native-sim: the UI behaves as native, but there's no billing in a browser.
    return { status: 'failed', productId, reason: 'dev-sim-no-billing' };
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
    const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });
    // Consumables (hint packs, the Starter Pack's hints) are granted here via
    // the ledger, never by callers, so a purchase is credited exactly once.
    await creditConsumables(customerInfo);
    scheduleCloudSave();
    track('iap_purchased', { product_id: productId, source });
    return { status: 'success', productId };
  } catch (err: unknown) {
    const e = err as { code?: string; userCancelled?: boolean | null };
    const code: string = e?.code ?? '';
    // RevenueCat error codes: "1" PURCHASE_CANCELLED_ERROR, "20" PAYMENT_PENDING_ERROR.
    if (e?.userCancelled || code === '1') {
      return { status: 'cancelled', productId };
    }
    if (code === '20') {
      track('iap_purchase_pending', { product_id: productId, source });
      return { status: 'pending', productId };
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
  if (result.status === 'success' || result.status === 'pending') {
    // Hints were credited inside purchase() (or will be, once pending clears).
    // iap_purchased is already tracked inside purchase(); don't double-count.
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
  if (import.meta.env.DEV && !Capacitor.isNativePlatform()) return []; // dev native-sim: no RevenueCat on web
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
  if (import.meta.env.DEV && !Capacitor.isNativePlatform()) return []; // dev native-sim: no RevenueCat on web
  try {
    const { customerInfo } = await Purchases.getCustomerInfo();
    return Object.keys(customerInfo.entitlements.active);
  } catch (err) {
    console.warn('[IAPService] listOwnedProductIds failed', err);
    return [];
  }
}
