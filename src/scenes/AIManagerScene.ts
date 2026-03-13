import Phaser from 'phaser';
import { AI_TICK_MS, TILE, MAP_COLS, MAP_ROWS, CropType, CROPS } from '../config';
import { WorldScene, GameAction, GameState } from './WorldScene';

/**
 * AIManagerScene: Headless (non-rendering) scene that runs in parallel.
 * Manages the AI observation → generation → injection loop.
 *
 * In this MVP, the "LLM" is simulated with local heuristic logic.
 * In production, this would send observations via WebSocket to a FastAPI
 * backend and receive validated JSON actions back.
 */
export class AIManagerScene extends Phaser.Scene {
  private actionQueue: GameAction[] = [];

  constructor() {
    super({ key: 'AIManagerScene' });
  }

  create() {
    // Periodic observation polling via Phaser timer (not setInterval)
    this.time.addEvent({
      delay: AI_TICK_MS,
      callback: this.observeAndGenerate,
      callbackScope: this,
      loop: true,
    });
  }

  update() {
    // Process exactly 1 action per frame to avoid frame spikes
    if (this.actionQueue.length > 0) {
      const action = this.actionQueue.shift()!;
      const worldScene = this.scene.get('WorldScene') as WorldScene;
      worldScene.injectActions([action]);
    }
  }

  /**
   * Phase 1: OBSERVE — serialize game state
   * Phase 2: PROCESS — generate actions (simulated LLM)
   * Phase 3: INJECT — queue actions for frame-by-frame processing
   */
  private observeAndGenerate() {
    const worldScene = this.scene.get('WorldScene') as WorldScene;

    // Phase 1: Observe
    const state = worldScene.serializeState();

    // Phase 2: Process (simulated LLM — local heuristics)
    const actions = this.simulateLLM(state);

    // Phase 3: Queue for injection
    for (const action of actions) {
      if (this.validateAction(action)) {
        this.actionQueue.push(action);
      }
    }
  }

  /**
   * Simulated LLM: generates farming actions based on game state.
   * In production, this would be replaced by a WebSocket call to the backend.
   */
  private simulateLLM(state: GameState): GameAction[] {
    const actions: GameAction[] = [];
    const idleAgents = state.agents.filter(a => a.state === 'IDLE');

    if (idleAgents.length === 0) return actions;

    // Strategy 1: Harvest any mature crops
    const matureCrops = state.crops.filter(c => c.stage >= 2);
    for (const crop of matureCrops.slice(0, 2)) {
      const [x, y] = crop.position.split(',').map(Number);
      const agent = idleAgents.shift();
      if (!agent) break;

      actions.push({ type: 'MOVE_AGENT', agentId: agent.id, x, y });
      actions.push({ type: 'HARVEST_CROP', x, y });
      actions.push({ type: 'AGENT_SPEAK', agentId: agent.id, x, y, text: `Harvesting ${crop.type}!` });
      this.events.emit('ai-action', `${agent.name}: harvest ${crop.type}`);
    }

    // Strategy 2: Water unwatered crops
    const unwateredCrops = state.crops.filter(c => !c.watered && c.stage < 2);
    for (const crop of unwateredCrops.slice(0, 2)) {
      const [x, y] = crop.position.split(',').map(Number);
      const agent = idleAgents.shift();
      if (!agent) break;

      actions.push({ type: 'MOVE_AGENT', agentId: agent.id, x, y });
      actions.push({ type: 'WATER_CROP', x, y });
      this.events.emit('ai-action', `${agent.name}: water crop`);
    }

    // Strategy 3: Plant new crops if there's tilled soil and seeds available
    const tilledSpots = this.findTilledEmpty(state);
    const bestCrop = this.pickBestCrop(state);
    if (bestCrop && tilledSpots.length > 0) {
      const agent = idleAgents.shift();
      if (agent) {
        const spot = tilledSpots[0];
        actions.push({ type: 'MOVE_AGENT', agentId: agent.id, x: spot.x, y: spot.y });
        actions.push({ type: 'PLANT_CROP', x: spot.x, y: spot.y, cropType: bestCrop });
        actions.push({ type: 'AGENT_SPEAK', agentId: agent.id, x: spot.x, y: spot.y, text: `Planting ${bestCrop}` });
        this.events.emit('ai-action', `${agent.name}: plant ${bestCrop}`);
      }
    }

    // Strategy 4: Till new soil if we have idle agents and empty farm space
    if (idleAgents.length > 0 && tilledSpots.length < 3) {
      const emptyFarmSpot = this.findEmptyFarmSpot(state);
      if (emptyFarmSpot) {
        const agent = idleAgents.shift()!;
        actions.push({ type: 'MOVE_AGENT', agentId: agent.id, x: emptyFarmSpot.x, y: emptyFarmSpot.y });
        actions.push({ type: 'TILL_SOIL', x: emptyFarmSpot.x, y: emptyFarmSpot.y });
        this.events.emit('ai-action', `${agent.name}: tilling soil`);
      }
    }

    return actions;
  }

  private findTilledEmpty(state: GameState): { x: number; y: number }[] {
    const spots: { x: number; y: number }[] = [];
    for (let y = 0; y < state.farmMap.length; y++) {
      for (let x = 0; x < state.farmMap[y].length; x++) {
        if (state.farmMap[y][x] === TILE.TILLED_SOIL) {
          const hasPlant = state.crops.some(c => c.position === `${x},${y}`);
          if (!hasPlant) spots.push({ x, y });
        }
      }
    }
    return spots;
  }

  private findEmptyFarmSpot(state: GameState): { x: number; y: number } | null {
    // Look for grass tiles inside the fenced areas (x:5-12, y:5-14 and x:16-23, y:5-14)
    const zones = [
      { xMin: 5, xMax: 12, yMin: 5, yMax: 14 },
      { xMin: 16, xMax: 23, yMin: 5, yMax: 14 },
    ];

    for (const zone of zones) {
      for (let y = zone.yMin; y <= zone.yMax; y++) {
        for (let x = zone.xMin; x <= zone.xMax; x++) {
          const tile = state.farmMap[y]?.[x];
          if (tile === TILE.GRASS || tile === TILE.FLOWER) {
            return { x, y };
          }
        }
      }
    }
    return null;
  }

  private pickBestCrop(state: GameState): CropType | null {
    // Pick the crop we have the most seeds for
    const available = (Object.entries(state.seeds) as [CropType, number][])
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1]);

    return available.length > 0 ? available[0][0] : null;
  }

  /** Data-driven firewall: validate action against allowlist */
  private validateAction(action: GameAction): boolean {
    const VALID_ACTIONS = [
      'MOVE_AGENT', 'MODIFY_TILE', 'MODIFY_REGION', 'PLANT_CROP',
      'HARVEST_CROP', 'WATER_CROP', 'BUILD_STRUCTURE', 'UPDATE_RESOURCE',
      'AGENT_SPEAK', 'CHANGE_WEATHER', 'SPAWN_ENTITY', 'TILL_SOIL',
    ];

    if (!action || typeof action !== 'object') return false;
    if (!VALID_ACTIONS.includes(action.type)) return false;
    if (typeof action.x !== 'number' || typeof action.y !== 'number') {
      // Some actions like AGENT_SPEAK may have x,y as optional context
      if (action.type !== 'AGENT_SPEAK') return false;
    }
    if (action.x < 0 || action.x >= MAP_COLS || action.y < 0 || action.y >= MAP_ROWS) {
      return false;
    }

    return true;
  }
}
