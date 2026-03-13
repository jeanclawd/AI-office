import Phaser from 'phaser';
import {
  TILE_SIZE, MAP_COLS, MAP_ROWS, TILE, CROPS, CropType,
  AGENT_DEFS, GROWTH_TICK_MS,
} from '../config';

/** Per-tile crop data stored via Phaser Data Manager pattern */
interface CropData {
  type: CropType;
  stage: number;       // 0=seed, 1=sprout, 2=mature
  watered: boolean;
  ticksRemaining: number;
}

/** Agent game object with data-manager state */
interface FarmAgent extends Phaser.GameObjects.Sprite {
  agentId: string;
  agentName: string;
}

export class WorldScene extends Phaser.Scene {
  private groundLayer!: Phaser.Tilemaps.TilemapLayer;
  private cropsLayer!: Phaser.Tilemaps.TilemapLayer;
  private objectsLayer!: Phaser.Tilemaps.TilemapLayer;
  private map!: Phaser.Tilemaps.Tilemap;
  private agents: FarmAgent[] = [];
  private cursor!: Phaser.GameObjects.Image;
  private cropDataMap: Map<string, CropData> = new Map();
  private selectedTool: 'till' | 'plant' | 'water' | 'harvest' = 'till';
  private selectedCrop: CropType = 'tomato';
  private nameLabels: Phaser.GameObjects.Text[] = [];

  // Resources exposed for UIScene and AIManagerScene
  public gold = 100;
  public seeds: Record<CropType, number> = { tomato: 10, carrot: 8, corn: 5, wheat: 12 };
  public harvested: Record<CropType, number> = { tomato: 0, carrot: 0, corn: 0, wheat: 0 };
  public dayCount = 1;

  constructor() {
    super({ key: 'WorldScene' });
  }

  create() {
    this.buildTilemap();
    this.spawnAgents();
    this.setupInput();
    this.startGrowthTimer();

    // Emit ready event for other scenes
    this.events.emit('world-ready');
  }

  // --- Tilemap ---

  private buildTilemap() {
    const groundData = this.generateGroundLayer();
    const cropsData = this.emptyLayer();
    const objectsData = this.generateObjectsLayer();

    this.map = this.make.tilemap({
      data: groundData,
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE,
    });

    const tileset = this.map.addTilesetImage('farm-tiles', 'farm-tiles', TILE_SIZE, TILE_SIZE)!;
    this.groundLayer = this.map.createLayer(0, tileset, 0, 0)!;

    // Crops layer (separate tilemap)
    const cropsMap = this.make.tilemap({
      data: cropsData,
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE,
    });
    const cropsTileset = cropsMap.addTilesetImage('farm-tiles', 'farm-tiles', TILE_SIZE, TILE_SIZE)!;
    this.cropsLayer = cropsMap.createLayer(0, cropsTileset, 0, 0)!;

    // Objects layer
    const objMap = this.make.tilemap({
      data: objectsData,
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE,
    });
    const objTileset = objMap.addTilesetImage('farm-tiles', 'farm-tiles', TILE_SIZE, TILE_SIZE)!;
    this.objectsLayer = objMap.createLayer(0, objTileset, 0, 0)!;

    // Cursor highlight
    this.cursor = this.add.image(0, 0, 'cursor').setOrigin(0).setDepth(10).setAlpha(0.6);
  }

  private generateGroundLayer(): number[][] {
    const data: number[][] = [];
    for (let y = 0; y < MAP_ROWS; y++) {
      const row: number[] = [];
      for (let x = 0; x < MAP_COLS; x++) {
        // Water border on south edge
        if (y >= MAP_ROWS - 2 && x > 5 && x < 15) {
          row.push(TILE.WATER);
        }
        // Dirt paths
        else if (y === 2 && x >= 3 && x <= 25) {
          row.push(TILE.DIRT_PATH);
        } else if (x === 3 && y >= 2 && y <= 16) {
          row.push(TILE.DIRT_PATH);
        } else if (x === 14 && y >= 2 && y <= 16) {
          row.push(TILE.DIRT_PATH);
        } else if (x === 25 && y >= 2 && y <= 16) {
          row.push(TILE.DIRT_PATH);
        } else if (y === 16 && x >= 3 && x <= 25) {
          row.push(TILE.DIRT_PATH);
        }
        // Flowers scattered
        else if ((x + y * 7) % 23 === 0 && y > 0 && y < MAP_ROWS - 2) {
          row.push(TILE.FLOWER);
        }
        // Default grass
        else {
          row.push(TILE.GRASS);
        }
      }
      data.push(row);
    }
    return data;
  }

  private generateObjectsLayer(): number[][] {
    const data: number[][] = [];
    for (let y = 0; y < MAP_ROWS; y++) {
      const row: number[] = [];
      for (let x = 0; x < MAP_COLS; x++) {
        // Fence around farm plot 1 (left)
        if (y === 4 && x >= 4 && x <= 13) row.push(TILE.FENCE_RAIL);
        else if (y === 15 && x >= 4 && x <= 13) row.push(TILE.FENCE_RAIL);
        else if (x === 4 && y >= 4 && y <= 15) row.push(TILE.FENCE_POST);
        else if (x === 13 && y >= 4 && y <= 15) row.push(TILE.FENCE_POST);
        // Fence around farm plot 2 (right)
        else if (y === 4 && x >= 15 && x <= 24) row.push(TILE.FENCE_RAIL);
        else if (y === 15 && x >= 15 && x <= 24) row.push(TILE.FENCE_RAIL);
        else if (x === 15 && y >= 4 && y <= 15) row.push(TILE.FENCE_POST);
        else if (x === 24 && y >= 4 && y <= 15) row.push(TILE.FENCE_POST);
        // Decorative trees
        else if (y === 0 && (x === 0 || x === 1 || x === 28 || x === 29)) row.push(TILE.TREE);
        // Rocks
        else if (y === 17 && (x === 20 || x === 22)) row.push(TILE.ROCK);
        else row.push(-1); // empty
      }
      data.push(row);
    }
    return data;
  }

  private emptyLayer(): number[][] {
    return Array.from({ length: MAP_ROWS }, () =>
      Array.from({ length: MAP_COLS }, () => -1)
    );
  }

  // --- Agents ---

  private spawnAgents() {
    for (const def of AGENT_DEFS) {
      const agent = this.add.sprite(
        def.startX * TILE_SIZE + TILE_SIZE / 2,
        def.startY * TILE_SIZE + TILE_SIZE / 2,
        def.id,
        0
      ) as FarmAgent;

      agent.agentId = def.id;
      agent.agentName = def.name;
      agent.setDepth(5);

      // Data Manager state (serialization-first)
      agent.setData('state', 'IDLE');
      agent.setData('energy', 100);
      agent.setData('targetX', null);
      agent.setData('targetY', null);
      agent.setData('task', null);

      // Walk animation toggle
      this.tweens.add({
        targets: agent,
        duration: 400,
        repeat: -1,
        yoyo: true,
        onYoyo: () => agent.setFrame(0),
        onRepeat: () => agent.setFrame(1),
      });

      // Name label
      const label = this.add.text(
        agent.x,
        agent.y - TILE_SIZE + 2,
        def.name,
        { fontSize: '7px', color: '#ffffff', fontFamily: 'monospace' }
      ).setOrigin(0.5).setDepth(6);
      this.nameLabels.push(label);

      this.agents.push(agent);
    }
  }

  // --- Input ---

  private setupInput() {
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      const tx = Math.floor(pointer.worldX / TILE_SIZE);
      const ty = Math.floor(pointer.worldY / TILE_SIZE);
      this.cursor.setPosition(tx * TILE_SIZE, ty * TILE_SIZE);
    });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const tx = Math.floor(pointer.worldX / TILE_SIZE);
      const ty = Math.floor(pointer.worldY / TILE_SIZE);
      if (tx < 0 || tx >= MAP_COLS || ty < 0 || ty >= MAP_ROWS) return;

      this.handleTileClick(tx, ty);
    });

    // Keyboard tool switching
    this.input.keyboard?.on('keydown-ONE', () => { this.selectedTool = 'till'; this.events.emit('tool-changed', this.selectedTool); });
    this.input.keyboard?.on('keydown-TWO', () => { this.selectedTool = 'plant'; this.events.emit('tool-changed', this.selectedTool); });
    this.input.keyboard?.on('keydown-THREE', () => { this.selectedTool = 'water'; this.events.emit('tool-changed', this.selectedTool); });
    this.input.keyboard?.on('keydown-FOUR', () => { this.selectedTool = 'harvest'; this.events.emit('tool-changed', this.selectedTool); });

    // Crop type switching
    this.input.keyboard?.on('keydown-Q', () => { this.selectedCrop = 'tomato'; this.events.emit('crop-changed', this.selectedCrop); });
    this.input.keyboard?.on('keydown-W', () => { this.selectedCrop = 'carrot'; this.events.emit('crop-changed', this.selectedCrop); });
    this.input.keyboard?.on('keydown-E', () => { this.selectedCrop = 'corn'; this.events.emit('crop-changed', this.selectedCrop); });
    this.input.keyboard?.on('keydown-R', () => { this.selectedCrop = 'wheat'; this.events.emit('crop-changed', this.selectedCrop); });
  }

  private handleTileClick(tx: number, ty: number) {
    const key = `${tx},${ty}`;
    const groundTile = this.groundLayer.getTileAt(tx, ty);
    const objTile = this.objectsLayer.getTileAt(tx, ty);

    // Can't interact with fence/rock/tree/water tiles
    if (objTile && objTile.index !== -1) return;
    if (groundTile && (groundTile.index === TILE.WATER || groundTile.index === TILE.DIRT_PATH)) return;

    switch (this.selectedTool) {
      case 'till':
        this.tillSoil(tx, ty, key);
        break;
      case 'plant':
        this.plantCrop(tx, ty, key);
        break;
      case 'water':
        this.waterCrop(tx, ty, key);
        break;
      case 'harvest':
        this.harvestCrop(tx, ty, key);
        break;
    }

    // Send nearest idle agent to the tile
    this.sendAgentTo(tx, ty);
  }

  // --- Farming Actions ---

  public tillSoil(tx: number, ty: number, key?: string) {
    key = key ?? `${tx},${ty}`;
    if (this.cropDataMap.has(key)) return; // already has crop data
    this.cropsLayer.putTileAt(TILE.TILLED_SOIL, tx, ty);
  }

  public plantCrop(tx: number, ty: number, key?: string, cropType?: CropType) {
    key = key ?? `${tx},${ty}`;
    const crop = cropType ?? this.selectedCrop;
    const tile = this.cropsLayer.getTileAt(tx, ty);
    if (!tile || tile.index !== TILE.TILLED_SOIL) return;
    if (this.cropDataMap.has(key)) return;
    if (this.seeds[crop] <= 0) return;

    this.seeds[crop]--;
    this.gold -= CROPS[crop].seedCost;

    this.cropsLayer.putTileAt(TILE.PLANTED_SEED, tx, ty);
    this.cropDataMap.set(key, {
      type: crop,
      stage: 0,
      watered: false,
      ticksRemaining: CROPS[crop].growthTicks,
    });
  }

  public waterCrop(tx: number, ty: number, key?: string) {
    key = key ?? `${tx},${ty}`;
    const crop = this.cropDataMap.get(key);
    if (!crop || crop.stage >= 2) return;
    crop.watered = true;
    // Visual feedback: brief tint
    const tile = this.cropsLayer.getTileAt(tx, ty);
    if (tile) {
      tile.tint = 0x6699ff;
      this.time.delayedCall(500, () => { tile.tint = 0xffffff; });
    }
  }

  public harvestCrop(tx: number, ty: number, key?: string) {
    key = key ?? `${tx},${ty}`;
    const crop = this.cropDataMap.get(key);
    if (!crop || crop.stage < 2) return;

    this.gold += CROPS[crop.type].harvestValue;
    this.harvested[crop.type]++;
    this.cropDataMap.delete(key);
    this.cropsLayer.putTileAt(TILE.TILLED_SOIL, tx, ty);
  }

  // --- Growth Timer ---

  private startGrowthTimer() {
    this.time.addEvent({
      delay: GROWTH_TICK_MS,
      callback: this.tickGrowth,
      callbackScope: this,
      loop: true,
    });
  }

  private tickGrowth() {
    this.dayCount++;

    for (const [key, crop] of this.cropDataMap.entries()) {
      if (crop.stage >= 2) continue;

      // Watered crops grow faster
      const reduction = crop.watered ? 2 : 1;
      crop.ticksRemaining -= reduction;
      crop.watered = false;

      if (crop.ticksRemaining <= 0) {
        crop.stage++;
        const [tx, ty] = key.split(',').map(Number);

        if (crop.stage === 1) {
          this.cropsLayer.putTileAt(TILE.SPROUT, tx, ty);
          crop.ticksRemaining = Math.ceil(CROPS[crop.type].growthTicks / 2);
        } else if (crop.stage === 2) {
          this.cropsLayer.putTileAt(TILE.MATURE_PLANT, tx, ty);
        }
      }
    }

    this.events.emit('day-tick', this.dayCount);
  }

  // --- Agent Movement ---

  private sendAgentTo(tx: number, ty: number) {
    // Find nearest idle agent
    const idle = this.agents
      .filter(a => a.getData('state') === 'IDLE')
      .sort((a, b) => {
        const da = Math.abs(a.x - tx * TILE_SIZE) + Math.abs(a.y - ty * TILE_SIZE);
        const db = Math.abs(b.x - tx * TILE_SIZE) + Math.abs(b.y - ty * TILE_SIZE);
        return da - db;
      });

    if (idle.length === 0) return;
    const agent = idle[0];

    this.moveAgent(agent, tx, ty);
  }

  public moveAgent(agent: FarmAgent, tx: number, ty: number) {
    const targetX = tx * TILE_SIZE + TILE_SIZE / 2;
    const targetY = ty * TILE_SIZE + TILE_SIZE / 2;

    agent.setData('state', 'MOVING');
    agent.setData('targetX', tx);
    agent.setData('targetY', ty);

    const distance = Phaser.Math.Distance.Between(agent.x, agent.y, targetX, targetY);
    const duration = (distance / TILE_SIZE) * 200; // ~200ms per tile

    // Flip sprite based on direction
    if (targetX < agent.x) agent.setFlipX(true);
    else if (targetX > agent.x) agent.setFlipX(false);

    this.tweens.add({
      targets: agent,
      x: targetX,
      y: targetY,
      duration: Math.max(duration, 100),
      ease: 'Linear',
      onComplete: () => {
        agent.setData('state', 'IDLE');
        agent.setData('targetX', null);
        agent.setData('targetY', null);
      },
    });
  }

  // --- Public API for AIManagerScene ---

  public injectActions(actions: GameAction[]) {
    for (const action of actions) {
      this.executeAction(action);
    }
  }

  private executeAction(action: GameAction) {
    switch (action.type) {
      case 'TILL_SOIL':
        this.tillSoil(action.x, action.y);
        break;
      case 'PLANT_CROP':
        this.tillSoil(action.x, action.y);
        this.plantCrop(action.x, action.y, undefined, action.cropType as CropType);
        break;
      case 'WATER_CROP':
        this.waterCrop(action.x, action.y);
        break;
      case 'HARVEST_CROP':
        this.harvestCrop(action.x, action.y);
        break;
      case 'MOVE_AGENT': {
        const agent = this.agents.find(a => a.agentId === action.agentId);
        if (agent) this.moveAgent(agent, action.x, action.y);
        break;
      }
      case 'AGENT_SPEAK': {
        const agent = this.agents.find(a => a.agentId === action.agentId);
        if (agent && action.text) this.showSpeechBubble(agent, action.text);
        break;
      }
    }
  }

  private showSpeechBubble(agent: FarmAgent, text: string) {
    const bubble = this.add.text(
      agent.x, agent.y - TILE_SIZE - 6, text,
      {
        fontSize: '6px',
        color: '#ffffff',
        backgroundColor: '#333333',
        padding: { x: 3, y: 2 },
        fontFamily: 'monospace',
      }
    ).setOrigin(0.5).setDepth(20);

    this.tweens.add({
      targets: bubble,
      alpha: 0,
      y: bubble.y - 10,
      duration: 3000,
      onComplete: () => bubble.destroy(),
    });
  }

  /** Serialize current game state for AI observation */
  public serializeState(): GameState {
    const farmMap: number[][] = [];
    for (let y = 0; y < MAP_ROWS; y++) {
      const row: number[] = [];
      for (let x = 0; x < MAP_COLS; x++) {
        const cropTile = this.cropsLayer.getTileAt(x, y);
        if (cropTile && cropTile.index !== -1) {
          row.push(cropTile.index);
        } else {
          const groundTile = this.groundLayer.getTileAt(x, y);
          row.push(groundTile ? groundTile.index : 0);
        }
      }
      farmMap.push(row);
    }

    return {
      day: this.dayCount,
      gold: this.gold,
      seeds: { ...this.seeds },
      harvested: { ...this.harvested },
      agents: this.agents.map(a => ({
        id: a.agentId,
        name: a.agentName,
        state: a.getData('state'),
        x: Math.floor(a.x / TILE_SIZE),
        y: Math.floor(a.y / TILE_SIZE),
        energy: a.getData('energy'),
      })),
      farmMap,
      crops: Array.from(this.cropDataMap.entries()).map(([key, data]) => ({
        position: key,
        ...data,
      })),
    };
  }

  update() {
    // Update name label positions
    for (let i = 0; i < this.agents.length; i++) {
      const agent = this.agents[i];
      const label = this.nameLabels[i];
      label.setPosition(agent.x, agent.y - TILE_SIZE + 2);
    }
  }
}

// --- Types ---

export interface GameAction {
  type: string;
  agentId?: string;
  x: number;
  y: number;
  cropType?: string;
  text?: string;
}

export interface GameState {
  day: number;
  gold: number;
  seeds: Record<string, number>;
  harvested: Record<string, number>;
  agents: { id: string; name: string; state: string; x: number; y: number; energy: number }[];
  farmMap: number[][];
  crops: { position: string; type: string; stage: number; watered: boolean; ticksRemaining: number }[];
}
