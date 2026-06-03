import { Capacitor } from '@capacitor/core';
import { getLang, setLang, t, type Language } from '../i18n';
import {
  applySkin,
  getCurrentSkinId,
  normalizeSkinId as normalizeRegistrySkinId,
  SKINS,
  type SkinId,
  type SkinMeta
} from '../skins/registry';
import { isSkinOwned, purchase, restorePurchases } from '../services/IAPService';
import { track, updateLocale, setPaidStatus } from '../services/AnalyticsService';
import { getActiveSkinId, resetAllProgress, setActiveSkinId } from '../services/ProgressService';
import { getMonetizationContext } from '../services/MonetizationContext';
import {
  isDailyNotificationEnabled,
  enableDailyNotification,
  disableDailyNotification
} from '../services/NotificationService';
import { LEGAL_URLS, STORE_URLS } from '../config/legalUrls';
import { showConfirmModal } from '../components/Modal';

const context = getMonetizationContext();

export class SettingsView {
  public readonly element: HTMLDivElement;

  private readonly status: HTMLParagraphElement;
  private readonly languageButtons = new Map<Language, HTMLButtonElement>();
  private readonly reminderButtons = new Map<boolean, HTMLButtonElement>();
  private readonly skinButtons = new Map<SkinId, HTMLButtonElement>();
  private readonly skinPills = new Map<SkinId, HTMLSpanElement>();
  private readonly unlockedBySkin = new Map<SkinId, boolean>();
  private activeSkinId: SkinId = getCurrentSkinId(); // DOM read — correct since main.ts applies skin before routing
  private readonly isNative = Capacitor.isNativePlatform();

  // --- Skin preview state machine ---
  private previewingSkinId: SkinId | null = null;
  private skinIdBeforePreview: SkinId | null = null;
  private previewBanner: HTMLElement | null = null;

  private async enterPreview(skinId: SkinId): Promise<void> {
    if (this.previewingSkinId === skinId) return;

    if (this.previewingSkinId === null) {
      // First entry into preview — record what to revert to.
      this.skinIdBeforePreview = this.activeSkinId;
    }

    this.previewingSkinId = skinId;
    applySkin(skinId);
    track('skin_preview_entered', { skin_id: skinId });
    this.renderPreviewBanner();
  }

  private async exitPreview(): Promise<void> {
    if (this.previewingSkinId === null) return;

    const cancelledSkin = this.previewingSkinId;
    const revertTo = this.skinIdBeforePreview ?? 'void';
    this.previewingSkinId = null;
    this.skinIdBeforePreview = null;
    applySkin(revertTo);

    if (this.previewBanner) {
      this.previewBanner.remove();
      this.previewBanner = null;
    }

    track('skin_preview_cancelled', { skin_id: cancelledSkin });
  }

  private async commitPreview(): Promise<void> {
    if (this.previewingSkinId === null) return;

    const purchased = this.previewingSkinId;
    this.previewingSkinId = null;
    this.skinIdBeforePreview = null;

    // The applySkin call already happened during enterPreview; just persist it as active.
    this.activeSkinId = purchased;
    await setActiveSkinId(purchased);

    if (this.previewBanner) {
      this.previewBanner.remove();
      this.previewBanner = null;
    }

    this.refreshSkinCards();
  }

  private renderPreviewBanner(): void {
    if (this.previewBanner) {
      this.previewBanner.remove();
      this.previewBanner = null;
    }
    if (this.previewingSkinId === null) return;

    const skin = SKINS.find((s) => s.id === this.previewingSkinId);
    if (!skin) return;

    const banner = document.createElement('div');
    banner.className = 'skin-preview-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-live', 'polite');

    const text = document.createElement('div');
    text.className = 'skin-preview-banner-text';
    text.textContent = t('settings.skin_preview_banner_title', { name: this.getSkinName(skin.id) });

    const actions = document.createElement('div');
    actions.className = 'skin-preview-banner-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'skin-preview-banner-cancel button-secondary';
    cancelBtn.textContent = t('common.cancel');
    cancelBtn.addEventListener('click', () => {
      void this.exitPreview();
    });

    if (this.isNative && skin.productId) {
      const buyBtn = document.createElement('button');
      buyBtn.type = 'button';
      buyBtn.className = 'skin-preview-banner-buy button-primary';
      buyBtn.textContent = `${t('settings.skin_unlock')} ${this.getPriceLabel(skin.id)}`;
      buyBtn.addEventListener('click', () => {
        void this.attemptPurchaseFromPreview(skin);
      });
      actions.append(buyBtn, cancelBtn);
    } else {
      actions.append(cancelBtn);
    }

    banner.append(text, actions);
    document.body.append(banner);
    this.previewBanner = banner;
  }

  private async attemptPurchaseFromPreview(skin: SkinMeta): Promise<void> {
    if (!skin.productId) return;

    track('skin_preview_buy_tapped', { skin_id: skin.id, product_id: skin.productId });
    this.status.textContent = t('settings.purchase_in_progress', { name: this.getSkinName(skin.id) });

    try {
      const result = await purchase(skin.productId, 'skin_preview');

      // Refresh entitlements regardless — isSkinOwned will check IAP + achievement + bundle.
      await this.refreshEntitlements();

      if (this.unlockedBySkin.get(skin.id)) {
        const owned: string[] = [];
        for (const s of SKINS) {
          if (s.productId && this.unlockedBySkin.get(s.id)) owned.push(s.productId);
        }
        setPaidStatus(owned.length > 0, owned);
        await this.commitPreview();
        this.status.textContent = '';
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
    private readonly onLanguageChange: () => void
  ) {
    this.element = document.createElement('div');
    this.element.className = 'view settings-view';

    for (const skin of SKINS) {
      // Optimistic initial state: free on web (all skins), or free if no productId.
      // refreshEntitlements() (called in bootstrap()) will correct native state via isSkinOwned().
      this.unlockedBySkin.set(skin.id, skin.productId === null || !context.isNative);
    }

    this.status = document.createElement('p');
    this.status.className = 'skin-status';
    this.status.textContent = '';

    this.element.append(
      this.renderTopBar(),
      this.renderLanguageSection(),
      // Daily reminder is native-only (no web push surface).
      ...(this.isNative ? [this.renderNotificationSection()] : []),
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
    await this.refreshEntitlements();
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
      void (async () => {
        if (this.previewingSkinId !== null) {
          await this.exitPreview();
        }
        this.onBack();
      })();
    });

    const title = document.createElement('h2');
    title.className = 'view-topbar-title';
    title.textContent = t('settings.title');

    const spacer = document.createElement('span');
    spacer.style.width = '56px';

    bar.append(back, title, spacer);
    return bar;
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

  private renderSkinSection(): HTMLElement {
    const section = document.createElement('section');
    section.className = 'settings-section';

    const heading = document.createElement('h3');
    heading.className = 'settings-section-heading';
    heading.textContent = t('settings.section_skin');

    const cards = document.createElement('div');
    cards.className = 'settings-skin-cards';

    for (const skin of SKINS) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'settings-skin-card';
      card.dataset.skin = skin.id;

      const left = document.createElement('span');
      left.className = 'settings-skin-left';

      // Two-tile preview scoped inside a div carrying the skin's CSS class.
      // CSS custom properties cascade normally into children, so all --tile-
      // and --tile-selected-* values resolve from the skin stylesheet.
      // Left tile = unselected state, right tile = selected state.
      const skinScope = document.createElement('div');
      skinScope.className = `settings-skin-preview-scope skin-${skin.id}`;

      const tileDefault = document.createElement('span');
      tileDefault.className = 'settings-skin-tile settings-skin-tile--default';
      tileDefault.textContent = 'A';

      const tileSelected = document.createElement('span');
      tileSelected.className = 'settings-skin-tile settings-skin-tile--selected';
      tileSelected.textContent = 'A';

      skinScope.append(tileDefault, tileSelected);
      left.append(skinScope);

      const name = document.createElement('span');
      name.className = 'settings-skin-name';
      name.textContent = this.getSkinName(skin.id);
      left.append(name);

      card.append(left);

      const pill = document.createElement('span');
      pill.className = 'settings-skin-pill';
      card.append(pill);

      card.addEventListener('click', () => {
        void this.onSkinCardClick(skin);
      });

      this.skinButtons.set(skin.id, card);
      this.skinPills.set(skin.id, pill);
      cards.append(card);
    }

    section.append(heading, cards);

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

  private async onSkinCardClick(skin: SkinMeta): Promise<void> {
    const unlocked = this.unlockedBySkin.get(skin.id) === true;
      if (unlocked) {
        // Owned or free skin: apply immediately, no preview.
        if (this.previewingSkinId !== null) {
          // If we were previewing and the user tapped an owned skin, exit preview cleanly first.
          await this.exitPreview();
        }
        await this.setSkin(skin.id);
        return;
      }

      // Locked skin: enter preview. On native, the banner lets the user Buy. On web, the banner just lets them Cancel (preview is browsing only).
      await this.enterPreview(skin.id);
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
    this.setupResetProgressGesture(version);

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
      const pill = this.skinPills.get(skin.id);
      if (!button || !pill) continue;

      const isActive = this.activeSkinId === skin.id;
      const isUnlocked = this.unlockedBySkin.get(skin.id) === true;
      button.dataset.active = String(isActive);
      button.dataset.locked = String(!isUnlocked);

      if (isActive) {
        pill.textContent = t('settings.skin_active');
      } else if (!isUnlocked && skin.unlockHint) {
        // Achievement-gated skin — show the earn condition on all platforms.
        pill.textContent = t('settings.skin_earn_hint', { hint: skin.unlockHint });
      } else if (this.isNative && !isUnlocked) {
        // IAP-only skin on native — show the price.
        pill.textContent = `${t('settings.skin_unlock')} ${this.getPriceLabel(skin.id)}`;
      } else {
        pill.textContent = '';
      }
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

  // Hidden Reset Progress flow
  private setupResetProgressGesture(target: HTMLElement): void {
    let resetTimeout: number | null = null;

    const resetHandler = async (): Promise<void> => {
      const confirmed = await showConfirmModal({
        title: t('dialog.reset_progress_title'),
        body: t('dialog.reset_progress_body'),
        confirmLabel: t('dialog.reset_progress_confirm'),
        cancelLabel: t('common.cancel'),
        destructive: true
      });

      if (confirmed) {
        await resetAllProgress();
        window.location.reload();
      }
    };

    target.addEventListener('pointerdown', () => {
      resetTimeout = window.setTimeout(resetHandler, 3000); // 3-second long press
    });

    target.addEventListener('pointerup', () => {
      if (resetTimeout !== null) {
        window.clearTimeout(resetTimeout);
        resetTimeout = null;
      }
    });

    target.addEventListener('pointerleave', () => {
      if (resetTimeout !== null) {
        window.clearTimeout(resetTimeout);
        resetTimeout = null;
      }
    });
  }
}
