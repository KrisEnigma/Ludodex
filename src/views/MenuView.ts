import { Capacitor } from '@capacitor/core';
import { applySkin, getCurrentSkinId, SKINS, type SkinId, type SkinMeta } from '../skins/registry';
import { hasEntitlement, purchase, restorePurchases } from '../services/IAPService';
import { setActiveSkinId } from '../services/ProgressService';

export class MenuView {
  readonly element: HTMLDivElement;

  constructor(onPlay: () => void) {
    this.element = document.createElement('div');
    this.element.className = 'view menu-view';

    const subtitle = document.createElement('p');
    subtitle.className = 'view-subtitle';
    subtitle.textContent = 'Main Menu';

    const title = document.createElement('h1');
    title.className = 'view-title';
    title.textContent = 'GlitchSalad';

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
      });
    });

    refreshButtonStates();
    void refreshEntitlements();

    const playButton = document.createElement('button');
    playButton.type = 'button';
    playButton.className = 'action-button';
    playButton.textContent = 'Play Daily Puzzle';
    playButton.addEventListener('click', onPlay);

    this.element.append(subtitle, title, skinLabel, skinPicker, status, restoreButton, playButton);
  }
}
