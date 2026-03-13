# AI-Driven Retro Farm

A pixel-perfect retro farming simulation where AI agents tend a dynamic, tilemap-driven world. Built with **Phaser 3** and integrated with backend **LLMs** via a closed-loop observation → generation → injection engine.

## The Blueprint Distilled

1. **State is Data:** Store all entity variables in the Phaser Data Manager for instant serialization.
2. **Logic is Headless:** Isolate the AI WebSocket stream in its own invisible parallel scene.
3. **Input is Strict:** Treat LLM outputs as untrusted data; force JSON schema validation through a local dispatcher.
4. **Injection is Native:** Exploit Tiled 2D arrays and dynamic textures to manipulate the world instantly at runtime.

*Build the farm. Let the AI tend it.*

## Tech Stack

| Layer | Technology |
|---|---|
| Game Engine | Phaser 3.90.x |
| UI Layer | React |
| Language | TypeScript |
| Build Tool | Vite |
| Backend | FastAPI (Python / LangGraph) |
| Memory Store | MongoDB |
| LLM | Claude API / OpenAI |

## Quick Start

Scaffold the project instantly with the official Phaser CLI:

```bash
npm create phaser-game@latest -- --template react-ts
```

## Current MVP

The `index.html` file contains a standalone vanilla JS prototype of the AI-Office concept:

```bash
open index.html
```

No build step required for the MVP.

## Documentation

- **[RETRO_FARM_SPEC.md](./RETRO_FARM_SPEC.md)** — Full technical specification (architecture, AI loop, data models, delivery milestones)
- **[PRD.md](./PRD.md)** — Product requirements document
- **[TECH_SPEC.md](./TECH_SPEC.md)** — Original AI-Office technical spec
- **[requirements.md](./requirements.md)** — Raw requirements from demo video analysis
