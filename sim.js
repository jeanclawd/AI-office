/**
 * Deterministic office-simulation core.
 *
 * This is the AI-Office analogue of AI-farm's headless arena reducer: all game
 * state lives in one plain object, advanced one tick at a time by `step(state)`,
 * driven by a seeded PRNG instead of `Math.random()`. Same seed => same
 * episode, byte for byte — in the browser and under Node.
 *
 * Dual-use, no dependencies:
 *   browser: <script src="sim.js"></script>  -> window.OfficeSim
 *   node:    node sim.js --ticks 2000 --seed 42   (headless smoke run)
 *
 * Agents are little state machines: idle -> walking -> working, with coffee
 * breaks when energy runs out, water-cooler chats and arcade sessions when
 * morale sags. Tasks are real work queues with progress, not timers.
 */
"use strict";

var OfficeSim = (function () {
  // --- Grid ------------------------------------------------------------------

  var COLS = 30;
  var ROWS = 18;

  /** Tile kinds. WALL/WINDOW and furniture block movement. */
  var T = {
    FLOOR: 0,   // vinyl, break area
    CARPET: 1,  // work area
    WALL: 2,
    WINDOW: 3,
    DESK: 4,
    CHAIR: 5,   // walkable: an agent sits here to work
    TABLE: 6,   // meeting table
    COFFEE: 7,
    COOLER: 8,
    ARCADE: 9,
    PLANT: 10,
    DOOR: 11
  };

  // --- Seeded RNG (mulberry32) + stable hash ----------------------------------

  /** Deterministic PRNG. Same seed => same episode, always. */
  function makeRng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** Stable per-cell hash in [0,1) — varies tiles without storing anything. */
  function hash2(x, y, salt) {
    var h = Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1) ^ Math.imul(salt || 0, 0x9e3779b1);
    h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
    h ^= h >>> 13;
    return (h >>> 0) / 4294967296;
  }

  // --- Tuning ------------------------------------------------------------------

  var CFG = {
    tickHz: 8,             // sim ticks per second at 1x speed
    dayLenTicks: 1920,     // one office day = 4 min at 1x
    walkSpeed: 0.18,       // tiles per tick
    energyMax: 100,
    moraleMax: 100,
    workDrain: 0.55,       // energy per working tick
    idleRegen: 0.12,
    coffeeRegen: 3.5,      // energy per tick at the machine
    coffeeTicks: 22,
    lowEnergy: 18,         // forced coffee break threshold
    chatMorale: 2.2,       // morale per tick at the cooler
    chatTicks: 26,
    arcadeMorale: 3.0,
    arcadeTicks: 34,
    lowMorale: 30,
    moraleDecayWorking: 0.10,
    moraleDecayIdle: 0.03,
    baseWorkRate: 1.0,     // task units per tick, scaled by energy & morale
    taskUnitsMin: 90,
    taskUnitsSpread: 120,
    wanderChance: 0.012,   // per idle tick
    maxLogEvents: 400
  };

  // --- Office map ----------------------------------------------------------------

  /**
   * Builds the static office layout. Row 0 is the window wall; the top half is
   * carpeted work area, the bottom half vinyl break area, split by a rug seam.
   */
  function buildMap() {
    var grid = [];
    for (var y = 0; y < ROWS; y++) {
      grid.push([]);
      for (var x = 0; x < COLS; x++) {
        var t;
        if (y === 0) t = (x >= 3 && x <= 26 && x % 4 !== 0) ? T.WINDOW : T.WALL;
        else if (y === ROWS - 1 || x === 0 || x === COLS - 1) t = T.WALL;
        else t = y <= 8 ? T.CARPET : T.FLOOR;
        grid[y].push(t);
      }
    }
    grid[ROWS - 1][15] = T.DOOR;

    function put(x, y, t) { grid[y][x] = t; }

    // Desks: desk tile with chair (work spot) below it.
    var desks = [
      { id: "desk_noe", x: 6, y: 5 },
      { id: "desk_tibo", x: 10, y: 5 },
      { id: "desk_lisa", x: 14, y: 5 }
    ];
    desks.forEach(function (d) {
      put(d.x, d.y, T.DESK);
      put(d.x, d.y + 1, T.CHAIR);
      d.work = { x: d.x, y: d.y + 1 };
    });

    // Meeting table 3x2, right side of the work area.
    for (var ty = 3; ty <= 4; ty++) for (var tx = 20; tx <= 22; tx++) put(tx, ty, T.TABLE);

    // Break-area fixtures. Interaction spot is the tile just in front.
    var coffee = { x: 27, y: 3 }; put(coffee.x, coffee.y, T.COFFEE); coffee.spot = { x: 26, y: 3 };
    var cooler = { x: 27, y: 7 }; put(cooler.x, cooler.y, T.COOLER); cooler.spot = { x: 26, y: 7 };
    var arcade = { x: 22, y: 11 }; put(arcade.x, arcade.y, T.ARCADE); arcade.spot = { x: 22, y: 12 };

    [{ x: 3, y: 2 }, { x: 17, y: 2 }, { x: 27, y: 12 }, { x: 3, y: 12 }, { x: 27, y: 1 }]
      .forEach(function (p) { put(p.x, p.y, T.PLANT); });

    return { grid: grid, desks: desks, coffee: coffee, cooler: cooler, arcade: arcade };
  }

  var MAP = buildMap();

  function walkable(x, y) {
    if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return false;
    var t = MAP.grid[y][x];
    return t === T.FLOOR || t === T.CARPET || t === T.CHAIR || t === T.DOOR;
  }

  // --- Pathfinding (BFS, 4-neighbour) ------------------------------------------

  function bfs(from, to) {
    var fx = Math.round(from.x), fy = Math.round(from.y);
    if (fx === to.x && fy === to.y) return [];
    var prev = {};
    var queue = [[fx, fy]];
    prev[fx + "," + fy] = null;
    var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    while (queue.length) {
      var cur = queue.shift();
      for (var i = 0; i < dirs.length; i++) {
        var nx = cur[0] + dirs[i][0], ny = cur[1] + dirs[i][1];
        var key = nx + "," + ny;
        if (prev[key] !== undefined || !walkable(nx, ny)) continue;
        prev[key] = cur;
        if (nx === to.x && ny === to.y) {
          var path = [{ x: nx, y: ny }];
          var p = cur;
          while (p && !(p[0] === fx && p[1] === fy)) {
            path.unshift({ x: p[0], y: p[1] });
            p = prev[p[0] + "," + p[1]];
          }
          return path;
        }
        queue.push([nx, ny]);
      }
    }
    return null; // unreachable
  }

  // --- State ---------------------------------------------------------------------

  var AGENT_DEFS = [
    { id: "noe", name: "Noe", desk: "desk_noe" },
    { id: "tibo", name: "Tibo", desk: "desk_tibo" },
    { id: "lisa", name: "Lisa", desk: "desk_lisa" }
  ];

  function createState(seed) {
    var state = {
      seed: seed >>> 0,
      rng: makeRng(seed),
      tick: 0,
      taskSeq: 1,
      tasks: [],
      events: [],
      eventSeq: 0,
      stats: { tasksDone: 0, coffees: 0, chats: 0, arcadeRuns: 0, unitsDone: 0 },
      agents: AGENT_DEFS.map(function (def, i) {
        var desk = MAP.desks[i];
        return {
          id: def.id,
          name: def.name,
          deskId: def.desk,
          desk: desk,
          x: 2 + i, y: 10 + i * 2,
          path: [],
          state: "idle",       // idle|walking|working|coffee|chatting|arcade
          next: null,           // state to enter when the walk ends
          stateTicks: 0,
          energy: 82,
          morale: 70,
          taskId: null,
          coffees: 0, chats: 0, arcadeRuns: 0, unitsDone: 0
        };
      })
    };
    logEvent(state, "System online. " + state.agents.length + " agents on the floor. Seed " + state.seed + ".");
    return state;
  }

  function logEvent(state, msg) {
    state.events.push({ id: state.eventSeq++, tick: state.tick, msg: msg });
    if (state.events.length > CFG.maxLogEvents) state.events.splice(0, state.events.length - CFG.maxLogEvents);
  }

  // --- Tasks -----------------------------------------------------------------------

  /** Queue a task for the given agent ids. Work units are seeded-random. */
  function assignTask(state, title, agentIds) {
    var task = {
      id: state.taskSeq++,
      title: title,
      units: Math.round(CFG.taskUnitsMin + state.rng() * CFG.taskUnitsSpread),
      progress: 0,
      status: "In Progress",
      agents: agentIds.slice(),
      createdTick: state.tick,
      completedTick: null
    };
    state.tasks.unshift(task);
    agentIds.forEach(function (id) {
      var a = agentById(state, id);
      if (a && a.taskId === null) claimTask(state, a, task);
    });
    logEvent(state, "Task #" + task.id + " “" + title + "” queued for " + names(state, agentIds) + " (" + task.units + " units).");
    return task;
  }

  function agentById(state, id) {
    for (var i = 0; i < state.agents.length; i++) if (state.agents[i].id === id) return state.agents[i];
    return null;
  }

  function names(state, ids) {
    return ids.map(function (id) { var a = agentById(state, id); return a ? a.name : id; }).join(", ");
  }

  function taskById(state, id) {
    for (var i = 0; i < state.tasks.length; i++) if (state.tasks[i].id === id) return state.tasks[i];
    return null;
  }

  function claimTask(state, agent, task) {
    agent.taskId = task.id;
    walkTo(agent, agent.desk.work, "working");
  }

  /** First open task this agent is assigned to (they queue up). */
  function nextTaskFor(state, agent) {
    for (var i = state.tasks.length - 1; i >= 0; i--) {
      var t = state.tasks[i];
      if (t.status === "In Progress" && t.agents.indexOf(agent.id) !== -1) return t;
    }
    return null;
  }

  /** Send an agent to the arcade on demand (UI click). */
  function sendToArcade(state, agentId) {
    var a = agentById(state, agentId);
    if (!a) return;
    a.taskId = null;
    walkTo(a, MAP.arcade.spot, "arcade");
    logEvent(state, a.name + " heads to the arcade cabinet.");
  }

  // --- Movement ----------------------------------------------------------------------

  function walkTo(agent, target, nextState) {
    var path = bfs(agent, target);
    if (path === null) { agent.state = "idle"; agent.next = null; return; }
    agent.path = path;
    agent.next = nextState;
    agent.state = path.length ? "walking" : nextState;
    agent.stateTicks = 0;
  }

  function stepWalk(agent) {
    if (!agent.path.length) { arrive(agent); return; }
    var node = agent.path[0];
    var dx = node.x - agent.x, dy = node.y - agent.y;
    var dist = Math.abs(dx) + Math.abs(dy);
    if (dist <= CFG.walkSpeed) {
      agent.x = node.x; agent.y = node.y;
      agent.path.shift();
      if (!agent.path.length) arrive(agent);
    } else if (Math.abs(dx) > 1e-9) {
      agent.x += Math.sign(dx) * CFG.walkSpeed;
      agent.facing = dx > 0 ? 1 : -1;
    } else {
      agent.y += Math.sign(dy) * CFG.walkSpeed;
    }
  }

  function arrive(agent) {
    agent.state = agent.next || "idle";
    agent.next = null;
    agent.stateTicks = 0;
  }

  // --- Behaviour -------------------------------------------------------------------------

  function stepAgent(state, agent) {
    agent.stateTicks++;
    switch (agent.state) {
      case "walking": stepWalk(agent); break;

      case "working": {
        var task = agent.taskId !== null ? taskById(state, agent.taskId) : null;
        if (!task || task.status !== "In Progress") { agent.taskId = null; agent.state = "idle"; break; }
        agent.energy = Math.max(0, agent.energy - CFG.workDrain);
        agent.morale = Math.max(0, agent.morale - CFG.moraleDecayWorking);
        var rate = CFG.baseWorkRate * (0.4 + 0.6 * agent.energy / CFG.energyMax)
                                    * (0.75 + 0.25 * agent.morale / CFG.moraleMax);
        task.progress += rate;
        agent.unitsDone += rate;
        state.stats.unitsDone += rate;
        if (task.progress >= task.units) {
          task.progress = task.units;
          task.status = "Done";
          task.completedTick = state.tick;
          state.stats.tasksDone++;
          logEvent(state, "Task #" + task.id + " “" + task.title + "” completed by " + names(state, task.agents) + " in " + (state.tick - task.createdTick) + " ticks.");
          task.agents.forEach(function (id) {
            var a = agentById(state, id);
            if (a && a.taskId === task.id) { a.taskId = null; a.state = a.state === "working" ? "idle" : a.state; }
          });
          break;
        }
        if (agent.energy <= CFG.lowEnergy) {
          agent.coffees++; state.stats.coffees++;
          logEvent(state, agent.name + " is running on fumes — coffee break.");
          walkTo(agent, MAP.coffee.spot, "coffee");
        }
        break;
      }

      case "coffee":
        agent.energy = Math.min(CFG.energyMax, agent.energy + CFG.coffeeRegen);
        if (agent.stateTicks >= CFG.coffeeTicks || agent.energy >= CFG.energyMax - 2) {
          if (agent.taskId !== null) walkTo(agent, agent.desk.work, "working");
          else agent.state = "idle";
          if (agent.state !== "coffee") logEvent(state, agent.name + " is caffeinated (" + Math.round(agent.energy) + "% energy).");
        }
        break;

      case "chatting":
        agent.morale = Math.min(CFG.moraleMax, agent.morale + CFG.chatMorale);
        agent.energy = Math.min(CFG.energyMax, agent.energy + CFG.idleRegen);
        if (agent.stateTicks >= CFG.chatTicks) { agent.state = "idle"; }
        break;

      case "arcade":
        agent.morale = Math.min(CFG.moraleMax, agent.morale + CFG.arcadeMorale);
        if (agent.stateTicks >= CFG.arcadeTicks) {
          logEvent(state, agent.name + " tops the arcade leaderboard. Morale restored.");
          if (agent.taskId !== null) walkTo(agent, agent.desk.work, "working");
          else agent.state = "idle";
        }
        break;

      case "idle":
      default: {
        agent.energy = Math.min(CFG.energyMax, agent.energy + CFG.idleRegen);
        agent.morale = Math.max(0, agent.morale - CFG.moraleDecayIdle);
        // Recover morale before claiming more work — a burnt-out agent works
        // at a fraction of the rate, so the break pays for itself.
        if (agent.morale <= CFG.lowMorale) {
          if (state.rng() < 0.5) {
            agent.chats++; state.stats.chats++;
            logEvent(state, agent.name + " drifts to the water cooler.");
            walkTo(agent, MAP.cooler.spot, "chatting");
          } else {
            agent.arcadeRuns++; state.stats.arcadeRuns++;
            logEvent(state, agent.name + " sneaks off for a round of PONG.");
            walkTo(agent, MAP.arcade.spot, "arcade");
          }
          break;
        }
        // Then pick up queued work.
        var next = nextTaskFor(state, agent);
        if (next) { claimTask(state, agent, next); break; }
        // Occasional wander keeps the floor alive.
        if (state.rng() < CFG.wanderChance) {
          var tx = 1 + Math.floor(state.rng() * (COLS - 2));
          var ty = 1 + Math.floor(state.rng() * (ROWS - 2));
          if (walkable(tx, ty)) walkTo(agent, { x: tx, y: ty }, "idle");
        }
        break;
      }
    }
  }

  /** Advance the whole office by one tick. Fixed agent order keeps it deterministic. */
  function step(state) {
    state.tick++;
    for (var i = 0; i < state.agents.length; i++) stepAgent(state, state.agents[i]);
  }

  /** Time of day in [0,1). 0 = 9am-ish morning light, 0.5 = night. */
  function timeOfDay(state, override) {
    if (override !== null && override !== undefined && !isNaN(override)) return ((override % 1) + 1) % 1;
    return (state.tick % CFG.dayLenTicks) / CFG.dayLenTicks;
  }

  // --- Headless digest ----------------------------------------------------------------

  /** FNV-1a over the quantised agent stream — cheap determinism check. */
  function digest(state) {
    var h = 0x811c9dc5;
    function mixIn(v) {
      h ^= v & 0xff; h = Math.imul(h, 0x01000193);
      h ^= (v >> 8) & 0xff; h = Math.imul(h, 0x01000193);
    }
    state.agents.forEach(function (a) {
      mixIn(Math.round(a.x * 16)); mixIn(Math.round(a.y * 16));
      mixIn(Math.round(a.energy * 4)); mixIn(Math.round(a.morale * 4));
    });
    mixIn(state.stats.tasksDone); mixIn(Math.round(state.stats.unitsDone));
    return (h >>> 0).toString(16);
  }

  return {
    COLS: COLS, ROWS: ROWS, T: T, CFG: CFG, MAP: MAP,
    makeRng: makeRng, hash2: hash2,
    createState: createState, step: step,
    assignTask: assignTask, sendToArcade: sendToArcade,
    agentById: agentById, walkable: walkable,
    timeOfDay: timeOfDay, digest: digest
  };
})();

if (typeof module !== "undefined" && module.exports) module.exports = OfficeSim;

// --- Headless CLI (node sim.js --ticks 2000 --seed 42) --------------------------------

if (typeof process !== "undefined" && typeof require !== "undefined" &&
    typeof module !== "undefined" && require.main === module) {
  (function () {
    var args = process.argv.slice(2);
    function opt(name, dflt) {
      var i = args.indexOf("--" + name);
      return i !== -1 && args[i + 1] !== undefined ? Number(args[i + 1]) : dflt;
    }
    var ticks = opt("ticks", 2000);
    var seed = opt("seed", 42);
    var quiet = args.indexOf("--quiet") !== -1;

    var BACKLOG = [
      "Create a simple react app", "Fix the login bug", "Write Q3 board deck",
      "Refactor billing service", "Draft the launch blog post", "Ship the mobile beta",
      "Migrate CI to the new runners", "Design the onboarding flow"
    ];

    var state = OfficeSim.createState(seed);
    var everyone = state.agents.map(function (a) { return a.id; });
    for (var t = 0; t < ticks; t++) {
      // Deterministic scripted backlog: a task drops every 250 ticks, rotating
      // between single assignees and an all-hands deploy.
      if (t % 250 === 0) {
        var i = t / 250;
        var title = BACKLOG[i % BACKLOG.length];
        var who = i % 3 === 2 ? everyone : [everyone[i % everyone.length]];
        OfficeSim.assignTask(state, title, who);
      }
      OfficeSim.step(state);
    }

    if (!quiet) {
      console.log("AI-Office headless run — seed " + seed + ", " + ticks + " ticks (" +
        (ticks / OfficeSim.CFG.tickHz).toFixed(0) + "s of office time at 1x)\n");
      console.log("agent   tasks-units  coffees  chats  arcade  energy  morale  state");
      state.agents.forEach(function (a) {
        function pad(s, n) { s = String(s); while (s.length < n) s += " "; return s; }
        console.log(pad(a.name, 8) + pad(Math.round(a.unitsDone), 13) + pad(a.coffees, 9) +
          pad(a.chats, 7) + pad(a.arcadeRuns, 8) + pad(Math.round(a.energy) + "%", 8) +
          pad(Math.round(a.morale) + "%", 8) + a.state);
      });
      var s = state.stats;
      console.log("\ntasks completed: " + s.tasksDone + "/" + state.tasks.length +
        "   total units: " + Math.round(s.unitsDone) +
        "   coffees: " + s.coffees + "   chats: " + s.chats + "   arcade: " + s.arcadeRuns);
      console.log("last events:");
      state.events.slice(-5).forEach(function (e) {
        console.log("  [t" + e.tick + "] " + e.msg);
      });
    }
    console.log("digest: " + OfficeSim.digest(state));
  })();
}
