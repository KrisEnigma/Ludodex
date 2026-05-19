import { Capacitor } from '@capacitor/core';
import { ensureBundledPuzzlesLoaded, getDailyPuzzleIndex, getPuzzleAtIndex } from '../game/PuzzleLoader';
import { applySkin, getCurrentSkinId, SKINS, type SkinId, type SkinMeta } from '../skins/registry';
import { hasEntitlement, purchase, restorePurchases } from '../services/IAPService';
import { getProgressSnapshot, setActiveSkinId } from '../services/ProgressService';
import { t } from '../utils/i18n';

export class MenuView {
  readonly element: HTMLDivElement;

  constructor(onPlay: () => void) {
    const puzzles = ensureBundledPuzzlesLoaded();
    const dailyIndex = getDailyPuzzleIndex(puzzles);
    const dailyPuzzle = getPuzzleAtIndex(dailyIndex, puzzles);
    const dayNumber = dailyIndex + 1;
    const puzzleTitle = t(dailyPuzzle.name, dailyPuzzle.id);

    this.element = document.createElement('div');
    this.element.className = 'view menu-view';
    const root = this.element;

    const topBar = document.createElement('div');
    topBar.className = 'menu-top-bar';

    const dayChip = document.createElement('span');
    dayChip.className = 'menu-day-chip';
    dayChip.textContent = `Day ${dayNumber}`;

    const settingsButton = document.createElement('button');
    settingsButton.type = 'button';
    settingsButton.className = 'menu-icon-button';
    settingsButton.textContent = '⚙';
    settingsButton.setAttribute('aria-label', 'Settings');

    topBar.append(dayChip, settingsButton);

    const logo = document.createElement('div');
    logo.className = 'menu-logo';

    const logoTop = document.createElement('span');
    logoTop.className = 'menu-logo-top';
    logoTop.textContent = 'GLITCH';

    const logoBottom = document.createElement('span');
    logoBottom.className = 'menu-logo-bottom';
    logoBottom.textContent = 'SALAD';

    logo.append(logoTop, logoBottom);

    const divider = document.createElement('div');
    divider.className = 'menu-divider';

    const statsStrip = document.createElement('div');
    statsStrip.className = 'stats-strip';

    const streakCard = document.createElement('div');
    streakCard.className = 'stat-card';
    streakCard.dataset.highlight = 'true';
    const streakValue = document.createElement('span');
    streakValue.className = 'stat-value';
    streakValue.textContent = '0';
    const streakLabel = document.createElement('span');
    streakLabel.className = 'stat-label';
    streakLabel.textContent = 'Streak';
    streakCard.append(streakValue, streakLabel);

    const solvedCard = document.createElement('div');
    solvedCard.className = 'stat-card';
    const solvedValue = document.createElement('span');
    solvedValue.className = 'stat-value';
    solvedValue.textContent = '0';
    const solvedLabel = document.createElement('span');
    solvedLabel.className = 'stat-label';
    solvedLabel.textContent = 'Solved';
    solvedCard.append(solvedValue, solvedLabel);

    const bestCard = document.createElement('div');
    bestCard.className = 'stat-card';
    const bestValue = document.createElement('span');
    bestValue.className = 'stat-value';
    bestValue.textContent = '--';
    const bestLabel = document.createElement('span');
    bestLabel.className = 'stat-label';
    bestLabel.textContent = 'Best';
    bestCard.append(bestValue, bestLabel);

    statsStrip.append(streakCard, solvedCard, bestCard);

    const dailyCard = document.createElement('div');
    dailyCard.className = 'daily-card';

    const dailyCardHead = document.createElement('div');
    dailyCardHead.className = 'daily-card-head';

    const dailyTag = document.createElement('span');
    dailyTag.className = 'daily-card-tag';
    dailyTag.textContent = 'Today';

    const countdownEl = document.createElement('span');
    countdownEl.className = 'daily-card-countdown';
    countdownEl.textContent = `Next in ${this.formatTimeUntilMidnight()}`;

    dailyCardHead.append(dailyTag, countdownEl);

    const dailyTitle = document.createElement('h2');
    dailyTitle.className = 'daily-card-title';
    dailyTitle.textContent = puzzleTitle;

    const dailyMeta = document.createElement('p');
    dailyMeta.className = 'daily-card-meta';
    dailyMeta.textContent = `${dailyPuzzle.category} · ${dailyPuzzle.difficulty}`;

    const dailyPlayButton = document.createElement('button');
    dailyPlayButton.type = 'button';
    dailyPlayButton.className = 'daily-play-button';
    dailyPlayButton.textContent = '▶ Play';
    dailyPlayButton.addEventListener('click', (event) => {
      event.stopPropagation();
      onPlay();
    });

    dailyCard.addEventListener('click', () => {
      onPlay();
    });
    dailyCard.append(dailyCardHead, dailyTitle, dailyMeta, dailyPlayButton);

    const footerActions = document.createElement('div');
    footerActions.className = 'menu-footer-actions';

    const archiveButton = document.createElement('button');
    archiveButton.type = 'button';
    archiveButton.className = 'menu-footer-action';
    archiveButton.textContent = 'Archive';

    const howToPlayButton = document.createElement('button');
    howToPlayButton.type = 'button';
    howToPlayButton.className = 'menu-footer-action';
    howToPlayButton.textContent = 'How to play';

    footerActions.append(archiveButton, howToPlayButton);

    const settingsPanel = document.createElement('div');
    settingsPanel.className = 'settings-panel';
    settingsPanel.hidden = true;

    const skinLabel = document.createElement('p');
    skinLabel.className = 'view-subtitle';
    skinLabel.textContent = 'Choose a skin';

    const status = document.createElement('p');
    status.className = 'skin-status';
    status.textContent = '';

    const skinPicker = document.createElement('div');
    skinPicker.className = 'skin-picker';

    let activeSkinId = getCurrentSkinId();
    const skinButtons = new Map<SkinId, HTMLButtonElement>();
    const skinNames = new Map<SkinId, HTMLSpanElement>();
    const skinBadges = new Map<SkinId, HTMLSpanElement>();
    const unlockedBySkin = new Map<SkinId, boolean>();

    for (const skin of SKINS) {
      unlockedBySkin.set(skin.id, skin.productId === null);
    }

    const isNative = Capacitor.isNativePlatform();
    if (!isNative) {
      for (const skin of SKINS) {
        unlockedBySkin.set(skin.id, true);
      }
    }

    const refreshButtonStates = (): void => {
      for (const skin of SKINS) {
        const button = skinButtons.get(skin.id);
        if (!button) continue;

        const unlocked = unlockedBySkin.get(skin.id) === true;
        const active = activeSkinId === skin.id;
        const nameLabel = skinNames.get(skin.id);
        const badgeLabel = skinBadges.get(skin.id);
        if (!nameLabel || !badgeLabel) continue;

        button.dataset.active = String(active);
        button.dataset.locked = String(!unlocked);

        nameLabel.textContent = skin.name;
        if (skin.productId === null) {
          badgeLabel.textContent = 'FREE';
          badgeLabel.dataset.kind = 'free';
        } else if (unlocked) {
          badgeLabel.textContent = 'OWNED';
          badgeLabel.dataset.kind = 'owned';
        } else {
          badgeLabel.textContent = 'LOCKED';
          badgeLabel.dataset.kind = 'locked';
        }
      }
    };

    const refreshEntitlements = async (): Promise<void> => {
      if (!isNative) return;

      await Promise.all(
        SKINS.map(async (skin) => {
          if (!skin.productId) {
            unlockedBySkin.set(skin.id, true);
            return;
          }

          let unlocked = await hasEntitlement(skin.productId);
          if (!unlocked && skin.bundleProductId) {
            unlocked = await hasEntitlement(skin.bundleProductId);
          }

          unlockedBySkin.set(skin.id, unlocked);
        })
      );

      refreshButtonStates();
    };

    const setSkin = async (skinId: SkinId): Promise<void> => {
      activeSkinId = skinId;
      applySkin(skinId);
      await setActiveSkinId(skinId);
      refreshButtonStates();
    };

    const tryUnlockSkin = async (skin: SkinMeta): Promise<boolean> => {
      if (!isNative || !skin.productId) return false;

      status.textContent = `Purchasing ${skin.name}...`;
      try {
        const purchased = await purchase(skin.productId);
        if (!purchased && skin.bundleProductId) {
          const bundleUnlocked = await hasEntitlement(skin.bundleProductId);
          if (bundleUnlocked) {
            await refreshEntitlements();
            status.textContent = '';
            return true;
          }
        }

        if (purchased) {
          await refreshEntitlements();
          status.textContent = '';
          return true;
        }

        status.textContent = 'Purchase did not unlock skin';
        return false;
      } catch {
        status.textContent = 'Purchase cancelled or unavailable';
        return false;
      }
    };

    for (const skin of SKINS) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'skin-button';
      button.dataset.active = String(skin.id === activeSkinId);
      button.dataset.locked = 'false';

      const name = document.createElement('span');
      name.className = 'skin-name';

      const badge = document.createElement('span');
      badge.className = 'skin-badge';

      button.append(name, badge);
      button.addEventListener('click', () => {
        void (async () => {
          const unlocked = unlockedBySkin.get(skin.id) === true;
          if (unlocked) {
            await setSkin(skin.id);
            status.textContent = '';
            return;
          }

          const unlockedNow = await tryUnlockSkin(skin);
          if (unlockedNow) {
            await setSkin(skin.id);
          }
        })();
      });

      skinButtons.set(skin.id, button);
      skinNames.set(skin.id, name);
      skinBadges.set(skin.id, badge);
      skinPicker.append(button);
    }

    const restoreButton = document.createElement('button');
    restoreButton.type = 'button';
    restoreButton.className = 'action-button secondary-button';
    restoreButton.textContent = 'Restore Purchases';
    restoreButton.addEventListener('click', () => {
      void (async () => {
        if (!isNative) {
          status.textContent = 'Restore available on device builds';
          return;
        }

        status.textContent = 'Restoring purchases...';
        try {
          await restorePurchases();
          await refreshEntitlements();
          status.textContent = '';
        } catch {
          status.textContent = 'Restore failed';
        }
      })();
    });

    settingsButton.addEventListener('click', () => {
      settingsPanel.hidden = !settingsPanel.hidden;
    });

    const countdownIntervalId = window.setInterval(() => {
      if (!root.isConnected) {
        window.clearInterval(countdownIntervalId);
        return;
      }
      countdownEl.textContent = `Next in ${this.formatTimeUntilMidnight()}`;
    }, 60_000);

    refreshButtonStates();
    void refreshEntitlements();

    void (async () => {
      const snapshot = await getProgressSnapshot();
      if (!root.isConnected) return;
      streakValue.textContent = String(snapshot.currentStreak);
      solvedValue.textContent = String(snapshot.solvedCount);
      bestValue.textContent = snapshot.bestTimeSec === null ? '--' : this.formatElapsed(snapshot.bestTimeSec);
    })();

    settingsPanel.append(skinLabel, skinPicker, status, restoreButton);

    this.element.append(topBar, logo, divider, statsStrip, dailyCard, footerActions, settingsPanel);
  }

  private formatElapsed(totalSeconds: number): string {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  private formatTimeUntilMidnight(): string {
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const totalMinutes = Math.max(0, Math.floor((tomorrow.getTime() - now.getTime()) / 60000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
  }
}
