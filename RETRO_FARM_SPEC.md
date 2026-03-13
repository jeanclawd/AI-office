# AI-Driven Retro Farm — Technical Specification

**Source:** Slide deck "Building the AI-Driven Retro Farm: A 2025 Technical Blueprint for Seamless Phaser.js and LLM Integration"
**Status:** Draft
**Date:** 2025

---

## 1. Vision

Transform the AI-Office concept into a pixel-perfect retro farming simulation where AI agents operate within a dynamic, tilemap-driven world. The game uses **Phaser 3** as the rendering engine and integrates backend **LLMs** via an observation → generation → injection loop, enabling agents to dynamically alter live game state in real time.

---

## 2. Why Phaser 3

### 2.1 Framework Diagnostics

| Metric | Value |
|---|---|
| GitHub Stars | ~39,200 |
| Weekly npm Downloads | ~40,000 |
| License | MIT (zero royalty) |
| Minified Bundle Size | ~980 KB |
| Current Stable | v3.90.0 "Tsugumi" |
| Next Major | v4.0.0-rc.6 (TypeScript-first) |

### 2.2 Three Pillars for AI-Game Integration

1. **Mature Tilemaps** — Programmatic map generation without file I/O. Pass raw 2D arrays directly into `this.make.tilemap()` for instantaneous runtime rendering. No need for Tiled JSON exports at runtime.

2. **Runtime Injection** — Load dynamic URL-based assets outside the `preload()` phase. Sprites, tilesets, and audio can be injected into a running scene on demand, enabling AI-generated content to appear without restarting the game loop.

3. **Web-Native AI** — Trivial WebSocket/HTTP integration with backend LLMs. The browser environment provides native `fetch()` and `WebSocket` APIs, making the observation → generation → injection loop straightforward to implement.

### 2.3 Version Strategy

- **Target v3.90.x (Tsugumi)** for production stability and hackathon readiness.
- **Track v4.0.0-rc** for future migration path (TypeScript-first rewrite, production-ready API evolution).
- Pin to exact Phaser version in `package.json` to avoid breaking changes.

---

## 3. Pixel-Perfect Retro Aesthetic

### 3.1 The Problem

Default Phaser rendering uses bilinear texture filtering, causing:
- Sub-pixel shimmer on sprite edges
- Blurry artifacts during camera scrolling
- Loss of the crisp pixel-art look that defines the retro style

### 3.2 Native Retro Configuration

```js
const config = {
  type: Phaser.AUTO,
  pixelArt: true,       // Sets WebGL to NEAREST filtering globally
  roundPixels: true,     // Sends uRoundPixels GPU uniform, snaps to integer coords
  width: 480,            // Native resolution (scaled up by CSS)
  height: 270,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, AIManagerScene, WorldScene, DialogScene, UIScene],
};
```

**Key settings:**
- `pixelArt: true` — Forces `NEAREST` texture filtering in WebGL, eliminating interpolation blur on all textures and tilemaps.
- `roundPixels: true` — Injects the `uRoundPixels` GPU uniform so sprites always render at integer pixel coordinates, preventing sub-pixel shimmer during movement and camera panning.

### 3.3 CSS Complement

```css
canvas {
  image-rendering: pixelated;
  image-rendering: crisp-edges;
}
```

---

## 4. Tilemap Architecture

### 4.1 Tilemaps as the AI Playground

Tilemaps are the primary surface for dynamic AI content. Phaser's tilemap system bypasses file I/O entirely — an LLM can generate a 2D array of tile indices, and the game renders it instantly.

### 4.2 Programmatic Tilemap Creation

```js
// AI generates this data
const farmLayout = [
  [0, 0, 2, 3, 0, 0],
  [0, 4, 5, 5, 4, 0],
  [0, 4, 6, 6, 4, 0],
  [0, 0, 2, 3, 0, 0],
];

// Inject into Phaser at runtime
const map = this.make.tilemap({
  data: farmLayout,
  tileWidth: 16,
  tileHeight: 16,
});
const tileset = map.addTilesetImage('farm-tiles');
const layer = map.createLayer(0, tileset, 0, 0);
```

### 4.3 Runtime Grid Manipulation API

Grid manipulation occurs **instantly at runtime** via three key Phaser layer methods:

| Method | Purpose | Use Case |
|---|---|---|
| `layer.putTileAt(newIndex, x, y)` | Target a single coordinate | Plant a seed, harvest one tile, place a fence post |
| `layer.fill(index, x, y, w, h)` | Update coordinate blocks (rectangular region) | Till a field, flood an area with water tiles, clear a plot |
| `layer.weightedRandomize(weights, x, y, w, h)` | Procedural terrain generation with weighted tile distribution | Generate natural-looking meadows, forests, varied soil patches |

**Example — AI plants a row of crops:**
```js
// Single tile: plant a seed at (5, 3)
cropsLayer.putTileAt(TILE.PLANTED_SEED, 5, 3);

// Region: till a 4x3 plot for planting
cropsLayer.fill(TILE.TILLED_SOIL, 3, 2, 4, 3);

// Procedural: generate a mixed meadow
groundLayer.weightedRandomize(
  [
    { index: TILE.GRASS, weight: 6 },
    { index: TILE.FLOWER, weight: 2 },
    { index: TILE.ROCK, weight: 1 },
  ],
  0, 0, 30, 20
);
```

> **Crucial requirement:** All Tiled editor layers must use **uncompressed formats** (CSV or Base64). Compressed formats (zlib, gzip, zstd) are unsupported by Phaser's runtime tilemap parser.

### 4.4 Tile Index Legend (Draft)

| Index | Tile | Description |
|---|---|---|
| 0 | Grass | Empty walkable grass |
| 1 | Dirt Path | Walkable path between plots |
| 2 | Fence Post | Vertical fence post (collision) |
| 3 | Fence Rail | Horizontal fence rail (collision) |
| 4 | Tilled Soil | Prepared for planting |
| 5 | Planted Seed | Seed placed, growth stage 0 |
| 6 | Sprout | Growth stage 1 |
| 7 | Mature Plant | Growth stage 2 (harvestable) |
| 8 | Water | Decorative water tile |
| 9 | Bridge | Walkable over water |
| 10 | Flower | Decorative flower |
| 11 | Rock | Obstacle (collision) |
| 12 | Tree | Decorative tree (collision) |

### 4.5 Multi-Layer Tilemap

| Layer | Purpose | AI-Modifiable? |
|---|---|---|
| Ground | Base terrain (grass, dirt, water) | Yes |
| Crops | Planted crops and growth stages | Yes — primary AI target |
| Objects | Fences, rocks, trees, structures | Yes |
| Overlay | Weather effects, highlights | Yes |

---

## 5. AI Integration Architecture

### 5.1 The Core Loop: Observe → Generate → Inject

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  OBSERVE    │ ──► │  GENERATE   │ ──► │   INJECT    │
│             │     │             │     │             │
│ Read game   │     │ LLM decides │     │ Apply tile  │
│ state from  │     │ next action │     │ changes to  │
│ tilemap +   │     │ via prompt  │     │ live scene  │
│ agent data  │     │ + tools     │     │ at runtime  │
└─────────────┘     └─────────────┘     └─────────────┘
       ▲                                       │
       └───────────────────────────────────────┘
```

### 5.2 Observation Serialization

The game state is serialized into a compact JSON snapshot for the LLM:

```json
{
  "tick": 1042,
  "season": "spring",
  "day": 5,
  "weather": "sunny",
  "farmMap": [[0,0,4,5],[0,4,7,7],[0,0,4,6]],
  "agents": [
    {
      "id": "agent_noe",
      "name": "Noe",
      "state": "IDLE",
      "position": {"x": 3, "y": 2},
      "inventory": ["seeds_tomato", "watering_can"],
      "energy": 80
    }
  ],
  "resources": {
    "gold": 150,
    "seeds": {"tomato": 5, "carrot": 3},
    "harvested": {"tomato": 12}
  }
}
```

### 5.3 LLM Action Schema

The LLM returns structured actions that the game engine executes:

```json
{
  "actions": [
    {
      "type": "MOVE_AGENT",
      "agentId": "agent_noe",
      "target": {"x": 5, "y": 3}
    },
    {
      "type": "MODIFY_TILE",
      "layer": "crops",
      "x": 5,
      "y": 3,
      "newIndex": 5
    },
    {
      "type": "UPDATE_RESOURCE",
      "resource": "seeds.tomato",
      "delta": -1
    },
    {
      "type": "AGENT_SPEAK",
      "agentId": "agent_noe",
      "text": "Planting tomatoes in the east field!"
    }
  ]
}
```

### 5.4 Data-Driven Firewall (Security)

The game state is protected with a **strict data-driven firewall** between LLM output and the game engine.

**Core principles:**
- **Never execute code.** Never use `eval()`. Never interpret LLM output as executable JavaScript.
- **Force structured JSON.** The LLM outputs structured JSON representing *what* happens. A local action dispatcher decides *how* it happens.
- **Allowlist enforcement.** Every incoming action is validated against a `VALID_ACTIONS` allowlist before reaching the game engine.

```ts
const VALID_ACTIONS = [
  'MOVE_AGENT',
  'MODIFY_TILE',
  'MODIFY_REGION',
  'PLANT_CROP',
  'HARVEST_CROP',
  'WATER_CROP',
  'BUILD_STRUCTURE',
  'UPDATE_RESOURCE',
  'AGENT_SPEAK',
  'CHANGE_WEATHER',
  'SPAWN_ENTITY',
  'ADD_QUEST',
] as const;

type ValidAction = typeof VALID_ACTIONS[number];

function validateAction(action: unknown): action is GameAction {
  if (!action || typeof action !== 'object') return false;
  const { type } = action as { type: string };
  if (!VALID_ACTIONS.includes(type as ValidAction)) return false;
  // Additional per-type parameter validation...
  return true;
}
```

**What the firewall blocks:**
- Free-text narrative output (e.g., "The villager says hello and gives you an item...") — only structured JSON passes through
- Unknown action types not in the allowlist
- Actions with out-of-bounds coordinates or invalid parameters
- Any attempt to inject executable code

**What passes through:**
- Valid structured JSON matching a known action type with valid parameters
- Example: `{ "action": "ADD_QUEST", "quest_id": "q123", "target_npc": "villager_01" }`

### 5.5 Supported Action Types

| Action | Parameters | Effect |
|---|---|---|
| `MOVE_AGENT` | agentId, target{x,y} | Pathfind agent to tile |
| `MODIFY_TILE` | layer, x, y, newIndex | Change a single tile |
| `MODIFY_REGION` | layer, x, y, w, h, data[][] | Batch-update a rectangular region |
| `PLANT_CROP` | agentId, x, y, cropType | Plant seed at location |
| `HARVEST_CROP` | agentId, x, y | Harvest mature crop |
| `WATER_CROP` | agentId, x, y | Advance growth timer |
| `BUILD_STRUCTURE` | type, x, y, w, h | Place fence/building |
| `UPDATE_RESOURCE` | resource, delta | Add/subtract inventory |
| `AGENT_SPEAK` | agentId, text | Show speech bubble |
| `CHANGE_WEATHER` | weather | Update weather state |
| `SPAWN_ENTITY` | type, x, y | Add NPC/animal |

### 5.6 Communication Layer

```
Browser (Phaser 3)              Backend (Node/FastAPI)
─────────────────               ──────────────────────
                  WebSocket
  GameState ─────────────────► /ws/game
  (observation)                    │
                                   ▼
                               LLM Orchestrator
                               (prompt + tools)
                                   │
                                   ▼
  Actions   ◄───────────────── Action[]
  (injection)
```

- **WebSocket** for low-latency bidirectional communication.
- **HTTP fallback** (`POST /api/game/action`) for environments where WebSocket is unavailable.
- **Tick rate**: Observations sent every N game ticks (configurable, default ~2 seconds).
- **Debounce**: Player-initiated actions immediately sent; AI observations batched.

---

## 6. Scene Architecture

The parallel scene manager isolates AI logic from the game world. There is **no limit** on simultaneously running scenes — AI logic, UI overlays, and game state operate independently without blocking each other.

### 6.1 Four-Layer Scene Stack

```
┌─────────────────────────────────────────────┐
│  UIScene              (top — DOM/canvas HUD) │  Clock, hearts, inventory slots
├─────────────────────────────────────────────┤
│  DialogScene          (overlay)              │  Speech bubbles, command bar, panels
├─────────────────────────────────────────────┤
│  WorldScene           (main rendering)       │  Tilemap, agents, crops, weather
├─────────────────────────────────────────────┤
│  AIManagerScene       (headless — no render) │  WebSocket, action queue, AI polling
└─────────────────────────────────────────────┘
```

All four scenes run simultaneously via `this.scene.launch()`. Each scene communicates through Phaser's event system (`this.scene.get('WorldScene').events.emit(...)`).

### 6.2 BootScene

- Loads tileset spritesheet(s) and agent sprite atlases.
- Initializes WebSocket connection to backend.
- Launches all four parallel scenes on completion.

### 6.3 WorldScene (formerly FarmScene)

- Creates multi-layer tilemap from initial state (can be AI-generated or predefined).
- Spawns agent sprites with animation state machines.
- Runs the game loop: movement, crop growth timers, weather effects.
- Exposes `injectActions(actions[])` method called by AIManagerScene.
- Owns the camera and all renderable game objects.

### 6.4 UIScene

- Runs in parallel with WorldScene (`this.scene.launch('UIScene')`).
- Renders inventory, day/season HUD, agent status cards.
- Handles player input: click-to-command, NL command bar.
- Renders above WorldScene — never affected by world camera movement.

### 6.5 DialogScene

- Overlay scene for modal interactions: speech bubbles, NL command input, report panels.
- Captures input focus when active; passes through when inactive.

### 6.6 AIManagerScene (Headless)

A dedicated, **non-rendering** scene that runs in parallel to the world. It manages the WebSocket queue and periodic observation polling, ensuring asynchronous AI calls **never block the main render loop**.

```ts
class AIManagerScene extends Phaser.Scene {
  private ws: WebSocket;
  private actionQueue: GameAction[] = [];

  create() {
    // Connect to backend
    this.ws = new WebSocket('ws://localhost:3001/ws/game');
    this.ws.onmessage = (event) => {
      const actions = JSON.parse(event.data);
      // Validate each action against the firewall before queuing
      for (const action of actions) {
        if (this.validateAction(action)) {
          this.actionQueue.push(action);
        }
      }
    };

    // Periodic observation polling via Phaser timer
    this.time.addEvent({
      delay: 2000,  // every 2 seconds
      callback: this.sendObservation,
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

  private sendObservation() {
    const worldScene = this.scene.get('WorldScene') as WorldScene;
    const snapshot = worldScene.serializeState();
    this.ws.send(JSON.stringify(snapshot));
  }
}
```

**Key design decisions:**
- **1 action/frame** processing prevents frame-rate drops from batched AI responses.
- `this.time.addEvent()` ties observation polling to Phaser's internal clock, not `setInterval`, so it pauses when the game is paused/backgrounded.
- The scene has no `render()` cost — pure logic overhead only.

---

## 7. Agent System

### 7.1 Agent State Machine

```
       ┌──────────┐
       │  IDLE    │◄──────────────────────┐
       └────┬─────┘                       │
            │ task assigned               │ task complete
            ▼                             │
       ┌──────────┐                  ┌────┴─────┐
       │ MOVING   │ ───────────────► │ WORKING  │
       └──────────┘   arrived        └────┬─────┘
                                          │ energy depleted
                                          ▼
                                     ┌──────────┐
                                     │ RESTING  │
                                     └──────────┘
```

### 7.2 Agent Properties

```ts
interface Agent {
  id: string;
  name: string;
  spriteKey: string;
  state: 'IDLE' | 'MOVING' | 'WORKING' | 'RESTING' | 'PLAYING';
  position: { x: number; y: number };
  target: { x: number; y: number } | null;
  energy: number;        // 0–100, depletes while working
  inventory: string[];   // item keys
  currentTaskId: string | null;
  speechBubble: string | null;
}
```

### 7.3 Pathfinding

- Use Phaser's built-in `Phaser.Tilemaps.TilemapLayer` collision data.
- Implement A* or EasyStar.js for grid-based pathfinding.
- Collision tiles (fences, rocks, water) block movement.
- Agents queue movement commands and execute step-by-step.

---

## 8. Crop & Farming System

### 8.1 Growth Stages

| Stage | Tile Index | Duration | Visual |
|---|---|---|---|
| Tilled Soil | 4 | — | Brown dirt rows |
| Planted Seed | 5 | 1 day | Small seed dots |
| Sprout | 6 | 2 days | Green sprout |
| Mature | 7 | 2 days | Full plant with fruit |

### 8.2 Growth Mechanics

- Growth advances based on in-game day cycle.
- Watering accelerates growth (halves time to next stage).
- Weather affects growth: rain auto-waters, drought slows growth.
- AI agents autonomously decide when to plant, water, and harvest based on LLM reasoning.

### 8.3 Crop Types (v1)

| Crop | Seed Cost | Harvest Value | Growth Time | Seasons |
|---|---|---|---|---|
| Tomato | 10g | 35g | 5 days | Spring, Summer |
| Carrot | 5g | 15g | 3 days | Spring, Fall |
| Corn | 15g | 50g | 7 days | Summer |
| Pumpkin | 20g | 80g | 10 days | Fall |
| Wheat | 3g | 10g | 4 days | All |

---

## 9. Runtime Asset Injection

Dynamic textures load cleanly **outside the preload phase**. The pipeline is: AI generates a dynamic URL → engine loader bypasses preload → live sprite manifests in-game.

### 9.1 Dynamic Texture Loading

Phaser supports loading assets outside `preload()` using the Loader plugin:

```js
// 1. AI generates a dynamic URL for a new asset
const dynamicURL = 'https://api.example.com/sprites/custom-crop-001.png';

// 2. Bypass the preload phase — load at runtime
this.load.image('custom-crop', dynamicURL);
this.load.start();

// 3. Once loaded, the asset manifests as a live sprite
this.load.once('complete', () => {
  const sprite = this.add.sprite(100, 100, 'custom-crop');
  // Or add as a tileset for tilemap use:
  map.addTilesetImage('custom-crop');
});
```

### 9.2 Dynamic Textures API (v3.60+)

`addDynamicTexture('aiCanvas')` allows programmatic stamping — for example, compositing a crop frame onto a brown soil texture at runtime without needing a pre-built sprite sheet:

```js
// Create a dynamic texture canvas
const dynTex = this.textures.addDynamicTexture('ai-composite', 16, 16);

// Stamp base soil, then overlay crop sprite
dynTex.stamp('farm-tiles', TILE.TILLED_SOIL, 0, 0);
dynTex.stamp('crop-overlays', cropFrame, 0, 0);

// Use the composite as a regular texture
this.add.sprite(x, y, 'ai-composite');
```

### 9.3 Use Cases for Runtime Injection

- AI-generated custom crop sprites from image generation APIs
- Dynamically themed seasonal tile variants (snow overlay in winter, bloom in spring)
- Player-uploaded farm decorations
- Procedurally generated terrain textures via `addDynamicTexture` compositing
- NPC portrait generation for dynamically spawned villagers

---

## 10. Data Model

### 10.1 FarmWorld

```json
{
  "id": "farm_main",
  "day": 5,
  "season": "spring",
  "weather": "sunny",
  "layers": {
    "ground": [[0,0,1,1],[0,0,1,0]],
    "crops":  [[0,0,4,5],[0,4,7,7]],
    "objects": [[0,2,0,3],[0,0,0,0]]
  },
  "dimensions": { "width": 30, "height": 20 },
  "tileSize": 16
}
```

### 10.2 Agent (extended from AI-Office)

```json
{
  "id": "agent_noe",
  "name": "Noe",
  "spriteKey": "farmer_male_01",
  "state": "IDLE",
  "position": {"x": 5, "y": 8},
  "target": null,
  "energy": 85,
  "inventory": ["seeds_tomato", "watering_can"],
  "currentTaskId": null,
  "createdAt": "2025-01-01T00:00:00Z"
}
```

### 10.3 Task

```json
{
  "id": "task_001",
  "type": "PLANT_CROP",
  "status": "PENDING",
  "params": {
    "cropType": "tomato",
    "region": {"x": 3, "y": 2, "w": 4, "h": 3}
  },
  "assignedAgents": ["agent_noe"],
  "createdAt": "2025-01-01T10:00:00Z"
}
```

---

## 11. Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| Game Engine | Phaser 3.90.x | Mature tilemaps, runtime injection, pixel-art native |
| Language | TypeScript | Type safety, aligns with Phaser 4 direction |
| Bundler | Vite | Fast HMR, native ESM, minimal config |
| UI Overlay | Preact or Svelte | Lightweight DOM layer for panels/HUD |
| State Sync | Zustand | Minimal state management bridging game ↔ UI |
| Backend | Node.js + Express | WebSocket + REST, JS ecosystem alignment |
| Realtime | ws (native WebSocket) | Low overhead, no Socket.IO abstraction needed |
| LLM | Claude API / OpenAI | Structured output for action schemas |
| Pathfinding | EasyStar.js | Lightweight A* for grid-based maps |
| Persistence | SQLite (dev) / Postgres (prod) | Game state snapshots |

---

## 12. Project Structure

```
ai-office/
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── src/
│   ├── main.ts                  # Phaser game bootstrap
│   ├── config.ts                # Phaser config (pixelArt, roundPixels, etc.)
│   ├── scenes/
│   │   ├── BootScene.ts         # Asset loading, launches all scenes
│   │   ├── WorldScene.ts        # Main gameplay (tilemap, agents, crops)
│   │   ├── UIScene.ts           # HUD overlay (inventory, clock, status)
│   │   ├── DialogScene.ts       # Speech bubbles, command input, modals
│   │   └── AIManagerScene.ts    # Headless: WebSocket, action queue, AI polling
│   ├── systems/
│   │   ├── AgentSystem.ts       # Agent state machine + pathfinding
│   │   ├── CropSystem.ts        # Growth stages, planting, harvesting
│   │   ├── WeatherSystem.ts     # Day/night, seasons, weather effects
│   │   └── TilemapSystem.ts     # Tilemap creation + runtime mutation
│   ├── ai/
│   │   ├── AILoop.ts            # Observe → Generate → Inject coordinator
│   │   ├── ObservationSerializer.ts  # Game state → JSON snapshot
│   │   ├── ActionExecutor.ts    # Action[] → Phaser commands
│   │   └── WebSocketClient.ts   # Backend communication
│   ├── ui/
│   │   ├── HUD.svelte           # Inventory, clock, status
│   │   ├── AgentPanel.svelte    # Agent info + task assignment
│   │   └── CommandBar.svelte    # NL command input
│   └── assets/
│       ├── tilesets/            # 16x16 pixel-art tilesets
│       ├── sprites/             # Agent + NPC sprite atlases
│       └── audio/               # SFX and ambient music
├── server/
│   ├── index.ts                 # Express + WebSocket server
│   ├── llm/
│   │   ├── orchestrator.ts      # LLM prompt construction + parsing
│   │   ├── prompts.ts           # System/user prompt templates
│   │   └── tools.ts             # Tool definitions for structured output
│   ├── game/
│   │   ├── state.ts             # Server-side game state (source of truth)
│   │   └── actions.ts           # Action validation + execution
│   └── db/
│       ├── schema.sql           # Tables for persistence
│       └── queries.ts           # Save/load operations
└── public/
    └── assets/                  # Static assets served by Vite
```

---

## 13. Delivery Milestones

### Milestone 1: Phaser Bootstrap + Pixel-Perfect Rendering
- Initialize Phaser 3 with `pixelArt: true` and `roundPixels: true`.
- Load a static tileset and render a hardcoded farm tilemap.
- Verify crisp pixel rendering at multiple resolutions.
- Set up Vite + TypeScript project scaffold.

### Milestone 2: Dynamic Tilemap + Agent Sprites
- Implement `TilemapSystem` for programmatic tilemap creation from 2D arrays.
- Add multi-layer tilemap support (ground, crops, objects).
- Spawn agent sprites with idle/walk animations.
- Implement A* pathfinding with collision awareness.

### Milestone 3: Crop & Farming Mechanics
- Implement `CropSystem` with growth stages and timers.
- Add planting, watering, and harvesting interactions.
- Day/night cycle and season system.
- Basic weather effects on crop growth.

### Milestone 4: AI Loop Integration
- Set up WebSocket connection to backend.
- Implement `ObservationSerializer` to snapshot game state.
- Build `ActionExecutor` to apply LLM-returned actions to the live scene.
- Connect to LLM backend with structured output for action schemas.
- End-to-end test: AI agent autonomously plants and harvests a crop.

### Milestone 5: UI Overlay + NL Commands
- Build HUD (inventory, day/season, agent status) as DOM overlay.
- Implement NL command bar for player-issued instructions.
- Agent panel with task assignment and status.
- Speech bubbles for agent dialogue.

### Milestone 6: Runtime Asset Injection + Polish
- Dynamic texture loading for AI-generated or seasonal content.
- Persistence: save/load farm state.
- Audio: ambient music and SFX.
- Performance profiling and optimization.

---

## 14. Open Questions

1. **Tile size**: 16x16 vs 32x32 — depends on art style and screen resolution targets.
2. **Camera**: Fixed top-down vs scrollable world — larger farms need camera controls.
3. **Multiplayer**: Should multiple players be able to share a farm (future scope)?
4. **LLM provider**: Claude vs OpenAI vs local models — depends on latency and cost requirements.
5. **Phaser 4 migration**: When v4.0.0 stabilizes, what is the migration effort?

---

## 15. References

- Phaser 3 Documentation: phaser.io/docs
- Phaser Tilemap API: `Phaser.Tilemaps.Tilemap`
- EasyStar.js: pathfinding library for grid-based maps
- Phaser `pixelArt` config: sets `Phaser.Textures.FilterMode.NEAREST`
- Phaser `roundPixels` config: enables `uRoundPixels` uniform in WebGL pipeline
