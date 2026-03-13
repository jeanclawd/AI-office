import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, CROPS, CropType } from '../config';
import { WorldScene } from './WorldScene';

/**
 * UIScene: HUD overlay running in parallel with WorldScene.
 * Renders above the world — never affected by world camera movement.
 */
export class UIScene extends Phaser.Scene {
  private goldText!: Phaser.GameObjects.Text;
  private dayText!: Phaser.GameObjects.Text;
  private toolText!: Phaser.GameObjects.Text;
  private cropText!: Phaser.GameObjects.Text;
  private seedsText!: Phaser.GameObjects.Text;
  private harvestText!: Phaser.GameObjects.Text;
  private aiLogText!: Phaser.GameObjects.Text;
  private aiLogLines: string[] = [];

  constructor() {
    super({ key: 'UIScene' });
  }

  create() {
    const style: Phaser.Types.GameObjects.Text.TextStyle = {
      fontSize: '8px',
      color: '#ffffff',
      fontFamily: 'monospace',
    };

    const panelBg = this.add.rectangle(0, 0, GAME_WIDTH, 22, 0x000000, 0.7)
      .setOrigin(0).setDepth(0);

    this.dayText = this.add.text(4, 3, 'Day 1', style).setDepth(1);
    this.goldText = this.add.text(60, 3, 'Gold: 100', { ...style, color: '#f1c40f' }).setDepth(1);
    this.toolText = this.add.text(140, 3, 'Tool: Till [1-4]', { ...style, color: '#e67e22' }).setDepth(1);
    this.cropText = this.add.text(260, 3, 'Crop: Tomato [QWER]', { ...style, color: '#e74c3c' }).setDepth(1);

    // Bottom panel
    const bottomBg = this.add.rectangle(0, GAME_HEIGHT - 36, GAME_WIDTH, 36, 0x000000, 0.7)
      .setOrigin(0).setDepth(0);
    this.seedsText = this.add.text(4, GAME_HEIGHT - 33, '', style).setDepth(1);
    this.harvestText = this.add.text(4, GAME_HEIGHT - 20, '', style).setDepth(1);

    // AI activity log (right side)
    const logBg = this.add.rectangle(GAME_WIDTH - 130, 26, 128, 60, 0x000000, 0.5)
      .setOrigin(0).setDepth(0);
    this.add.text(GAME_WIDTH - 128, 28, 'AI Activity:', { ...style, color: '#3498db' }).setDepth(1);
    this.aiLogText = this.add.text(GAME_WIDTH - 128, 38, '', { ...style, fontSize: '6px', color: '#aaaaaa', wordWrap: { width: 124 } }).setDepth(1);

    // Help text
    this.add.text(4, GAME_HEIGHT - 8, 'Tools: [1]Till [2]Plant [3]Water [4]Harvest | Crops: [Q]Tomato [W]Carrot [E]Corn [R]Wheat',
      { ...style, fontSize: '6px', color: '#888888' }).setDepth(1);

    // Listen for events from WorldScene
    const worldScene = this.scene.get('WorldScene') as WorldScene;
    worldScene.events.on('tool-changed', (tool: string) => {
      this.toolText.setText(`Tool: ${tool.charAt(0).toUpperCase() + tool.slice(1)} [1-4]`);
    });
    worldScene.events.on('crop-changed', (crop: CropType) => {
      this.cropText.setText(`Crop: ${CROPS[crop].name} [QWER]`);
    });
    worldScene.events.on('day-tick', (day: number) => {
      this.dayText.setText(`Day ${day}`);
    });

    // Listen for AI log events
    const aiScene = this.scene.get('AIManagerScene');
    aiScene.events.on('ai-action', (msg: string) => {
      this.addAILog(msg);
    });
  }

  addAILog(msg: string) {
    this.aiLogLines.push(msg);
    if (this.aiLogLines.length > 4) this.aiLogLines.shift();
    this.aiLogText.setText(this.aiLogLines.join('\n'));
  }

  update() {
    const worldScene = this.scene.get('WorldScene') as WorldScene;
    this.goldText.setText(`Gold: ${worldScene.gold}`);

    const seedStr = Object.entries(worldScene.seeds)
      .map(([k, v]) => `${CROPS[k as CropType].name}:${v}`)
      .join('  ');
    this.seedsText.setText(`Seeds: ${seedStr}`);

    const harvestStr = Object.entries(worldScene.harvested)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => `${CROPS[k as CropType].name}:${v}`)
      .join('  ');
    this.harvestText.setText(`Harvested: ${harvestStr || 'none'}`);
  }
}
