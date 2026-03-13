import Phaser from 'phaser';
import { TILE_SIZE, TILE, TILE_COLORS, CROPS, CropType } from '../config';

/**
 * BootScene: generates a procedural tileset texture and agent sprites,
 * then launches all parallel scenes.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  create() {
    this.generateTileset();
    this.generateAgentSprites();
    this.generateCursorSprite();

    // Launch all parallel scenes
    this.scene.start('WorldScene');
    this.scene.launch('UIScene');
    this.scene.launch('AIManagerScene');
  }

  private generateTileset() {
    const T = TILE_SIZE;
    const tileCount = 13;
    const canvas = this.textures.createCanvas('farm-tiles-sheet', T * tileCount, T)!;
    const ctx = canvas.getContext();

    // Draw each tile as a colored square with detail
    for (let i = 0; i < tileCount; i++) {
      const x = i * T;
      const color = TILE_COLORS[i] ?? 0xff00ff;

      // Fill base color
      ctx.fillStyle = this.hexToCSS(color);
      ctx.fillRect(x, 0, T, T);

      // Add per-tile detail
      this.drawTileDetail(ctx, i, x, T);
    }

    canvas.refresh();

    // Create a spritesheet from the canvas
    this.textures.get('farm-tiles-sheet').add(0, 0, 0, 0, T * tileCount, T);

    // Generate individual tile frames for tilemap use
    const tex = this.textures.createCanvas('farm-tiles', T, T * tileCount)!;
    const texCtx = tex.getContext();

    for (let i = 0; i < tileCount; i++) {
      const sx = i * T;
      texCtx.drawImage(canvas.getCanvas(), sx, 0, T, T, 0, i * T, T, T);
    }
    tex.refresh();

    // Add frames
    for (let i = 0; i < tileCount; i++) {
      this.textures.get('farm-tiles').add(i, 0, 0, i * T, T, T);
    }
  }

  private drawTileDetail(ctx: CanvasRenderingContext2D, tile: number, x: number, T: number) {
    switch (tile) {
      case TILE.GRASS:
        // Small grass blades
        ctx.fillStyle = '#5a9c4f';
        ctx.fillRect(x + 3, 4, 1, 3);
        ctx.fillRect(x + 10, 8, 1, 3);
        ctx.fillRect(x + 7, 12, 1, 2);
        break;

      case TILE.DIRT_PATH:
        // Pebbles
        ctx.fillStyle = '#8a6843';
        ctx.fillRect(x + 4, 6, 2, 2);
        ctx.fillRect(x + 10, 10, 2, 1);
        break;

      case TILE.FENCE_POST:
        // Vertical post
        ctx.fillStyle = '#4a2a16';
        ctx.fillRect(x + 6, 0, 4, T);
        ctx.fillStyle = '#8b6e4e';
        ctx.fillRect(x + 7, 1, 2, T - 2);
        break;

      case TILE.FENCE_RAIL:
        // Horizontal rail
        ctx.fillStyle = '#4a2a16';
        ctx.fillRect(x, 5, T, 3);
        ctx.fillRect(x, 10, T, 3);
        break;

      case TILE.TILLED_SOIL:
        // Furrow lines
        ctx.fillStyle = '#4a2d1e';
        for (let r = 3; r < T; r += 4) {
          ctx.fillRect(x, r, T, 1);
        }
        break;

      case TILE.PLANTED_SEED:
        // Soil + seed dots
        ctx.fillStyle = '#4a2d1e';
        for (let r = 3; r < T; r += 4) ctx.fillRect(x, r, T, 1);
        ctx.fillStyle = '#8b7355';
        ctx.fillRect(x + 7, 6, 2, 2);
        break;

      case TILE.SPROUT:
        // Soil + green sprout
        ctx.fillStyle = '#4a2d1e';
        for (let r = 3; r < T; r += 4) ctx.fillRect(x, r, T, 1);
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(x + 7, 4, 2, 6);
        ctx.fillRect(x + 5, 5, 2, 2);
        ctx.fillRect(x + 9, 7, 2, 2);
        break;

      case TILE.MATURE_PLANT:
        // Soil + full plant with fruit
        ctx.fillStyle = '#4a2d1e';
        for (let r = 3; r < T; r += 4) ctx.fillRect(x, r, T, 1);
        ctx.fillStyle = '#27ae60';
        ctx.fillRect(x + 7, 2, 2, 10);
        ctx.fillRect(x + 4, 3, 3, 4);
        ctx.fillRect(x + 9, 4, 3, 3);
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(x + 4, 4, 2, 2);
        ctx.fillRect(x + 10, 5, 2, 2);
        break;

      case TILE.WATER:
        // Wave highlights
        ctx.fillStyle = '#5b9de8';
        ctx.fillRect(x + 2, 5, 4, 1);
        ctx.fillRect(x + 9, 9, 4, 1);
        break;

      case TILE.FLOWER:
        // Grass + flower
        ctx.fillStyle = '#5a9c4f';
        ctx.fillRect(x + 3, 4, 1, 3);
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(x + 7, 5, 3, 3);
        ctx.fillStyle = '#f1c40f';
        ctx.fillRect(x + 8, 6, 1, 1);
        ctx.fillStyle = '#27ae60';
        ctx.fillRect(x + 8, 8, 1, 4);
        break;

      case TILE.ROCK:
        // 3D rock shape
        ctx.fillStyle = '#999';
        ctx.fillRect(x + 3, 4, 10, 8);
        ctx.fillStyle = '#aaa';
        ctx.fillRect(x + 4, 3, 8, 4);
        ctx.fillStyle = '#666';
        ctx.fillRect(x + 3, 10, 10, 2);
        break;

      case TILE.TREE:
        // Trunk + canopy
        ctx.fillStyle = '#5a3a1e';
        ctx.fillRect(x + 6, 8, 4, 8);
        ctx.fillStyle = '#1e7a0e';
        ctx.fillRect(x + 2, 1, 12, 9);
        ctx.fillStyle = '#2d9a1e';
        ctx.fillRect(x + 4, 2, 8, 7);
        break;
    }
  }

  private generateAgentSprites() {
    const colors = [0xe67e22, 0x2ecc71, 0x3498db];
    const names = ['noe', 'tibo', 'lisa'];

    for (let i = 0; i < colors.length; i++) {
      const key = `agent_${names[i]}`;
      const T = TILE_SIZE;
      const canvas = this.textures.createCanvas(key, T * 2, T)!;
      const ctx = canvas.getContext();
      const color = this.hexToCSS(colors[i]);

      // Frame 0: standing
      this.drawAgent(ctx, 0, 0, T, color, false);
      // Frame 1: walking
      this.drawAgent(ctx, T, 0, T, color, true);

      canvas.refresh();
      // Add frames
      this.textures.get(key).add(0, 0, 0, 0, T, T);
      this.textures.get(key).add(1, 0, T, 0, T, T);
    }
  }

  private drawAgent(ctx: CanvasRenderingContext2D, x: number, y: number, T: number, color: string, walking: boolean) {
    // Head
    ctx.fillStyle = '#f5cba7';
    ctx.fillRect(x + 5, y + 1, 6, 5);
    // Hair
    ctx.fillStyle = '#5d4037';
    ctx.fillRect(x + 5, y + 0, 6, 2);
    // Eyes
    ctx.fillStyle = '#222';
    ctx.fillRect(x + 6, y + 3, 1, 1);
    ctx.fillRect(x + 9, y + 3, 1, 1);
    // Body
    ctx.fillStyle = color;
    ctx.fillRect(x + 4, y + 6, 8, 5);
    // Legs
    ctx.fillStyle = '#34495e';
    if (walking) {
      ctx.fillRect(x + 4, y + 11, 3, 4);
      ctx.fillRect(x + 9, y + 11, 3, 4);
    } else {
      ctx.fillRect(x + 5, y + 11, 3, 4);
      ctx.fillRect(x + 8, y + 11, 3, 4);
    }
    // Boots
    ctx.fillStyle = '#6b4226';
    ctx.fillRect(x + (walking ? 4 : 5), y + 14, 3, 2);
    ctx.fillRect(x + (walking ? 9 : 8), y + 14, 3, 2);
  }

  private generateCursorSprite() {
    const T = TILE_SIZE;
    const canvas = this.textures.createCanvas('cursor', T, T)!;
    const ctx = canvas.getContext();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, T - 1, T - 1);
    canvas.refresh();
  }

  private hexToCSS(hex: number): string {
    return '#' + hex.toString(16).padStart(6, '0');
  }
}
