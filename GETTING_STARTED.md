# Getting Started

## Prerequisites

- Node.js 18+
- npm 9+

## Setup

```bash
npm install
```

## Development

```bash
npm run dev
```

Open the URL shown in the terminal (default: `http://localhost:5173`).

## Controls

### Tools (number keys)

| Key | Tool | Description |
|-----|------|-------------|
| `1` | Till | Prepare soil for planting |
| `2` | Plant | Place a seed in tilled soil |
| `3` | Water | Water a growing crop (speeds growth) |
| `4` | Harvest | Collect a mature crop for gold |

### Crop Selection (letter keys)

| Key | Crop | Seed Cost | Harvest Value | Growth Time |
|-----|------|-----------|---------------|-------------|
| `Q` | Tomato | 10g | 35g | 5 ticks |
| `W` | Carrot | 5g | 15g | 3 ticks |
| `E` | Corn | 15g | 50g | 7 ticks |
| `R` | Wheat | 3g | 10g | 4 ticks |

### Interaction

Click any grass tile inside the fenced farm plots to use your selected tool.

## How It Works

The game runs four Phaser scenes in parallel:

1. **WorldScene** — Renders the tilemap, agents, and crops. Handles player input.
2. **UIScene** — HUD overlay showing gold, seeds, harvest counts, and current tool/crop.
3. **AIManagerScene** — Headless scene that observes the game state every 6 seconds and generates farming actions for the three AI agents (Noe, Tibo, Lisa).
4. **BootScene** — Generates all pixel-art textures procedurally at startup.

### Crop Lifecycle

```
Grass → [Till] → Tilled Soil → [Plant] → Seed → Sprout → Mature → [Harvest] → Tilled Soil
```

Watering a crop doubles its growth speed for that tick.

### AI Agents

The three agents autonomously farm using a priority system:

1. Harvest mature crops
2. Water growing crops
3. Plant seeds on empty tilled soil
4. Till new soil when farm space is low

Their activity is logged in the top-right panel.

## Build

```bash
npm run build
```

Output goes to `dist/`.
