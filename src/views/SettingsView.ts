import { Capacitor } from '@capacitor/core';
import { getLang, setLang, t, type Language } from '../i18n';
import { applySkin, getCurrentSkinId, SKINS, type SkinId, type SkinMeta } from '../skins/registry';
import { isOwned, purchase, restorePurchases } from '../services/IAPService';
import { getActiveSkinId, resetAllProgress, setActiveSkinId } from '../services/ProgressService';
import { getMonetizationContext } from '../services/MonetizationContext';
import { LEGAL_URLS, STORE_URLS } from '../config/legalUrls';
import { showConfirmModal } from '../components/Modal';

const context = getMonetizationContext();

export class SettingsView {
  public readonly element: HTMLDivElement;

  private readonly status: HTMLParagraphElement;
  private readonly languageButtons = new Map<Language, HTMLButtonElement>();
  private readonly skinButtons = new Map<SkinId, HTMLButtonElement>();
  private readonly skinPills = new Map<SkinId, HTMLSpanElement>();
  private readonly unlockedBySkin = new Map<SkinId, boolean>();
  private activeSkinId: SkinId = getCurrentSkinId();
  private readonly isNative = Capacitor.isNativePlatform();

  constructor(
    private readonly onBack: () => void,
    private readonly onLanguageChange: () => void
  ) {
    this.element = document.createElement('div');
    this.element.className = 'view settings-view';

    for (const skin of SKINS) {
      this.unlockedBySkin.set(skin.id, skin.productId === null || !this.isNative);
    }

    this.status = document.createElement('p');
    this.status.className = 'skin-status';
    this.status.textContent = '';

    this.element.append(
      this.renderTopBar(),
      this.renderLanguageSection(),
      this.renderSkinSection(),
      this.renderRestoreButton(),
      this.status,
      this.renderAboutSection()
    );

    void this.bootstrap();
  }

  private async bootstrap(): Promise<void> {
    this.activeSkinId = this.normalizeSkinId(await getActiveSkinId());
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
    back.addEventListener('click', this.onBack);

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
    await setLang(lang);
    this.onLanguageChange();
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

      const name = document.createElement('span');
      name.className = 'settings-skin-name';
      name.textContent = this.getSkinName(skin.id);

      const preview = document.createElement('span');
      preview.className = 'settings-skin-preview';
      preview.dataset.skin = skin.id;
      for (let i = 0; i < 3; i += 1) {
        const tile = document.createElement('span');
        tile.className = 'settings-skin-preview-tile';
        tile.dataset.index = String(i + 1);
        preview.append(tile);
      }

      left.append(name, preview);

      const pill = document.createElement('span');
      pill.className = 'settings-skin-pill';

      card.append(left, pill);
      card.addEventListener('click', () => {
        void this.onSkinCardClick(skin);
      });

      this.skinButtons.set(skin.id, card);
      this.skinPills.set(skin.id, pill);
      cards.append(card);
    }

    section.append(heading, cards);
    return section;
  }

  private async onSkinCardClick(skin: SkinMeta): Promise<void> {
    const unlocked = this.unlockedBySkin.get(skin.id) === true;
    if (unlocked) {
      await this.setSkin(skin.id);
      return;
    }

    if (!this.isNative || !skin.productId) {
      return;
    }

    this.status.textContent = t('settings.purchase_in_progress', { name: this.getSkinName(skin.id) });
    try {
      const result = await purchase(skin.productId);
      const purchased = result.status === 'success';
      if (!purchased && skin.bundleProductId) {
        const bundleUnlocked = await isOwned(skin.bundleProductId);
        this.unlockedBySkin.set(skin.id, bundleUnlocked);
      } else {
        this.unlockedBySkin.set(skin.id, purchased);
      }

      await this.refreshEntitlements();
      if (this.unlockedBySkin.get(skin.id)) {
        await this.setSkin(skin.id);
        this.status.textContent = '';
      } else {
        this.status.textContent = t('settings.purchase_not_unlocked');
      }
    } catch {
      this.status.textContent = t('settings.purchase_cancelled_or_unavailable');
    }

    this.refreshSkinCards();
  }

  private async setSkin(skinId: SkinId): Promise<void> {
    this.activeSkinId = skinId;
    applySkin(skinId);
    await setActiveSkinId(skinId);
    this.refreshSkinCards();
  }

  private async refreshEntitlements(): Promise<void> {
    if (!this.isNative) {
      for (const skin of SKINS) {
        this.unlockedBySkin.set(skin.id, true);
      }
      return;
    }

    await Promise.all(
      SKINS.map(async (skin) => {
        if (!skin.productId) {
          this.unlockedBySkin.set(skin.id, true);
          return;
        }
        let unlocked = await isOwned(skin.productId);
        if (!unlocked && skin.bundleProductId) {
          unlocked = await isOwned(skin.bundleProductId);
        }
        this.unlockedBySkin.set(skin.id, unlocked);
      })
    );
  }

  private renderRestoreButton(): HTMLElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'action-button secondary-button settings-restore';
    button.textContent = t('settings.restore_purchases');

    if (!this.isNative) {
      button.hidden = true;
      return button;
    }

    button.addEventListener('click', () => {
      void (async () => {
        this.status.textContent = t('settings.restoring_purchases');
        try {
          await restorePurchases();
          await this.refreshEntitlements();
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
      } else if (!this.isNative && skin.id !== 'void') {
        pill.textContent = t('settings.web_only_skin_label');
      } else if (!isUnlocked) {
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
    if (skinId === 'synthwave') return t('skin.synthwave.name');
    return t('skin.gameboy.name');
  }

  private normalizeSkinId(value: string): SkinId {
    if (value === 'void' || value === 'synthwave' || value === 'gameboy') {
      return value;
    }
    return 'void';
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
