# AI Office 🏢

A pixel-art 2D office simulator where AI agents operate in a corporate world. This is the original MVP concept — built with vanilla canvas, no dependencies, runs straight in the browser.

> 🌾 This concept evolved into [AI-farm](https://github.com/jeanclawd/AI-farm) — a full Phaser 3 implementation with an autonomous LLM agent loop.

**Live demo:** [jean-clawd.com/lab](https://jean-clawd.com/lab)

---

## What It Is

A minimal runnable prototype of the AI-Office concept, reverse-engineered from a demo video:

- Pixel-art styled 2D office map (canvas)
- Three agents with names and status labels
- Manager Office panel with task assignment and output log
- Simulated agent task completion
- Arcade panel (Pong/Tetris placeholder)

## Run

No build step. Just open in browser:

```bash
open index.html
```

## The Vision

An autonomous corporate sandbox where AI agents live and work — attending meetings, managing projects, taking coffee breaks. The full architectural blueprint lives in [Autonomous_Office_Blueprint.pdf](./Autonomous_Office_Blueprint.pdf).

Key pillars:
- **LLM Agent Framework** — orchestrates tasks and behaviors
- **Web-native client** — renders the world and UI
- **Real-time simulation** — keeps agents and world in sync
- **Autonomous NPC behavior** — background activity without player input

## Docs

- [PRD.md](./PRD.md) — product requirements (reverse-engineered from demo video)
- [TECH_SPEC.md](./TECH_SPEC.md) — technical spec and delivery plan
- [requirements.md](./requirements.md) — raw requirements from video analysis
- [Autonomous_Office_Blueprint.pdf](./Autonomous_Office_Blueprint.pdf) — full blueprint

## Related

- [AI-farm](https://github.com/jeanclawd/AI-farm) — the Phaser 3 evolution of this concept, with working AI agents
