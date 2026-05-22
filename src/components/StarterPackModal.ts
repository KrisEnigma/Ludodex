/**
 * StarterPackModal — full-screen launch offer overlay.
 *
 * Shown exactly once on day 2 or 3 after install (eligibility gated by
 * StarterPackService). Bundles remove_ads + 30 hints + Synthwave skin at
 * a single discounted price, presented with a 24-hour countdown clock.
 *
 * ## Lifecycle
 *  - Caller must call markStarterPackShown() before invoking showStarterPackModal()
 *    so the countdown starts from the correct anchor timestamp.
 *  - The modal resolves (Promise<void>) when the user either purchases or dismisses.
 *  - The countdown displays 00:00:00 once expired but does NOT auto-close — the
 *    player may still be reading the offer.
 *
 * ## Atomic grant on purchase
 *  - Calls purchase(PRODUCT_IDS.STARTER_PACK, 'starter_pack').
 *  - On success: immediately grants 30 hints via grantHints().
 *    The remove_ads entitlement and Synthwave skin are recorded by RevenueCat
 *    and reflected the next time isOwned() is called (SettingsView, AdService).
 */

import { t } from '../i18n';
import { track } from '../services/AnalyticsService';
import {
  purchase,
  getProductInfo,
  PRODUCT_IDS,
} from '../services/IAPService';
import { grantHints } from '../services/HintService';
import { getStarterPackMsRemaining } from '../services/StarterPackService';

/**
 * Show the Starter Pack modal. Call markStarterPackShown() before this.
 *
 * @returns a Promise that resolves when the modal closes (purchase or dismiss).
 */
export async function showStarterPackModal(): Promise<void> {
  // Load price concurrently with mounting the DOM so the CTA never flickers
  // from a blank state — it starts with the fallback and updates if needed.
  const productInfoPromise = getProductInfo(PRODUCT_IDS.STARTER_PACK);
  const msRemainingInit = await getStarterPackMsRemaining();

  return new Promise<void>((resolve) => {
    // ─── Overlay ────────────────────────────────────────────────────────────
    const overlay = document.createElement('div');
    overlay.className = 'starter-pack-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', t('starter_pack.title'));

    // ─── Card ────────────────────────────────────────────────────────────────
    const card = document.createElement('div');
    card.className = 'starter-pack-card';

    const close = (): void => {
      clearInterval(tickId);
      overlay.remove();
      resolve();
    };

    // ─── Badge ───────────────────────────────────────────────────────────────
    const badge = document.createElement('span');
    badge.className = 'starter-pack-badge';
    badge.textContent = t('starter_pack.badge');

    // ─── Title ───────────────────────────────────────────────────────────────
    const title = document.createElement('h2');
    title.className = 'starter-pack-title';
    title.textContent = t('starter_pack.title');

    // ─── Countdown ──────────────────────────────────────────────────────────
    const countdown = document.createElement('p');
    countdown.className = 'starter-pack-countdown';

    const formatCountdown = (ms: number): string => {
      const totalSec = Math.max(0, Math.ceil(ms / 1000));
      const h = Math.floor(totalSec / 3600);
      const m = Math.floor((totalSec % 3600) / 60);
      const s = totalSec % 60;
      const hh = String(h).padStart(2, '0');
      const mm = String(m).padStart(2, '0');
      const ss = String(s).padStart(2, '0');
      return t('starter_pack.subtitle', { time: `${hh}:${mm}:${ss}` });
    };

    let msLeft = msRemainingInit;
    countdown.textContent = formatCountdown(msLeft);

    // ─── Bundle items ────────────────────────────────────────────────────────
    const itemsList = document.createElement('ul');
    itemsList.className = 'starter-pack-items';

    const bundleItems = [
      t('starter_pack.item_remove_ads'),
      t('starter_pack.item_hints'),
      t('starter_pack.item_skin'),
    ];

    for (const item of bundleItems) {
      const li = document.createElement('li');
      li.className = 'starter-pack-item';

      const check = document.createElement('span');
      check.className = 'starter-pack-item-check';
      check.setAttribute('aria-hidden', 'true');
      check.textContent = '✓';

      const text = document.createElement('span');
      text.textContent = item;

      li.append(check, text);
      itemsList.append(li);
    }

    // ─── CTA button ─────────────────────────────────────────────────────────
    const ctaButton = document.createElement('button');
    ctaButton.type = 'button';
    ctaButton.className = 'starter-pack-cta button-primary';

    // Set initial label from fallback price while the real price loads.
    const setCtaLabel = (price: string): void => {
      ctaButton.textContent = t('starter_pack.cta', { price });
    };
    setCtaLabel('…');

    // Fill with real price as soon as it resolves.
    void productInfoPromise.then((info) => {
      setCtaLabel(info?.priceLabel ?? '$2.99');
    });

    ctaButton.addEventListener('click', () => {
      void (async () => {
        ctaButton.disabled = true;

        const result = await purchase(PRODUCT_IDS.STARTER_PACK, 'starter_pack');

        if (result.status === 'success') {
          // Atomic hint grant — RevenueCat handles the entitlement for
          // remove_ads and skin_synthwave; hints live in local storage.
          await grantHints(30);
          track('starter_pack_purchased', {});
          close();
        } else if (result.status === 'cancelled') {
          track('starter_pack_declined', {});
          ctaButton.disabled = false;
        } else {
          // failed / unavailable — re-enable so the user can retry
          ctaButton.disabled = false;
        }
      })();
    });

    // ─── Dismiss ────────────────────────────────────────────────────────────
    const dismissButton = document.createElement('button');
    dismissButton.type = 'button';
    dismissButton.className = 'starter-pack-dismiss button-tertiary';
    dismissButton.textContent = t('starter_pack.dismiss');
    dismissButton.addEventListener('click', () => {
      track('starter_pack_declined', {});
      close();
    });

    // ─── Assemble ────────────────────────────────────────────────────────────
    card.append(badge, title, countdown, itemsList, ctaButton, dismissButton);
    overlay.append(card);
    document.body.append(overlay);

    // ─── Countdown tick ─────────────────────────────────────────────────────
    const TICK_MS = 1000;
    const tickId = window.setInterval(() => {
      msLeft = Math.max(0, msLeft - TICK_MS);
      countdown.textContent = formatCountdown(msLeft);
      if (msLeft <= 0) {
        countdown.dataset.expired = 'true';
      }
    }, TICK_MS);

    // ─── Animate in ─────────────────────────────────────────────────────────
    requestAnimationFrame(() => {
      overlay.classList.add('starter-pack-overlay--visible');
      card.classList.add('starter-pack-card--visible');
    });
  });
}
