# AI Office 🏢

A pixel-art 2D office simulator where AI agents operate in a corporate world —
vanilla canvas, **zero dependencies, zero asset files, no build step**. Open it
in a browser and the office runs.

> 🌾 This concept evolved into [AI-farm](https://github.com/jeanclawd/AI-farm) —
> a full Phaser 3 implementation with an autonomous LLM agent loop. v2 of this
> repo ports AI-farm's best upgrades back: a deterministic headless simulation
> core and a procedural pixel-art rendering pass.

---

## What It Is

Three agents — Noe, Tibo and Lisa — live on a simulated office floor:

- **Real work**: tasks assigned from the Manager Office carry work-unit budgets;
  agents path to their desks (BFS around the furniture) and grind them down at
  a rate set by their **energy** and **morale**.
- **Autonomous behaviour**: burnt-out agents take coffee breaks on their own;
  low morale sends them to the water cooler or the arcade cabinet; idle agents
  wander so the floor never freezes.
- **Procedural pixel art**: every sprite — desks, monitors, the coffee machine,
  the arcade cabinet, the agents themselves — is drawn from code at boot.
  Day/night cycle, lit monitors, a skyline in the windows after dark, and a
  3×5 bitmap font authored in-repo.
- **Deterministic**: the whole sim runs on a seeded PRNG. Same seed, same
  episode, same digest.

## Run

No build step. Serve the folder (or just open the file):

```bash
open index.html          # or: python3 -m http.server
```

URL overrides for repeatable captures:

| param | effect |
|---|---|
| `?seed=42` | seed the episode |
| `?speed=2` | start at 2× (1/2/4) |
| `?time=0.65` | freeze time of day (≈0.55–0.8 is night) |
| `?paused=1` | start paused |

In the UI: type a command and **Send** to task the selected agent, or **DEPLOY**
to task everyone ticked in Deployment Options. Click a desk to select its
agent; click the arcade cabinet to send someone off to play.

## Headless mode

The simulation core is dual-use — the same `sim.js` the page loads also runs
under Node with no browser:

```bash
node sim.js --ticks 2000 --seed 42
```

It runs a scripted task backlog and prints per-agent stats plus an FNV-1a
digest of the final state. Same seed ⇒ same digest, which doubles as the
repo's smoke test:

```bash
node sim.js --ticks 2000 --seed 42 --quiet   # digest: a817bd30, every time
```

## Files

| file | role |
|---|---|
| `sim.js` | deterministic office reducer: agents, tasks, pathfinding, events. Browser + Node. |
| `render.js` | procedural pixel-art renderer: palette, baked sprites, bitmap font, day/night. |
| `app.js` | UI glue: fixed-timestep loop, Manager Office panel, canvas scaling, clicks. |
| `CHANGELOG.md` | what changed and what is still fake, in AI-farm's changelog style. |

## The Vision

An autonomous corporate sandbox where AI agents live and work — attending
meetings, managing projects, taking coffee breaks. The full architectural
blueprint lives in [Autonomous_Office_Blueprint.pdf](./Autonomous_Office_Blueprint.pdf).

Key pillars:
- **LLM Agent Framework** — orchestrates tasks and behaviors *(still simulated
  here; AI-farm's schema-constrained `llmPolicy` is the intended shape)*
- **Web-native client** — renders the world and UI ✅
- **Real-time simulation** — keeps agents and world in sync ✅
- **Autonomous NPC behavior** — background activity without player input ✅

## Docs

- [CHANGELOG.md](./CHANGELOG.md) — the v2 overhaul, mechanics and known limitations
- [PRD.md](./PRD.md) — product requirements (reverse-engineered from demo video)
- [TECH_SPEC.md](./TECH_SPEC.md) — technical spec and delivery plan
- [requirements.md](./requirements.md) — raw requirements from video analysis
- [Autonomous_Office_Blueprint.pdf](./Autonomous_Office_Blueprint.pdf) — full blueprint

## Related

- [AI-farm](https://github.com/jeanclawd/AI-farm) — the Phaser 3 evolution of this
  concept: autonomous LLM agent loop, a headless benchmark arena with eight
  policies, and the procedural-rendering playbook this repo reuses.
