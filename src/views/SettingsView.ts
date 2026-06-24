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
import { isSkinOwned, purchase, restorePurchases, getVisibleSkins } from '../services/IAPService';
import { track, updateLocale, setPaidStatus } from '../services/AnalyticsService';
import { getActiveSkinId, resetAllProgress, setActiveSkinId } from '../services/ProgressService';
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

    // Mini game preview — scoped skin class re-anchors all derived CSS vars
    // locally via @scope in skins.css (no root mutation).
    const previewScope = document.createElement('div');
    previewScope.className = `skin-detail-preview-scope skin-${skin.id}`;

    // Skin name in the wordmark font
    const previewTitle = document.createElement('div');
    previewTitle.className = 'skin-detail-preview-title';
    previewTitle.textContent = this.getSkinName(skin.id).toUpperCase();

    // 4×4 mini game grid with SVG trail overlay.
    // Path spells W→O→R→D→S across the grid so selected tiles + trail
    // both render in the skin's colors.
    const TILE_SIZE = 42;
    const GAP = 6;
    const STRIDE = TILE_SIZE + GAP;   // 48
    const GRID_PX = 4 * TILE_SIZE + 3 * GAP; // 186

    // Path includes diagonals: W→O→R→D diagonal run, then S→A turn
    const pathCells: [number, number][] = [[0, 0], [1, 1], [2, 2], [3, 3], [3, 2], [2, 1]];
    const selectedSet = new Set(pathCells.map(([r, c]) => `${r},${c}`));
    const letters = ['W', 'G', 'T', 'L', 'P', 'O', 'E', 'B', 'M', 'A', 'R', 'F', 'C', 'N', 'S', 'D'];

    const gridWrap = document.createElement('div');
    gridWrap.className = 'skin-detail-preview-grid-wrap';

    const grid = document.createElement('div');
    grid.className = 'skin-detail-preview-grid';
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const tile = document.createElement('span');
        const sel = selectedSet.has(`${r},${c}`);
        tile.className = `settings-skin-tile ${sel ? 'settings-skin-tile--selected' : 'settings-skin-tile--default'}`;
        // Letter in a child span — mirrors the game's .tile / .tile-letter pattern
        // so the trail SVG (z-index 10) renders above tile backgrounds while the
        // letter (z-index 20) stays above the trail. The tile itself must NOT have
        // z-index or it would form a stacking context and trap the letter inside it.
        const letter = document.createElement('span');
        letter.className = 'skin-detail-preview-letter';
        letter.textContent = letters[r * 4 + c];
        tile.append(letter);
        grid.append(tile);
      }
    }

    // SVG trail: one <line> per segment, --seg-t drives the gradient tint.
    // Uses skin-detail-preview-path (not path-overlay) to avoid the z-index:10
    // that would cover tile letters.
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'skin-detail-preview-path');
    svg.setAttribute('viewBox', `0 0 ${GRID_PX} ${GRID_PX}`);
    svg.setAttribute('aria-hidden', 'true');
    const segGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    segGroup.setAttribute('class', 'path-segments');
    const numSeg = pathCells.length - 1;
    for (let i = 0; i < numSeg; i++) {
      const [r1, c1] = pathCells[i];
      const [r2, c2] = pathCells[i + 1];
      const ln = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      ln.setAttribute('class', 'path-seg');
      ln.setAttribute('x1', String(c1 * STRIDE + TILE_SIZE / 2));
      ln.setAttribute('y1', String(r1 * STRIDE + TILE_SIZE / 2));
      ln.setAttribute('x2', String(c2 * STRIDE + TILE_SIZE / 2));
      ln.setAttribute('y2', String(r2 * STRIDE + TILE_SIZE / 2));
      ln.style.setProperty('--seg-t', String(numSeg > 1 ? i / (numSeg - 1) : 0));
      segGroup.append(ln);
    }
    svg.append(segGroup);
    gridWrap.append(grid, svg);
    previewScope.append(previewTitle, gridWrap);

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
          void this.setSkin(skin.id).then(() => this.closeSkinDetailSheet());
        });
      actions.append(useBtn);
    } else {
      // Locked — show how to unlock
      if (skin.unlockHint) {
        const earnRow = document.createElement('div');
        earnRow.className = 'skin-detail-earn-row';
        earnRow.textContent = t('settings.skin_earn_hint', { hint: skin.unlockHint });
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
      // Optimistic initial state — refreshEntitlements() corrects this async.
      // Native: free skins only. Web (incl. dev sim): web-available skins only.
      this.unlockedBySkin.set(skin.id, context.isNative ? skin.productId === null : isWebAvailable(skin.id));
    }

    this.status = document.createElement('p');
    this.status.className = 'skin-status';
    this.status.textContent = '';

    this.element.append(
      this.renderTopBar(),
      this.renderLanguageSection(),
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
    console.log('[IconClick] clicked:', iconId, 'activeIconId:', this.activeIconId);
    if (this.activeIconId === iconId) {
      console.log('[IconClick] same icon, skipping');
      return;
    }

    const previousIconId = this.activeIconId;
    this.activeIconId = iconId;
    this.refreshIconButtons();
    console.log('[IconClick] set UI state optimistically before native dialog');

    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    this.status.textContent = 'Changing icon...';
    try {
      await setActiveIcon(iconId);
      this.status.textContent = '';
      console.log('[IconClick] done');
    } catch (e: any) {
      console.error('[IconClick] setActiveIcon threw:', e);
      // Probe native state before rolling back — sometimes native succeeds despite a JS rejection.
      try {
        const native = await getActiveIcon();
        console.log('[IconClick] getActiveIcon after failure returned:', native);
        if (native === iconId) {
          console.log('[IconClick] native equals requested icon despite error — keeping UI state');
          this.status.textContent = '';
          return;
        }
      } catch (probeErr) {
        console.error('[IconClick] getActiveIcon probe failed:', probeErr);
      }

      this.activeIconId = previousIconId;
      this.refreshIconButtons();
      this.status.textContent = `Failed to change icon: ${e?.message || e}`;
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

    const cards = document.createElement('div');
    cards.className = 'settings-skin-cards';

    const visible = getVisibleSkins();
    const regularSkins = !this.isNative ? visible.filter(s => s.id !== PROMO_SKIN_ID) : visible;
    const promoSkin = !this.isNative ? visible.find(s => s.id === PROMO_SKIN_ID) : undefined;

    for (const skin of regularSkins) {
      cards.append(this.buildSkinCard(skin, false));
    }

    section.append(heading, cards);

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

    // Mini tile preview — scoped to this skin's CSS variables
    const skinScope = document.createElement('div');
    skinScope.className = `settings-skin-preview-scope skin-${skin.id}`;

    const tileDefault = document.createElement('span');
    tileDefault.className = 'settings-skin-tile settings-skin-tile--default';
    tileDefault.textContent = 'A';

    const tileSelected = document.createElement('span');
    tileSelected.className = 'settings-skin-tile settings-skin-tile--selected';
    tileSelected.textContent = 'A';

    skinScope.append(tileDefault, tileSelected);
    card.append(skinScope);

    const name = document.createElement('span');
    name.className = 'settings-skin-name';
    name.textContent = this.getSkinName(skin.id);
    card.append(name);

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
      const badge = this.skinPills.get(skin.id);
      if (!button || !badge) continue;

      const isActive = this.activeSkinId === skin.id;
      const isUnlocked = this.unlockedBySkin.get(skin.id) === true;
      button.dataset.active = String(isActive);
      button.dataset.locked = String(!isUnlocked);

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
