# Changelog

Notable changes to the AI-Office prototype. The upgrade pattern follows what
worked in the sibling project [AI-farm](https://github.com/jeanclawd/AI-farm):
a deterministic headless core, a zero-asset procedural rendering pass, and
honest notes about what is still fake.

---

## [Office v2] — 2026-08-24 — the simulation and rendering overhaul

**One-line summary:** the MVP's "simulation" was a 4-second `setTimeout` and the
world was flat rectangles; v2 gives the office a real deterministic tick engine
(agents with energy, morale, pathfinding and autonomous breaks) and a
procedural pixel-art overhaul — still zero dependencies, zero asset files and
no build step.

### Added — simulation core (`sim.js`)

Directly modelled on AI-farm's arena reducer:

- **Seeded, deterministic engine.** All state in one plain object, advanced by
  `step(state)`, driven by a mulberry32 PRNG. Same seed => same episode,
  verified byte-for-byte via an FNV-1a digest over the quantised agent stream.
- **Headless mode.** `sim.js` is dual-use: loaded by the page, or run under
  Node with no browser at all —

  ```bash
  node sim.js --ticks 2000 --seed 42
  ```

  runs a scripted backlog and prints per-agent stats plus the digest. Two runs
  with the same seed print the same digest; that is the repo's smoke test.
- **Real tasks.** Tasks carry seeded work-unit budgets and progress. An agent's
  work rate scales with energy (0.4–1.0×) and morale (0.75–1.0×), so the state
  of the worker actually matters to the schedule.
- **Agent state machines.** idle → walking → working, with forced coffee breaks
  at low energy, water-cooler chats and arcade runs at low morale, and idle
  wandering so the floor never freezes. Breaks pay for themselves: a burnt-out
  agent works at a fraction of the rate.
- **BFS pathfinding** on the office grid — agents route around desks, the
  meeting table and plants instead of gliding through furniture.
- **Event log** with tick timestamps, feeding the Manager Office output panel.

### Added — procedural rendering (`render.js`)

The AI-farm visual-overhaul discipline, applied to an office:

- **Zero asset files.** Every sprite is baked onto offscreen canvases at boot:
  desks with live monitors, chairs, a meeting table with laptop and papers,
  coffee machine, water cooler, arcade cabinet, plants, doors and windows.
- **Limited "late shift" palette.** Carpet is the one cool ramp; wood and
  plaster stay low-chroma; saturated colour is rationed to agents, screens,
  plants and the coffee LED — bright pixels are things that matter.
- **Per-cell hashing** varies carpet and vinyl tiles without storing anything.
- **A 3×5 bitmap font authored in-repo** keeps name labels, the clock and the
  status chips crisp at native resolution.
- **Day/night cycle** with keyframed window sky, an ambient tint that is
  *skipped entirely when its alpha is negligible* (the AI-farm fill-rate
  lesson), night skyline pixels in the windows, and monitor/arcade glow after
  dark.
- **Live state on the floor:** monitors light up when their agent works and
  scroll a line of "code", the arcade screen flickers when someone plays,
  progress bars hang over busy desks, and status icons (coffee, chat, arcade,
  working) sit beside name labels.
- **Aspect-true integer scaling.** The world renders at native 480×288 and
  blits to a display canvas sized as an integer multiple that fits the pane —
  ports AI-farm's off-centre/viewport-fit fix. The old CSS stretched the canvas
  non-uniformly.

### Changed — the panel is now an instrument

- Task list shows live progress bars; done tasks flip green.
- The agent card gained energy and morale bars.
- DEPLOY reads the Deployment Options checkboxes (they were decorative before).
- Pause and 1×/2×/4× speed controls overlay the world.
- **URL overrides** for repeatable captures, same idea as AI-farm's
  `?time=&weather=`: `?seed=` `?speed=` `?time=` `?paused=1`.

### Known limitations

1. **The LLM is still simulated.** Commands become seeded work units, not model
   calls. The agent *framework* pillar of the blueprint remains open — AI-farm's
   `llmPolicy` pattern (JSON-schema-constrained actions behind a validation
   firewall) is the intended shape.
2. **PONG and TETRIS are still placeholders.** The cabinet screen flickers; the
   games do not run.
3. **Meetings don't exist.** The meeting table is furniture; nobody books it.
4. **Water has no cooler physics.** The bottle never empties.

---

## [MVP] — 2026-03 — initial prototype

Reverse-engineered from a demo video: flat-rect canvas office, three agents,
Manager Office panel, fake 4-second task completion, arcade placeholder. See
`PRD.md` / `TECH_SPEC.md`.
