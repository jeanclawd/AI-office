import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from './config';
import { BootScene } from './scenes/BootScene';
import { WorldScene } from './scenes/WorldScene';
import { UIScene } from './scenes/UIScene';
import { AIManagerScene } from './scenes/AIManagerScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  pixelArt: true,
  roundPixels: true,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  backgroundColor: '#1a1a2e',
  scene: [BootScene, AIManagerScene, WorldScene, UIScene],
};

new Phaser.Game(config);
