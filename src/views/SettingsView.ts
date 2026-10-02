import { getLang, setLang, t, type Language, type StringKey } from '../i18n';
import { ACHIEVEMENTS } from '../data/achievements';
import {
  applySkin,
  getCurrentSkinId,
  normalizeSkinId as normalizeRegistrySkinId,
  SKINS,
  type SkinId,
  type SkinMeta
} from '../skins/registry';
import { isSkinOwned, purchase, restorePurchases, getVisibleSkins } from '../services/IAPService';
import { isAdPrivacyOptionsRequired, showAdPrivacyOptions } from '../services/AdService';
import { track, updateLocale, setPaidStatus } from '../services/AnalyticsService';
import { getActiveSkinId, getProgressSnapshot, getStreakStatus, resetAllProgress, setActiveSkinId } from '../services/ProgressService';
import { getMonetizationContext } from '../services/MonetizationContext';
import { isWebAvailable, PROMO_SKIN_ID } from '../skins/webConfig';
import {
  isDailyNotificationEnabled,
  enableDailyNotification,
  disableDailyNotification
} from '../services/NotificationService';
import { LEGAL_URLS, STORE_URLS } from '../config/legalUrls';
import { APP_ICONS, getActiveIcon, setActiveIcon, type AppIconId } from '../services/AlternateIconService';
import { showConfirmModal } from '../components/Modal';
import { addDragToDismiss } from '../components/sheetDrag';
import { createIcon } from '../components/icons';
import { trackOverlay } from '../components/overlayStack';
import { isSoundEnabled, playFind, setSoundEnabled } from '../services/SoundService';
import { buildSkinScreen } from '../components/SkinPreview';

// Icon-flow trace logs: dev builds only (silent in production).
const debugLog: (...args: unknown[]) => void = import.meta.env.DEV ? console.log.bind(console) : () => {};

const context = getMonetizationContext();

type SkinGroup = 'owned' | 'earn' | 'buy';
const SKIN_GROUPS: SkinGroup[] = ['owned', 'earn', 'buy'];
const GROUP_HEADING: Record<SkinGroup, StringKey> = {
  owned: 'settings.skins_owned',
  earn: 'settings.skins_earn',
  buy: 'settings.skins_buy'
};

/** Progress toward an unlock achievement, from its id (solve_N / streak_N / pristine_N). */
async function loadUnlockProgress(): Promise<Map<string, { n: number; total: number; kind: 'solved' | 'streak' | 'pristine' }>> {
  const [snapshot, streak] = await Promise.all([getProgressSnapshot(), getStreakStatus()]);
  const out = new Map<string, { n: number; total: number; kind: 'solved' | 'streak' | 'pristine' }>();
  for (const skin of SKINS) {
    const id = skin.unlockedByAchievement;
    if (!id) continue;
    const m = /^(solve|streak|pristine)_(\d+)$/.exec(id);
    if (!m) continue;
    const total = Number(m[2]);
    const kind = m[1] === 'solve' ? 'solved' : (m[1] as 'streak' | 'pristine');
    const n = kind === 'solved' ? snapshot.solvedCount : kind === 'streak' ? streak.effective : snapshot.pristineCount;
    out.set(id, { n: Math.min(n, total), total, kind });
  }
  return out;
}

export class SettingsView {
  public readonly element: HTMLDivElement;

  private readonly status: HTMLParagraphElement;
  private readonly languageButtons = new Map<Language, HTMLButtonElement>();
  private readonly reminderButtons = new Map<boolean, HTMLButtonElement>();
  private readonly skinButtons = new Map<SkinId, HTMLButtonElement>();
  private readonly skinPills = new Map<SkinId, HTMLSpanElement>();
  private readonly skinStatus = new Map<SkinId, { text: HTMLSpanElement; bar: HTMLSpanElement }>();
  /** Picker groups, by how you get the skin: yours / earn (achievement) / buy (IAP). */
  private readonly skinGroups = new Map<SkinGroup, { wrap: HTMLElement; cards: HTMLElement }>();
  private unlockProgress = new Map<string, { n: number; total: number; kind: 'solved' | 'streak' | 'pristine' }>();
  private readonly unlockedBySkin = new Map<SkinId, boolean>();
  private activeSkinId: SkinId = getCurrentSkinId(); // DOM read — correct since main.ts applies skin before routing
  // From the monetization context (not Capacitor directly) so the Dev
  // overlay's "Native player" mode shows the native Settings UI.
  private readonly isNative = context.isNative;
  private activeIconId: AppIconId = 'void';
  private readonly iconButtons = new Map<AppIconId, HTMLButtonElement>();

  // --- Skin preview state machine ---
  private previewingSkinId: SkinId | null = null;
  private skinIdBeforePreview: SkinId | null = null;
  private skinDetailSheet: HTMLElement | null = null;

  private async enterPreview(skinId: SkinId): Promise<void> {
    if (this.previewingSkinId === skinId) return;

    if (this.previewingSkinId === null) {
      // First entry into preview — record what to revert to.
      this.skinIdBeforePreview = this.activeSkinId;
    }

    this.previewingSkinId = skinId;
    applySkin(skinId);
    track('skin_preview_entered', { skin_id: skinId });
  }

  private async exitPreview(): Promise<void> {
    if (this.previewingSkinId === null) return;

    const cancelledSkin = this.previewingSkinId;
    const revertTo = this.skinIdBeforePreview ?? 'void';
    this.previewingSkinId = null;
    this.skinIdBeforePreview = null;
    applySkin(revertTo);
    this.closeSkinDetailSheet();
    track('skin_preview_cancelled', { skin_id: cancelledSkin });
  }

  private async commitPreview(): Promise<void> {
    if (this.previewingSkinId === null) return;

    const committed = this.previewingSkinId;
    this.previewingSkinId = null;
    this.skinIdBeforePreview = null;

    // The applySkin call already happened during enterPreview; just persist it as active.
    this.activeSkinId = committed;
    await setActiveSkinId(committed);
    this.closeSkinDetailSheet();
    this.refreshSkinCards();
  }

  // ── Skin detail sheet ────────────────────────────────────────────────────

  private showSkinDetailSheet(skin: SkinMeta, opts: { isOwned: boolean; isActive: boolean }): void {
    this.closeSkinDetailSheet();

    const backdrop = document.createElement('div');
    backdrop.className = 'skin-detail-backdrop';

    const sheet = document.createElement('div');
    sheet.className = 'skin-detail-sheet';
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');

    // Header: name + close button
    const header = document.createElement('div');
    header.className = 'skin-detail-header';

    const nameEl = document.createElement('span');
    nameEl.className = 'skin-detail-name';
    nameEl.textContent = this.getSkinName(skin.id);

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'skin-detail-close';
    closeBtn.setAttribute('aria-label', t('common.cancel'));
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', () => this.closeSkinDetailSheet());
    header.append(nameEl, closeBtn);

    // Mini game screen in this skin (shared with the picker cards, so the
    // sheet, the cards and the game all match).
    const previewScope = buildSkinScreen(skin.id, 'detail', this.getSkinName(skin.id).toUpperCase());

    // Description
    const descKey = `skin.${skin.id}.desc` as Parameters<typeof t>[0];
    const rawDesc = t(descKey);
    const desc = document.createElement('p');
    desc.className = 'skin-detail-desc';
    desc.textContent = rawDesc !== descKey ? rawDesc : '';
    desc.hidden = !desc.textContent;

    // Actions section
    const actions = document.createElement('div');
    actions.className = 'skin-detail-actions';

    if (opts.isActive) {
      const activePill = document.createElement('span');
      activePill.className = 'skin-detail-active-pill';
      activePill.textContent = `✓ ${t('settings.skin_active')}`;
      actions.append(activePill);
    } else if (opts.isOwned) {
      const useBtn = document.createElement('button');
      useBtn.type = 'button';
      useBtn.className = 'button-primary';
      useBtn.textContent = t('settings.skin_use');
      useBtn.addEventListener('click', () => {
          void this.setSkin(skin.id).then(() => {
            this.closeSkinDetailSheet();
            this.onSkinChosen();
          });
        });
      actions.append(useBtn);
    } else {
      // Locked — show how to unlock
      if (skin.unlockHint) {
        const earnRow = document.createElement('div');
        earnRow.className = 'skin-detail-earn-row';
        // Localized via the achievement's own description (e.g. "30-day daily
        // streak."); the registry's English `unlockHint` is only a fallback.
        const unlockDef = ACHIEVEMENTS.find((a) => a.id === skin.unlockedByAchievement);
        const hintText = unlockDef ? t(unlockDef.descriptionKey as StringKey) : skin.unlockHint;
        earnRow.textContent = t('settings.skin_earn_hint', { hint: hintText });
        actions.append(earnRow);
      }
      if (this.isNative && skin.productId && !skin.unlockHint) {
        const buyBtn = document.createElement('button');
        buyBtn.type = 'button';
        buyBtn.className = 'button-primary';
        buyBtn.textContent = `${t('settings.skin_unlock')} ${this.getPriceLabel(skin.id)}`;
        buyBtn.addEventListener('click', () => {
          // Close the sheet before entering the IAP flow so it doesn't
          // sit on screen behind the OS purchase dialog.
          this.closeSkinDetailSheet();
          void this.attemptPurchase(skin);
        });
        actions.append(buyBtn);
      }
    }

    if (!opts.isActive) {
      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.className = 'button-secondary';
      cancelBtn.textContent = t('common.cancel');
      cancelBtn.addEventListener('click', () => this.closeSkinDetailSheet());
      actions.append(cancelBtn);
    }

    const handle = document.createElement('div');
    handle.className = 'sheet-handle';
    // Drag-to-dismiss: nullify skinDetailSheet first so closeSkinDetailSheet
    // (called inside exitPreview) becomes a no-op and doesn't double-animate.
    addDragToDismiss(handle, sheet, backdrop, () => {
      this.skinDetailSheet = null;
      backdrop.remove();
      void this.exitPreview();
    });
    sheet.append(handle, header, previewScope, desc, actions);
    backdrop.append(sheet);
    document.body.append(backdrop);
    trackOverlay(backdrop, () => this.closeSkinDetailSheet());

    backdrop.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      if (e.target === backdrop) this.closeSkinDetailSheet();
    });

    this.skinDetailSheet = backdrop;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        backdrop.classList.add('skin-detail-backdrop--visible');
        sheet.classList.add('skin-detail-sheet--visible');
      });
    });
  }

  private closeSkinDetailSheet(): void {
    const el = this.skinDetailSheet;
    if (!el) return;
    this.skinDetailSheet = null;
    el.classList.remove('skin-detail-backdrop--visible');
    el.querySelector('.skin-detail-sheet')?.classList.remove('skin-detail-sheet--visible');
    window.setTimeout(() => el.remove(), 280);
  }

  private async closeSkinDetailSheetAndRevert(): Promise<void> {
    this.closeSkinDetailSheet();
    if (this.previewingSkinId !== null) {
      await this.exitPreview();
    }
  }

  private async commitPreviewAndClose(): Promise<void> {
    // Sheet closes as part of commitPreview().
    await this.commitPreview();
    this.onSkinChosen();
  }

  private async attemptPurchase(skin: SkinMeta): Promise<void> {
    if (!skin.productId) return;

    track('skin_preview_buy_tapped', { skin_id: skin.id, product_id: skin.productId });
    this.status.textContent = t('settings.purchase_in_progress', { name: this.getSkinName(skin.id) });

    try {
      await purchase(skin.productId, 'skin_preview');
      await this.refreshEntitlements();

      if (this.unlockedBySkin.get(skin.id)) {
        const owned: string[] = [];
        for (const s of SKINS) {
          if (s.productId && this.unlockedBySkin.get(s.id)) owned.push(s.productId);
        }
        setPaidStatus(owned.length > 0, owned);
        await this.commitPreview();
        this.status.textContent = '';
        this.onSkinChosen();
      } else {
        this.status.textContent = t('settings.purchase_not_unlocked');
        await this.exitPreview();
      }
    } catch {
      this.status.textContent = t('settings.purchase_cancelled_or_unavailable');
      await this.exitPreview();
    }

    this.refreshSkinCards();
  }

  constructor(
    private readonly onBack: () => void,
    private readonly onLanguageChange: () => void,
    private readonly onSkinChosen: () => void = onBack
  ) {
    this.element = document.createElement('div');
    this.element.className = 'view settings-view';

    for (const skin of SKINS) {
      // Optimistic initial state — refreshEntitlements() corrects this async.
      // Native: free skins only. Web (incl. dev sim): web-available skins only.
      // Optimistic first paint; the async isSkinOwned pass corrects it. Must
      // match isSkinOwned's rule: achievement-gated skins start locked.
      this.unlockedBySkin.set(
        skin.id,
        context.isNative ? skin.productId === null && !skin.unlockedByAchievement : isWebAvailable(skin.id)
      );
    }

    this.status = document.createElement('p');
    this.status.className = 'skin-status';
    this.status.textContent = '';

    this.element.append(
      this.renderTopBar(),
      this.renderLanguageSection(),
      this.renderSoundSection(),
      // Daily reminder is native-only (no web push surface).
      ...(this.isNative ? [this.renderNotificationSection()] : []),
      // App icon picker is native-only (launcher icons don't apply on web).
      ...(this.isNative ? [this.renderAppIconSection()] : []),
      this.renderSkinSection(),
      this.renderRestoreButton(),
      this.status,
      this.renderAboutSection()
    );

    void this.bootstrap();
  }

  private async bootstrap(): Promise<void> {
    // Set active skin and refresh cards immediately — don't wait on entitlements
    // (IAP calls can be slow and would leave the wrong skin highlighted in the interim).
    this.activeSkinId = this.normalizeSkinId(await getActiveSkinId());
    this.refreshSkinCards();
    if (this.isNative) {
      this.activeIconId = await getActiveIcon();
      this.refreshIconButtons();
    }
    await this.refreshEntitlements();
    this.unlockProgress = await loadUnlockProgress();
    // If the stored skin is no longer accessible (e.g. promo rotated out), revert and persist.
    if (!this.unlockedBySkin.get(this.activeSkinId)) {
      await this.setSkin('void');
    }
    this.refreshLanguageButtons();
    this.refreshSkinCards();
  }

  private renderTopBar(): HTMLElement {
    const bar = document.createElement('div');
    bar.className = 'view-topbar';

    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'view-topbar-back';
    back.textContent = t('settings.back');
    back.addEventListener('click', () => {
      this.closeSkinDetailSheet();
      this.onBack();
    });

    const title = document.createElement('h2');
    title.className = 'view-topbar-title';
    title.textContent = t('settings.title');

    const spacer = document.createElement('span');
    spacer.style.width = '56px';

    bar.append(back, title, spacer);
    return bar;
  }

  private renderSoundSection(): HTMLElement {
    const section = document.createElement('section');
    section.className = 'settings-section';

    const heading = document.createElement('h3');
    heading.className = 'settings-section-heading';
    heading.textContent = t('settings.section_sound');

    // Same two-button toggle styling as the language picker.
    const toggle = document.createElement('div');
    toggle.className = 'settings-language-toggle';

    const makeButton = (on: boolean): HTMLButtonElement => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'settings-language-button';
      button.textContent = t(on ? 'settings.sound_on' : 'settings.sound_off');
      button.dataset.active = String(isSoundEnabled() === on);
      button.addEventListener('click', () => {
        void setSoundEnabled(on).then(() => {
          onButton.dataset.active = String(on);
          offButton.dataset.active = String(!on);
          if (on) playFind(1, 2); // short preview so the player hears it's on
        });
      });
      return button;
    };
    const onButton = makeButton(true);
    const offButton = makeButton(false);

    toggle.append(onButton, offButton);
    section.append(heading, toggle);
    return section;
  }

  private renderLanguageSection(): HTMLElement {
    const section = document.createElement('section');
    section.className = 'settings-section';

    const heading = document.createElement('h3');
    heading.className = 'settings-section-heading';
    heading.textContent = t('settings.section_language');

    const toggle = document.createElement('div');
    toggle.className = 'settings-language-toggle';

    const english = this.makeLanguageButton('en', 'English');
    const spanish = this.makeLanguageButton('es', 'Español');

    toggle.append(english, spanish);
    section.append(heading, toggle);
    return section;
  }

  private makeLanguageButton(lang: Language, label: string): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'settings-language-button';
    button.textContent = label;
    button.dataset.active = String(getLang() === lang);
    button.addEventListener('click', () => {
      void this.onLangButtonClick(lang);
    });
    this.languageButtons.set(lang, button);
    return button;
  }

  private async onLangButtonClick(lang: Language): Promise<void> {
    if (getLang() === lang) return;
    if (this.previewingSkinId !== null) {
      await this.exitPreview();
    }
    await setLang(lang);
    updateLocale();
    this.onLanguageChange();
  }

  // ── Daily reminder (native only) ──
  private renderNotificationSection(): HTMLElement {
    const section = document.createElement('section');
    section.className = 'settings-section';

    const heading = document.createElement('h3');
    heading.className = 'settings-section-heading';
    heading.textContent = t('settings.section_reminders');

    const toggle = document.createElement('div');
    toggle.className = 'settings-language-toggle';
    toggle.append(
      this.makeReminderButton(false, t('settings.reminder_off')),
      this.makeReminderButton(true, t('settings.reminder_on'))
    );

    const hint = document.createElement('p');
    hint.className = 'settings-reminder-hint';
    hint.textContent = t('settings.reminder_hint');

    section.append(heading, toggle, hint);
    void this.refreshReminderButtons();
    return section;
  }

  private makeReminderButton(enabled: boolean, label: string): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'settings-language-button';
    button.textContent = label;
    button.addEventListener('click', () => {
      void this.onReminderToggle(enabled);
    });
    this.reminderButtons.set(enabled, button);
    return button;
  }

  private async refreshReminderButtons(): Promise<void> {
    const on = await isDailyNotificationEnabled();
    this.reminderButtons.get(true)?.setAttribute('data-active', String(on));
    this.reminderButtons.get(false)?.setAttribute('data-active', String(!on));
  }

  private async onReminderToggle(enable: boolean): Promise<void> {
    const current = await isDailyNotificationEnabled();
    if (enable === current) return;

    if (enable) {
      const granted = await enableDailyNotification();
      if (!granted) {
        // Permission denied at the OS level (or unavailable) — leave it off
        // and point the player at system settings.
        this.status.textContent = t('settings.reminder_denied');
      } else {
        this.status.textContent = '';
        track('daily_reminder_enabled');
      }
    } else {
      await disableDailyNotification();
      this.status.textContent = '';
      track('daily_reminder_disabled');
    }

    await this.refreshReminderButtons();
  }

  // ── App icon picker (native only) ────────────────────────────────────────

  private renderAppIconSection(): HTMLElement {
    const section = document.createElement('section');
    section.className = 'settings-section';

    const heading = document.createElement('h3');
    heading.className = 'settings-section-heading';
    heading.textContent = t('settings.section_app_icon');

    const grid = document.createElement('div');
    grid.className = 'settings-icon-picker';

    for (const appIcon of APP_ICONS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'settings-icon-option';
      btn.dataset.iconId = appIcon.id;

      const img = document.createElement('img');
      img.src = appIcon.src;
      img.alt = appIcon.name;
      img.className = 'settings-icon-option-img';
      img.draggable = false;

      const label = document.createElement('span');
      label.className = 'settings-icon-option-label';
      label.textContent = appIcon.name;

      const check = document.createElement('span');
      check.className = 'settings-icon-option-check';
      check.setAttribute('aria-hidden', 'true');
      check.textContent = '✓';

      btn.append(img, label, check);
      btn.addEventListener('click', () => { void this.onIconOptionClick(appIcon.id); });

      this.iconButtons.set(appIcon.id, btn);
      grid.append(btn);
    }

    section.append(heading, grid);
    return section;
  }

  private async onIconOptionClick(iconId: AppIconId): Promise<void> {
    debugLog('[IconClick] clicked:', iconId, 'activeIconId:', this.activeIconId);
    if (this.activeIconId === iconId) {
      debugLog('[IconClick] same icon, skipping');
      return;
    }

    const previousIconId = this.activeIconId;
    this.activeIconId = iconId;
    this.refreshIconButtons();
    debugLog('[IconClick] set UI state optimistically before native dialog');

    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    this.status.textContent = t('settings.icon_changing');
    try {
      await setActiveIcon(iconId);
      this.status.textContent = '';
      debugLog('[IconClick] done');
    } catch (e: any) {
      console.error('[IconClick] setActiveIcon threw:', e);
      // Probe native state before rolling back — sometimes native succeeds despite a JS rejection.
      try {
        const native = await getActiveIcon();
        debugLog('[IconClick] getActiveIcon after failure returned:', native);
        if (native === iconId) {
          debugLog('[IconClick] native equals requested icon despite error — keeping UI state');
          this.status.textContent = '';
          return;
        }
      } catch (probeErr) {
        console.error('[IconClick] getActiveIcon probe failed:', probeErr);
      }

      this.activeIconId = previousIconId;
      this.refreshIconButtons();
      // Technical detail stays in the console (logged below), not in the UI.
      this.status.textContent = t('settings.icon_change_failed');
      console.error('[IconClick] failed:', e);
    }
  }

  private refreshIconButtons(): void {
    for (const [iconId, btn] of this.iconButtons) {
      btn.dataset.active = String(iconId === this.activeIconId);
    }
  }

  private renderSkinSection(): HTMLElement {
    const section = document.createElement('section');
    section.className = 'settings-section';

    const heading = document.createElement('h3');
    heading.className = 'settings-section-heading';
    heading.textContent = t('settings.section_skin');

    section.append(heading);

    // Groups by how you get the skin; cards are sorted into them (and empty
    // groups hidden) by refreshSkinCards() once entitlements are known.
    for (const group of SKIN_GROUPS) {
      const wrap = document.createElement('div');
      wrap.className = 'settings-skin-group';
      wrap.dataset.group = group;
      const groupHeading = document.createElement('h4');
      groupHeading.className = 'settings-skin-group-heading';
      groupHeading.textContent = t(GROUP_HEADING[group]);
      const cards = document.createElement('div');
      cards.className = 'settings-skin-cards';
      wrap.append(groupHeading, cards);
      section.append(wrap);
      this.skinGroups.set(group, { wrap, cards });
    }

    const visible = getVisibleSkins();
    const regularSkins = !this.isNative ? visible.filter(s => s.id !== PROMO_SKIN_ID) : visible;
    const promoSkin = !this.isNative ? visible.find(s => s.id === PROMO_SKIN_ID) : undefined;

    const ownedCards = this.skinGroups.get('owned')!.cards;
    for (const skin of regularSkins) {
      ownedCards.append(this.buildSkinCard(skin, false));
    }

    if (promoSkin) {
      section.append(this.renderPromoSkinBlock(promoSkin));
    }

    if (!this.isNative) {
      section.append(this.renderSkinSectionWebCta());
    }

    return section;
  }

  private renderSkinSectionWebCta(): HTMLElement {
    const row = document.createElement('div');
    row.className = 'settings-skin-web-cta';

    const label = document.createElement('span');
    label.className = 'settings-skin-web-cta-label';
    label.textContent = t('settings.more_skins_in_app');

    const links = document.createElement('span');
    links.className = 'settings-skin-web-cta-links';

    const appStoreLink = document.createElement('a');
    appStoreLink.href = STORE_URLS.appStore;
    appStoreLink.target = '_blank';
    appStoreLink.rel = 'noopener noreferrer';
    appStoreLink.className = 'store-link';
    appStoreLink.textContent = t('settings.store_app_store');

    const dot = document.createElement('span');
    dot.className = 'store-link-divider';
    dot.textContent = '·';

    const playStoreLink = document.createElement('a');
    playStoreLink.href = STORE_URLS.playStore;
    playStoreLink.target = '_blank';
    playStoreLink.rel = 'noopener noreferrer';
    playStoreLink.className = 'store-link';
    playStoreLink.textContent = t('settings.store_play_store');

    links.append(appStoreLink, dot, playStoreLink);
    row.append(label, links);
    return row;
  }

  private onSkinCardClick(skin: SkinMeta): void {
    const isActive = this.activeSkinId === skin.id;
    const isOwned = this.unlockedBySkin.get(skin.id) === true;
    this.showSkinDetailSheet(skin, { isOwned, isActive });
  }

  private buildSkinCard(skin: SkinMeta, isPromo: boolean): HTMLButtonElement {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'settings-skin-card';
    card.dataset.skin = skin.id;
    if (isPromo) card.dataset.promo = 'true';

    // Mini screen in the skin itself: backdrop, LUDODEX in its wordmark
    // style, a 2×2 patch of real tiles with a diagonal selection + ribbon.
    card.append(buildSkinScreen(skin.id, 'card', 'LUDODEX'));

    const foot = document.createElement('span');
    foot.className = 'settings-skin-foot';
    const name = document.createElement('span');
    name.className = 'settings-skin-name';
    name.textContent = this.getSkinName(skin.id);
    const statusText = document.createElement('span');
    statusText.className = 'settings-skin-status';
    const bar = document.createElement('span');
    bar.className = 'settings-skin-progress';
    bar.append(document.createElement('span'));
    foot.append(name, statusText, bar);
    card.append(foot);
    this.skinStatus.set(skin.id, { text: statusText, bar });

    // Badge indicator — content and type set in refreshSkinCards()
    const badge = document.createElement('span');
    badge.className = 'settings-skin-badge';
    card.append(badge);

    card.addEventListener('click', () => { void this.onSkinCardClick(skin); });

    this.skinButtons.set(skin.id, card);
    this.skinPills.set(skin.id, badge);
    return card;
  }

  private renderPromoSkinBlock(skin: SkinMeta): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'settings-skin-promo-block';

    const divider = document.createElement('div');
    divider.className = 'settings-skin-promo-divider';
    divider.textContent = t('settings.skin_promo_label');

    const card = this.buildSkinCard(skin, true);

    wrap.append(divider, card);
    return wrap;
  }

  private async setSkin(skinId: SkinId): Promise<void> {
    this.activeSkinId = skinId;
    applySkin(skinId);
    await setActiveSkinId(skinId);
    this.refreshSkinCards();
  }

  private async refreshEntitlements(): Promise<void> {
    // isSkinOwned handles all platforms and all unlock paths (achievement + IAP).
    await Promise.all(
      SKINS.map(async (skin) => {
        this.unlockedBySkin.set(skin.id, await isSkinOwned(skin.id));
      })
    );
  }

  private renderRestoreButton(): HTMLElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'settings-restore button-secondary';
    button.textContent = t('settings.restore_purchases');

    if (!this.isNative) {
      button.hidden = true;
      return button;
    }

    button.addEventListener('click', () => {
      void (async () => {
        track('iap_restore_tapped');
        this.status.textContent = t('settings.restoring_purchases');
        try {
          await restorePurchases();
          await this.refreshEntitlements();
          const owned: string[] = [];
          for (const s of SKINS) {
            if (s.productId && this.unlockedBySkin.get(s.id)) owned.push(s.productId);
          }
          setPaidStatus(owned.length > 0, owned);
          this.refreshSkinCards();
          this.status.textContent = '';
        } catch {
          this.status.textContent = t('settings.restore_failed');
        }
      })();
    });
    return button;
  }

  private renderAboutSection(): HTMLElement {
    const section = document.createElement('section');
    section.className = 'settings-section settings-about';

    const heading = document.createElement('h3');
    heading.className = 'settings-section-heading';
    heading.textContent = t('settings.section_about');

    const version = document.createElement('span');
    version.className = 'settings-about-version';
    version.textContent = t('settings.version', { version: import.meta.env.VITE_APP_VERSION ?? '0.1.0' });

    const credit = document.createElement('span');
    credit.className = 'settings-about-credit';
    credit.textContent = t('settings.about_credit');

    // Privacy / Terms / About row
    const linksRow = document.createElement('div');
    linksRow.className = 'settings-legal-links';

    const privacyLink = document.createElement('a');
    privacyLink.href = LEGAL_URLS.privacy;
    privacyLink.target = '_blank';
    privacyLink.rel = 'noopener noreferrer';
    privacyLink.className = 'legal-link';
    privacyLink.textContent = t('settings.privacy_policy');

    const dot = document.createElement('span');
    dot.className = 'legal-link-divider';
    dot.textContent = '·';

    const termsLink = document.createElement('a');
    termsLink.href = LEGAL_URLS.terms;
    termsLink.target = '_blank';
    termsLink.rel = 'noopener noreferrer';
    termsLink.className = 'legal-link';
    termsLink.textContent = t('settings.terms_of_service');

    linksRow.append(privacyLink, dot, termsLink);
    const aboutSection = document.createElement('div');
    aboutSection.className = 'settings-about-section';
    aboutSection.append(linksRow);

    section.append(heading, version, credit, aboutSection);
    // EEA/UK (UMP): players must be able to revisit their ad consent.
    if (this.isNative && isAdPrivacyOptionsRequired()) {
      const privacy = document.createElement('button');
      privacy.type = 'button';
      privacy.className = 'settings-reset-button button-tertiary';
      privacy.textContent = t('settings.ad_privacy');
      privacy.addEventListener('click', () => void showAdPrivacyOptions());
      section.append(privacy);
    }
    section.append(this.renderResetButton());
    return section;
  }

  private refreshLanguageButtons(): void {
    const current = getLang();
    for (const [lang, button] of this.languageButtons) {
      button.dataset.active = String(lang === current);
    }
  }

  private refreshSkinCards(): void {
    for (const skin of SKINS) {
      const button = this.skinButtons.get(skin.id);
      const badge = this.skinPills.get(skin.id);
      if (!button || !badge) continue;

      const isActive = this.activeSkinId === skin.id;
      const isUnlocked = this.unlockedBySkin.get(skin.id) === true;
      button.dataset.active = String(isActive);
      button.dataset.locked = String(!isUnlocked);

      // Sort into its group (registry order is preserved by appending in order).
      if (button.dataset.promo !== 'true') {
        const group: SkinGroup = isUnlocked ? 'owned' : skin.unlockedByAchievement ? 'earn' : 'buy';
        this.skinGroups.get(group)?.cards.append(button);
      }

      // Status line: in use / unlock progress / price.
      const status = this.skinStatus.get(skin.id);
      if (status) {
        const progress = skin.unlockedByAchievement ? this.unlockProgress.get(skin.unlockedByAchievement) : undefined;
        status.bar.hidden = true;
        if (isActive) {
          status.text.textContent = `✓ ${t('settings.skin_active')}`;
        } else if (!isUnlocked && progress) {
          status.text.textContent = t(`settings.skin_progress_${progress.kind}` as StringKey, { n: progress.n, total: progress.total });
          status.bar.hidden = false;
          (status.bar.firstElementChild as HTMLElement).style.width = `${(progress.n / progress.total) * 100}%`;
        } else if (!isUnlocked && this.isNative && skin.productId) {
          status.text.textContent = this.getPriceLabel(skin.id);
        } else {
          status.text.textContent = '';
        }
      }

      if (isActive) {
        badge.replaceChildren();
        badge.dataset.type = '';
      } else if (!isUnlocked && skin.unlockedByAchievement) {
        // Achievement-gated: trophy icon badge
        badge.replaceChildren(createIcon('trophy'));
        badge.dataset.type = 'achievement';
      } else if (!isUnlocked && this.isNative && skin.productId) {
        // IAP-only on native: lock icon badge
        badge.replaceChildren(createIcon('lock'));
        badge.dataset.type = 'iap';
      } else {
        badge.replaceChildren();
        badge.dataset.type = '';
      }
    }
    for (const { wrap, cards } of this.skinGroups.values()) {
      wrap.hidden = cards.childElementCount === 0;
    }
  }

  private getPriceLabel(skinId: SkinId): string {
    if (skinId === 'void') return '';
    return '$0.99';
  }

  private getSkinName(skinId: SkinId): string {
    if (skinId === 'void') return t('skin.void.name');
    if (skinId === 'gameboy') return t('skin.gameboy.name');
    // Test skins (and any future skin without an i18n entry) fall back to the
    // human-readable name in the registry.
    return SKINS.find((s) => s.id === skinId)?.name ?? skinId;
  }

  private normalizeSkinId(value: string): SkinId {
    return normalizeRegistrySkinId(value);
  }

  /** Player-facing reset: clears stats/streaks/achievements, keeps hints. */
  private renderResetButton(): HTMLElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'settings-reset-button button-tertiary';
    button.textContent = t('settings.reset_stats');
    button.addEventListener('click', () => {
      void (async () => {
        const confirmed = await showConfirmModal({
          title: t('dialog.reset_progress_title'),
          body: t('dialog.reset_progress_body'),
          confirmLabel: t('dialog.reset_progress_confirm'),
          cancelLabel: t('common.cancel'),
          destructive: true
        });
        if (!confirmed) return;
        await resetAllProgress({ keepHints: true });
        // An earned skin that just re-locked can't stay active.
        if (!(await isSkinOwned(this.activeSkinId))) await setActiveSkinId('void');
        window.location.reload();
      })();
    });
    return button;
  }
}
