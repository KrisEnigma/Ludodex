import Phaser from 'phaser';
import { ALL_SKINS, FONT_FAMILY } from '../skins/registry';
import { hasEntitlement, restorePurchases } from '../services/IAPService';
import { getDailyPuzzle, getDailyPuzzleIndex, getPuzzleAtIndex, getPuzzleCount } from '../game/PuzzleLoader';
import {
  getActiveSkinId,
  getSolvedIds,
  getSolvedTimes,
  getProgressSnapshot,
  setActiveSkinId
} from '../services/ProgressService';

export class MenuScene extends Phaser.Scene {
  skinIds = Object.keys(ALL_SKINS).filter((id) => !['default', 'pixel'].includes(id));
  selectedSkinIndex = 0;
  skinNameText!: Phaser.GameObjects.Text;
  skinStatusText!: Phaser.GameObjects.Text;
  restoreStatusText!: Phaser.GameObjects.Text;
  ownedProductIds = new Set<string>();
  dailyStatusText!: Phaser.GameObjects.Text;
  selectedLevelIndex = 0;
  levelValueText!: Phaser.GameObjects.Text;
  levelMetaText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'MenuScene' });
  }

  async create() {
    console.log('MenuScene create called');

    const activeSkinId = await getActiveSkinId();
    const [snapshot, solvedIds, solvedTimes] = await Promise.all([
      getProgressSnapshot(),
      getSolvedIds(),
      getSolvedTimes()
    ]);
    const initialIndex = this.skinIds.indexOf(activeSkinId);
    this.selectedSkinIndex = initialIndex >= 0 ? initialIndex : 0;
    await this.refreshOwnedSkins();
    this.ensureSelectedSkinIsUnlocked();

    const dailyPuzzle = getDailyPuzzle();
    const totalPuzzles = getPuzzleCount();
    const dailySolved = solvedIds.includes(dailyPuzzle.id);
    const dailyTimeSec = solvedTimes[dailyPuzzle.id];
    const dailyTimeLabel = Number.isFinite(dailyTimeSec)
      ? `${Math.floor(dailyTimeSec / 60)}:${String(dailyTimeSec % 60).padStart(2, '0')}`
      : '--';
    const globalBest = snapshot.bestTimeSec;
    let dailyComparison = '';
    if (dailySolved && Number.isFinite(dailyTimeSec) && Number.isFinite(globalBest)) {
      const delta = (dailyTimeSec as number) - (globalBest as number);
      if (delta <= 0) {
        dailyComparison = ' (new best)';
      } else {
        dailyComparison = ` (+${Math.floor(delta / 60)}:${String(delta % 60).padStart(2, '0')} vs best)`;
      }
    }

    const centerX = 540;
    const statsPanelY = 360;
    const skinPanelY = 820;
    const levelPanelY = 1120;
    const playBtnY = 1335;
    const restoreBtnY = 1440;
    const restoreStatusY = 1510;
    const quickActionsY = 1620;

    this.add.rectangle(centerX, 960, 1080, 1920, 0x0f1218, 1).setOrigin(0.5);
    this.add.rectangle(centerX, statsPanelY, 760, 220, 0x151b26, 1).setStrokeStyle(3, 0x2e3a52).setOrigin(0.5);

    this.add.text(centerX, 270, 'GlitchSalad', {
      color: '#ffffff',
      fontFamily: FONT_FAMILY,
      fontSize: '72px'
    }).setOrigin(0.5);

    this.add.text(centerX, 355, `Solved ${snapshot.solvedCount}  •  Streak ${snapshot.currentStreak}`, {
      color: '#9db0cf',
      fontFamily: FONT_FAMILY,
      fontSize: '24px'
    }).setOrigin(0.5);

    const best = snapshot.bestTimeSec === null
      ? '--'
      : `${Math.floor(snapshot.bestTimeSec / 60)}:${String(snapshot.bestTimeSec % 60).padStart(2, '0')}`;
    this.add.text(centerX, 395, `Best Time ${best}  •  Best Streak ${snapshot.bestStreak}`, {
      color: '#9db0cf',
      fontFamily: FONT_FAMILY,
      fontSize: '24px'
    }).setOrigin(0.5);

    this.dailyStatusText = this.add.text(
      centerX,
      442,
      dailySolved
        ? `Daily solved in ${dailyTimeLabel}${dailyComparison}`
        : 'Daily puzzle not solved yet',
      {
        color: dailySolved ? '#8fd7b1' : '#d2d9e6',
        fontFamily: FONT_FAMILY,
        fontSize: '22px'
      }
    ).setOrigin(0.5);

    const solvedSet = new Set(solvedIds);
    this.selectedLevelIndex = getDailyPuzzleIndex();


    this.add.rectangle(centerX, levelPanelY, 760, 200, 0x151b26, 1).setStrokeStyle(3, 0x2e3a52).setOrigin(0.5);
    this.add.text(centerX, levelPanelY - 70, 'Level Selector', {
      color: '#d9e8ff',
      fontFamily: FONT_FAMILY,
      fontSize: '30px'
    }).setOrigin(0.5);

    this.levelValueText = this.add.text(centerX, levelPanelY - 5, '', {
      color: '#ffffff',
      fontFamily: FONT_FAMILY,
      fontSize: '34px'
    }).setOrigin(0.5);

    this.levelMetaText = this.add.text(centerX, levelPanelY + 35, '', {
      color: '#9db0cf',
      fontFamily: FONT_FAMILY,
      fontSize: '22px'
    }).setOrigin(0.5);

    const updateLevelSelectorLabel = () => {
      const levelNumber = this.selectedLevelIndex + 1;
      const puzzle = getPuzzleAtIndex(this.selectedLevelIndex);
      const solved = solvedSet.has(puzzle.id);
      const solvedTimeSec = solvedTimes[puzzle.id];
      const timeLabel = Number.isFinite(solvedTimeSec)
        ? `${Math.floor(solvedTimeSec / 60)}:${String(solvedTimeSec % 60).padStart(2, '0')}`
        : '--';

      this.levelValueText.setText(`Level ${levelNumber} / ${totalPuzzles}`);
      this.levelMetaText.setText(solved ? `Solved in ${timeLabel}` : 'Not solved yet');
      this.levelMetaText.setColor(solved ? '#8fd7b1' : '#d2d9e6');
    };

    this.add.rectangle(centerX, skinPanelY, 760, 230, 0x151b26, 1).setStrokeStyle(3, 0x2e3a52).setOrigin(0.5);
    this.add.text(centerX, skinPanelY - 90, 'Selected Skin', {
      color: '#d9e8ff',
      fontFamily: FONT_FAMILY,
      fontSize: '30px'
    }).setOrigin(0.5);

    this.skinNameText = this.add.text(centerX, skinPanelY, '', {
      color: '#ffffff',
      fontFamily: FONT_FAMILY,
      fontSize: '36px'
    }).setOrigin(0.5);

    this.skinStatusText = this.add.text(centerX, skinPanelY + 40, '', {
      color: '#9db0cf',
      fontFamily: FONT_FAMILY,
      fontSize: '22px'
    }).setOrigin(0.5);

    this.restoreStatusText = this.add.text(centerX, restoreStatusY, '', {
      color: '#9db0cf',
      fontFamily: FONT_FAMILY,
      fontSize: '20px'
    }).setOrigin(0.5);

    this.updateSkinLabel();

    const prevBtn = this.add
      .rectangle(330, skinPanelY, 90, 70, 0x23324a, 1)
      .setStrokeStyle(2, 0x4a90d9)
      .setInteractive({ useHandCursor: true });
    this.add.text(330, skinPanelY, '<', {
      color: '#e6f1ff',
      fontFamily: FONT_FAMILY,
      fontSize: '36px'
    }).setOrigin(0.5);

    const nextSkinBtn = this.add
      .rectangle(750, skinPanelY, 90, 70, 0x23324a, 1)
      .setStrokeStyle(2, 0x4a90d9)
      .setInteractive({ useHandCursor: true });
    this.add.text(750, skinPanelY, '>', {
      color: '#e6f1ff',
      fontFamily: FONT_FAMILY,
      fontSize: '36px'
    }).setOrigin(0.5);

    prevBtn.on('pointerdown', () => {
      this.selectedSkinIndex = (this.selectedSkinIndex - 1 + this.skinIds.length) % this.skinIds.length;
      this.updateSkinLabel();
    });

    nextSkinBtn.on('pointerdown', () => {
      this.selectedSkinIndex = (this.selectedSkinIndex + 1) % this.skinIds.length;
      this.updateSkinLabel();
    });


    const prevLevelBtn = this.add
      .rectangle(330, levelPanelY - 5, 90, 70, 0x23324a, 1)
      .setStrokeStyle(2, 0x4a90d9)
      .setInteractive({ useHandCursor: true });
    this.add.text(330, levelPanelY - 5, '<', {
      color: '#e6f1ff',
      fontFamily: FONT_FAMILY,
      fontSize: '36px'
    }).setOrigin(0.5);

    const nextLevelBtn = this.add
      .rectangle(750, levelPanelY - 5, 90, 70, 0x23324a, 1)
      .setStrokeStyle(2, 0x4a90d9)
      .setInteractive({ useHandCursor: true });
    this.add.text(750, levelPanelY - 5, '>', {
      color: '#e6f1ff',
      fontFamily: FONT_FAMILY,
      fontSize: '36px'
    }).setOrigin(0.5);

    prevLevelBtn.on('pointerdown', () => {
      this.selectedLevelIndex = (this.selectedLevelIndex - 1 + totalPuzzles) % totalPuzzles;
      updateLevelSelectorLabel();
    });

    nextLevelBtn.on('pointerdown', () => {
      this.selectedLevelIndex = (this.selectedLevelIndex + 1) % totalPuzzles;
      updateLevelSelectorLabel();
    });

    updateLevelSelectorLabel();


    const start = this.add.text(centerX, playBtnY, 'Play Selected Level', {
      color: '#4fd08e',
      fontFamily: FONT_FAMILY,
      fontSize: '42px'
    }).setOrigin(0.5);
    this.add.rectangle(centerX, playBtnY, 520, 96, 0x1f3d26, 0.5).setStrokeStyle(2, 0x27ae60).setOrigin(0.5);
    start.setDepth(2);

    start.setInteractive({ useHandCursor: true }).on('pointerdown', async () => {
      const skinId = this.skinIds[this.selectedSkinIndex] ?? 'void';
      if (!this.isSkinUnlocked(skinId)) {
        this.restoreStatusText.setText('This skin is locked. Restore purchases to unlock owned skins.');
        return;
      }

      await setActiveSkinId(skinId);
      this.scene.start('GameScene', { puzzleIndex: this.selectedLevelIndex });
    });

    const replayBtn = this.add
      .rectangle(350, quickActionsY, 340, 82, 0x1f2f3d, 0.7)
      .setStrokeStyle(2, 0x4f7fa8)
      .setInteractive({ useHandCursor: true });
    const replayText = this.add.text(350, quickActionsY, 'Replay Daily', {
      color: '#dbefff',
      fontFamily: FONT_FAMILY,
      fontSize: '26px'
    }).setOrigin(0.5);

    const nextUnsolvedBtn = this.add
      .rectangle(730, quickActionsY, 340, 82, 0x21332d, 0.7)
      .setStrokeStyle(2, 0x4fa87d)
      .setInteractive({ useHandCursor: true });
    const nextUnsolvedText = this.add.text(730, quickActionsY, 'Next Unsolved', {
      color: '#dcfff0',
      fontFamily: FONT_FAMILY,
      fontSize: '26px'
    }).setOrigin(0.5);

    replayBtn.on('pointerdown', async () => {
      const skinId = this.skinIds[this.selectedSkinIndex] ?? 'void';
      if (!this.isSkinUnlocked(skinId)) {
        this.restoreStatusText.setText('This skin is locked. Restore purchases to unlock owned skins.');
        return;
      }

      await setActiveSkinId(skinId);
      this.scene.start('GameScene', { puzzleIndex: getDailyPuzzleIndex() });
    });

    nextUnsolvedBtn.on('pointerdown', async () => {
      const skinId = this.skinIds[this.selectedSkinIndex] ?? 'void';
      if (!this.isSkinUnlocked(skinId)) {
        this.restoreStatusText.setText('This skin is locked. Restore purchases to unlock owned skins.');
        return;
      }

      const nextIndex = this.findNextUnsolvedIndex(new Set(solvedIds));
      await setActiveSkinId(skinId);
      this.scene.start('GameScene', { puzzleIndex: nextIndex });
    });

    const restoreBtn = this.add
      .rectangle(centerX, restoreBtnY, 520, 78, 0x1f2a3d, 0.65)
      .setStrokeStyle(2, 0x4a90d9)
      .setInteractive({ useHandCursor: true });
    const restoreText = this.add.text(centerX, restoreBtnY, 'Restore Purchases', {
      color: '#e7f0ff',
      fontFamily: FONT_FAMILY,
      fontSize: '30px'
    }).setOrigin(0.5);

    restoreBtn.on('pointerdown', async () => {
      this.restoreStatusText.setText('Restoring purchases...');
      try {
        await restorePurchases();
        await this.refreshOwnedSkins();
        this.ensureSelectedSkinIsUnlocked();
        this.updateSkinLabel();
        this.restoreStatusText.setText('Purchases restored.');
      } catch (error) {
        console.warn('Restore purchases failed', error);
        this.restoreStatusText.setText('Could not restore purchases. Please try again.');
      }
    });

    restoreBtn.setDepth(1);
    restoreText.setDepth(2);
    replayBtn.setDepth(1);
    replayText.setDepth(2);
    nextUnsolvedBtn.setDepth(1);
    nextUnsolvedText.setDepth(2);
  }

  findNextUnsolvedIndex(solvedSet: Set<string>): number {
    const total = getPuzzleCount();
    if (total <= 0) return 0;

    const start = getDailyPuzzleIndex();
    for (let offset = 0; offset < total; offset++) {
      const idx = (start + offset) % total;
      const puzzle = getPuzzleAtIndex(idx);
      if (!solvedSet.has(puzzle.id)) {
        return idx;
      }
    }

    return start;
  }

  updateSkinLabel() {
    const skinId = this.skinIds[this.selectedSkinIndex] ?? 'void';
    const skin = ALL_SKINS[skinId];
    const unlocked = this.isSkinUnlocked(skinId);

    this.skinNameText.setText(skin.name);
    this.skinNameText.setColor(unlocked ? skin.tiles.idle.letterColor : '#8a8f98');
    this.skinStatusText.setText(unlocked ? 'Owned' : `Locked  •  Product: ${skin.price}`);
  }

  async refreshOwnedSkins() {
    const paidProductIds = this.skinIds
      .map((skinId) => ALL_SKINS[skinId]?.price)
      .filter((price): price is string => Boolean(price) && price !== 'free');

    const checks = await Promise.all(
      paidProductIds.map(async (productId) => {
        const owned = await hasEntitlement(productId);
        return { productId, owned };
      })
    );

    this.ownedProductIds.clear();
    for (const entry of checks) {
      if (entry.owned) {
        this.ownedProductIds.add(entry.productId);
      }
    }
  }

  isSkinUnlocked(skinId: string): boolean {
    const skin = ALL_SKINS[skinId];
    if (!skin) return false;
    if (skin.price === 'free') return true;
    return this.ownedProductIds.has(skin.price);
  }

  ensureSelectedSkinIsUnlocked() {
    const selectedId = this.skinIds[this.selectedSkinIndex] ?? 'void';
    if (this.isSkinUnlocked(selectedId)) return;

    const unlockedFallback = this.skinIds.find((skinId) => this.isSkinUnlocked(skinId)) ?? 'void';
    const fallbackIndex = this.skinIds.indexOf(unlockedFallback);
    this.selectedSkinIndex = fallbackIndex >= 0 ? fallbackIndex : 0;
  }
}
