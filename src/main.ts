import '@fontsource/space-mono/400.css';
import '@fontsource/space-mono/700.css';
import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';
import { WinScene } from './scenes/WinScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'app',
  width: 1080,
  height: 1920,
  backgroundColor: '#07090E',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  scene: [BootScene, MenuScene, GameScene, WinScene]
};

new Phaser.Game(config);
