/**
 * HintStoreSheet — bottom sheet for purchasing hint packs and watching
 * rewarded ads for hints.
 *
 * Opened from three entry points:
 *  1. In-game slot tap at 0 hints (loss_recovery context).
 *  2. In-game hint counter tap at any balance (loss_recovery context).
 *  3. Main menu "Get Hints" action (menu context).
 *
 * The sheet is UI only — all purchase logic is handled by IAPService,
 * and rewarded ad logic by AdService. The `onHintsGranted` callback lets
 * GameView update its in-memory counter immediately after a grant.
 */

import { t } from '../i18n';
import { track } from '../services/AnalyticsService';
import { getMonetizationContext } from '../services/MonetizationContext';
import {
  getProductInfo,
  purchaseHintPack,
  PRODUCT_IDS,
  HINT_PACK_GRANTS,
  type PurchaseSource
} from '../services/IAPService';
import {
  getHintsRemaining,
  getAdHintsRemainingToday,
  consumeAdHintSlot,
  grantHints
} from '../services/HintService';
import { showRewardedAdForHint, canShowAds } from '../services/AdService';
import { addDragToDismiss } from './sheetDrag';

export type HintStoreContext = 'menu' | 'loss_recovery';

type HintPack = {
  productId: typeof PRODUCT_IDS.HINTS_10 | typeof PRODUCT_IDS.HINTS_50 | typeof PRODUCT_IDS.HINTS_200;
  hints: number;
  badge?: string;
  highlighted?: boolean;
};

const PACKS: HintPack[] = [
  { productId: PRODUCT_IDS.HINTS_10,  hints: 10 },
  { productId: PRODUCT_IDS.HINTS_50,  hints: 50,  badge: t('hint_store.pack_badge_best_value') },
  { productId: PRODUCT_IDS.HINTS_200, hints: 200, badge: t('hint_store.pack_badge_save') },
];

/**
 * Render and show the HintStoreSheet.
 *
 * @param context - where it was opened from (affects framing / pack highlight)
 * @param onHintsGranted - called with the number of hints granted (0 if none)
 *   Use this to refresh in-game hint counter without a full re-read.
 */
export async function showHintStore(
  context: HintStoreContext,
  onHintsGranted?: (count: number) => void
): Promise<void> {
  track('hint_store_opened', { context });

  const ctx = getMonetizationContext();

  // Snapshots needed for initial render.
  const [balance, adHintsLeft] = await Promise.all([
    getHintsRemaining(),
    ctx.canShowRewardedAds ? getAdHintsRemainingToday() : Promise.resolve(0),
  ]);

  // Load product prices concurrently.
  const packInfos = await Promise.all(
    PACKS.map(async (pack) => {
      const info = await getProductInfo(pack.productId);
      return { ...pack, priceLabel: info?.priceLabel ?? pack.productId };
    })
  );

  return new Promise<void>((resolve) => {
    // Backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'sheet-backdrop';

    // Sheet
    const sheet = document.createElement('div');
    sheet.className = 'hint-store-sheet';
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    sheet.setAttribute('aria-label', t('hint_store.title'));

    const close = (): void => {
      backdrop.classList.remove('sheet-backdrop--visible');
      sheet.classList.remove('hint-store-sheet--visible');
      window.setTimeout(() => backdrop.remove(), 280);
      resolve();
    };

    backdrop.addEventListener('pointerdown', (e) => {
      // Stop propagation so document-level pointerdown handlers in the game
      // (tile deselection etc.) don't fire when the user taps the backdrop.
      e.stopPropagation();
    });
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) close();
    });

    // Drag handle
    const handle = document.createElement('div');
    handle.className = 'sheet-handle';
    addDragToDismiss(handle, sheet, backdrop, () => { backdrop.remove(); resolve(); });

    // Header
    const header = document.createElement('div');
    header.className = 'hint-store-header';

    const title = document.createElement('h2');
    title.className = 'hint-store-title';
    title.textContent = t('hint_store.title');

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'hint-store-close';
    closeBtn.textContent = '✕';
    closeBtn.setAttribute('aria-label', t('hint_store.close'));
    closeBtn.addEventListener('click', close);

    header.append(title, closeBtn);

    // Balance row
    const balanceRow = document.createElement('div');
    balanceRow.className = 'hint-store-balance';
    const balanceLabel = document.createElement('span');
    balanceLabel.className = 'hint-store-balance-label';
    balanceLabel.textContent = t('hint_store.balance_label');
    const balanceCount = document.createElement('span');
    balanceCount.className = 'hint-store-balance-count';
    balanceCount.textContent = String(balance);
    balanceRow.append(balanceLabel, balanceCount);

    // Rewarded ad CTA (native only, when slots remain)
    let adRow: HTMLElement | null = null;
    if (ctx.canShowRewardedAds && adHintsLeft > 0) {
      adRow = document.createElement('button');
      adRow.className = 'hint-store-ad-cta button-secondary';
      (adRow as HTMLButtonElement).type = 'button';
      adRow.textContent = t('hint_store.watch_ad_cta');

      const adRemaining = document.createElement('span');
      adRemaining.className = 'hint-store-ad-remaining';
      adRemaining.textContent = t('hint_store.watch_ad_remaining', { n: adHintsLeft });

      let remainingSlots = adHintsLeft;

      adRow.addEventListener('click', (e) => {
        const btn = e.currentTarget as HTMLButtonElement;
        btn.disabled = true;
        void (async () => {
          const result = await showRewardedAdForHint();
          if (result === 'rewarded') {
            const consumed = await consumeAdHintSlot();
            if (consumed) {
              const state = await grantHints(1);
              balanceCount.textContent = String(state.hintsRemaining);
              remainingSlots -= 1;
              adRemaining.textContent = t('hint_store.watch_ad_remaining', { n: remainingSlots });
              onHintsGranted?.(1);
              if (remainingSlots <= 0 && adRow) {
                adRow.remove();
              } else {
                btn.disabled = false;
              }
            } else {
              btn.disabled = false;
            }
          } else {
            btn.disabled = false;
          }
        })();
      });

      const adSection = document.createElement('div');
      adSection.className = 'hint-store-ad-section';
      adSection.append(adRow, adRemaining);
      adRow = adSection;
    }

    // Packs list
    const packsList = document.createElement('div');
    packsList.className = 'hint-store-packs';

    for (const pack of packInfos) {
      const isHighlighted = context === 'loss_recovery' && pack.productId === PRODUCT_IDS.HINTS_10;
      const card = document.createElement('div');
      card.className = 'hint-store-pack-card';
      if (isHighlighted) card.dataset.highlighted = 'true';

      const left = document.createElement('div');
      left.className = 'hint-store-pack-left';

      const countEl = document.createElement('span');
      countEl.className = 'hint-store-pack-count';
      countEl.textContent = String(pack.hints);
      const countLabel = document.createElement('span');
      countLabel.className = 'hint-store-pack-count-label';
      countLabel.textContent = t('hint_store.pack_hints_label');
      left.append(countEl, countLabel);

      if (pack.badge) {
        const badge = document.createElement('span');
        badge.className = 'hint-store-pack-badge';
        badge.textContent = pack.badge;
        left.append(badge);
      }

      const buyBtn = document.createElement('button');
      buyBtn.type = 'button';
      buyBtn.className = 'hint-store-pack-buy button-primary';
      buyBtn.textContent = t('hint_store.buy_button', { n: pack.hints, price: pack.priceLabel });

      const purchaseSource: PurchaseSource = context === 'loss_recovery'
        ? 'hint_store_loss_recovery'
        : 'hint_store';

      buyBtn.addEventListener('click', () => {
        void (async () => {
          buyBtn.disabled = true;
          track('iap_offered', { product_id: pack.productId, context });
          const result = await purchaseHintPack(pack.productId, purchaseSource);
          if (result.status === 'success') {
            const granted = HINT_PACK_GRANTS[pack.productId] ?? 0;
            const newBalance = await getHintsRemaining();
            balanceCount.textContent = String(newBalance);
            onHintsGranted?.(granted);
            close();
          } else {
            buyBtn.disabled = false;
          }
        })();
      });

      card.append(left, buyBtn);
      packsList.append(card);
    }

    const children: Array<HTMLElement | null> = [
      handle,
      header,
      balanceRow,
      adRow,
      packsList,
    ];
    sheet.append(...children.filter((el): el is HTMLElement => el !== null));
    backdrop.append(sheet);
    document.body.append(backdrop);

    // Animate in — double rAF ensures the initial translateY(100%) state is
    // painted before the transition class fires (single rAF batches both
    // into the same frame on some Android versions, skipping the animation).
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        backdrop.classList.add('sheet-backdrop--visible');
        sheet.classList.add('hint-store-sheet--visible');
      });
    });
  });
}
