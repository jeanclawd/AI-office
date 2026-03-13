/** Tile size in pixels */
export const TILE_SIZE = 16;

/** Map dimensions in tiles */
export const MAP_COLS = 30;
export const MAP_ROWS = 20;

/** Game canvas native resolution (scaled up by CSS) */
export const GAME_WIDTH = MAP_COLS * TILE_SIZE;   // 480
export const GAME_HEIGHT = MAP_ROWS * TILE_SIZE;  // 320

/** Tile indices for the procedural tileset */
export const TILE = {
  GRASS: 0,
  DIRT_PATH: 1,
  FENCE_POST: 2,
  FENCE_RAIL: 3,
  TILLED_SOIL: 4,
  PLANTED_SEED: 5,
  SPROUT: 6,
  MATURE_PLANT: 7,
  WATER: 8,
  BRIDGE: 9,
  FLOWER: 10,
  ROCK: 11,
  TREE: 12,
} as const;

/** Tile colors for procedural tileset generation */
export const TILE_COLORS: Record<number, number> = {
  [TILE.GRASS]:        0x4a8c3f,
  [TILE.DIRT_PATH]:    0x9b7653,
  [TILE.FENCE_POST]:   0x6b4226,
  [TILE.FENCE_RAIL]:   0x8b5e3c,
  [TILE.TILLED_SOIL]:  0x5c3d2e,
  [TILE.PLANTED_SEED]: 0x5c3d2e,  // soil with seed dot
  [TILE.SPROUT]:       0x5c3d2e,  // soil with green sprout
  [TILE.MATURE_PLANT]: 0x5c3d2e,  // soil with red fruit
  [TILE.WATER]:        0x3b7dd8,
  [TILE.BRIDGE]:       0x8b6914,
  [TILE.FLOWER]:       0x4a8c3f,  // grass with flower
  [TILE.ROCK]:         0x808080,
  [TILE.TREE]:         0x2d5a1e,
};

/** Crop definitions */
export const CROPS = {
  tomato:  { name: 'Tomato',  seedCost: 10, harvestValue: 35, growthTicks: 5, color: 0xe74c3c },
  carrot:  { name: 'Carrot',  seedCost: 5,  harvestValue: 15, growthTicks: 3, color: 0xe67e22 },
  corn:    { name: 'Corn',    seedCost: 15, harvestValue: 50, growthTicks: 7, color: 0xf1c40f },
  wheat:   { name: 'Wheat',   seedCost: 3,  harvestValue: 10, growthTicks: 4, color: 0xd4ac6e },
} as const;

export type CropType = keyof typeof CROPS;

/** Agent definitions */
export const AGENT_DEFS = [
  { id: 'agent_noe',  name: 'Noe',  color: 0xe67e22, startX: 5,  startY: 3 },
  { id: 'agent_tibo', name: 'Tibo', color: 0x2ecc71, startX: 7,  startY: 3 },
  { id: 'agent_lisa', name: 'Lisa', color: 0x3498db, startX: 9,  startY: 3 },
];

/** Growth tick interval in ms */
export const GROWTH_TICK_MS = 4000;

/** AI observation interval in ms */
export const AI_TICK_MS = 6000;
