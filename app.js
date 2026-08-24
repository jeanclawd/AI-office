/**
 * AI-Office front end: wires the deterministic sim (sim.js) to the procedural
 * renderer (render.js) and the Manager Office panel.
 *
 * URL overrides (repeatable captures, same idea as AI-farm's ?time=&weather=):
 *   ?seed=42     seed the episode
 *   ?speed=2     start at 2x (1|2|4)
 *   ?time=0.6    freeze the time of day (0=morning, ~0.55-0.8=night)
 *   ?paused=1    start paused
 */
"use strict";

(function () {
  var Sim = OfficeSim, R = OfficeRender;

  // --- Boot -------------------------------------------------------------------

  var params = new URLSearchParams(location.search);
  var seed = params.has("seed") ? Number(params.get("seed")) >>> 0 : 20260824;
  var timeOverride = params.has("time") ? Number(params.get("time")) : null;
  var speed = [1, 2, 4].indexOf(Number(params.get("speed"))) !== -1 ? Number(params.get("speed")) : 1;
  var paused = params.get("paused") === "1";

  R.init();
  var state = Sim.createState(seed);

  var canvas = document.getElementById("worldCanvas");
  var ctx = canvas.getContext("2d");

  /** Integer-friendly fit: largest scale of the native frame that fits the pane. */
  function fitCanvas() {
    var pane = document.getElementById("world");
    var maxW = pane.clientWidth || R.W;
    var scale = Math.max(1, Math.floor(maxW / R.W));
    if (R.W * scale > maxW) scale = Math.max(1, scale - 1);
    canvas.width = R.W * scale;
    canvas.height = R.H * scale;
  }
  fitCanvas();
  window.addEventListener("resize", fitCanvas);

  // --- UI handles --------------------------------------------------------------

  var agentNameEl = document.getElementById("agentName");
  var agentStatusEl = document.getElementById("agentStatus");
  var energyBarEl = document.getElementById("energyBar");
  var moraleBarEl = document.getElementById("moraleBar");
  var taskListEl = document.getElementById("taskList");
  var commandInput = document.getElementById("commandInput");
  var outputLog = document.getElementById("outputLog");
  var currentTaskEl = document.getElementById("currentTask");
  var deploySummaryEl = document.getElementById("deploySummary");
  var arcadePanel = document.getElementById("arcadePanel");
  var arcadeScreen = document.getElementById("arcadeScreen");
  var pauseBtn = document.getElementById("pauseBtn");
  var speedBtn = document.getElementById("speedBtn");

  var AGENT_COLORS = { noe: "#ffb454", tibo: "#6be675", lisa: "#8bb8ff" };
  var selectedId = state.agents[0].id;

  function selected() { return Sim.agentById(state, selectedId); }

  function setCurrentAgent(agent) {
    selectedId = agent.id;
    document.getElementById("agentIcon").style.background = AGENT_COLORS[agent.id] || "#888";
    refreshAgentCard();
  }

  function refreshAgentCard() {
    var a = selected();
    agentNameEl.textContent = "AGENT: " + a.name;
    var label = a.state.charAt(0).toUpperCase() + a.state.slice(1);
    agentStatusEl.textContent = "Status: " + label;
    energyBarEl.style.width = Math.round(a.energy) + "%";
    moraleBarEl.style.width = Math.round(a.morale) + "%";
  }

  // --- Tasks & log ----------------------------------------------------------------

  function renderTasks() {
    taskListEl.innerHTML = "";
    state.tasks.slice(0, 8).forEach(function (task) {
      var li = document.createElement("li");
      li.className = "task-item";
      var status = document.createElement("span");
      status.className = "task-status" + (task.status === "Done" ? " done" : "");
      var text = document.createElement("span");
      text.className = "task-text";
      var pct = Math.round(100 * task.progress / task.units);
      text.textContent = "#" + task.id + " " + task.title;
      var bar = document.createElement("span");
      bar.className = "task-progress";
      var fill = document.createElement("span");
      fill.className = "task-progress-fill";
      fill.style.width = pct + "%";
      bar.appendChild(fill);
      li.append(status, text, bar);
      taskListEl.appendChild(li);
    });

    var active = state.tasks.find(function (t) { return t.status === "In Progress"; });
    currentTaskEl.textContent = active ? active.title : "None";
    var busy = state.agents.filter(function (a) { return a.taskId !== null; }).length;
    deploySummaryEl.textContent = busy + " / " + state.agents.length + " agents";
  }

  var lastEventId = -1;
  function drainEvents() {
    var fresh = state.events.filter(function (e) { return e.id > lastEventId; });
    if (!fresh.length) return;
    fresh.forEach(function (e) {
      var div = document.createElement("div");
      div.textContent = "> [t" + e.tick + "] " + e.msg;
      outputLog.prepend(div);
    });
    while (outputLog.childNodes.length > 60) outputLog.removeChild(outputLog.lastChild);
    lastEventId = fresh[fresh.length - 1].id;
    renderTasks();
  }

  function checkedAgents() {
    var boxes = document.querySelectorAll("#deployOptions input[type=checkbox]");
    var ids = [];
    boxes.forEach(function (b) { if (b.checked) ids.push(b.dataset.agent); });
    return ids.length ? ids : [selectedId];
  }

  function handleCommand() {
    var cmd = commandInput.value.trim();
    if (!cmd) return;
    Sim.assignTask(state, cmd, [selectedId]);
    commandInput.value = "";
    renderTasks();
  }

  function deployAll() {
    var cmd = commandInput.value.trim() || "Deploy current task";
    Sim.assignTask(state, cmd, checkedAgents());
    commandInput.value = "";
    renderTasks();
  }

  // --- UI events -------------------------------------------------------------------

  document.getElementById("sendBtn").addEventListener("click", handleCommand);
  commandInput.addEventListener("keydown", function (e) { if (e.key === "Enter") handleCommand(); });
  document.getElementById("clearBtn").addEventListener("click", function () { commandInput.value = ""; });
  document.getElementById("undoBtn").addEventListener("click", function () {
    commandInput.value = commandInput.value.slice(0, -1);
  });
  document.getElementById("deployBtn").addEventListener("click", deployAll);
  document.getElementById("addTaskBtn").addEventListener("click", function () {
    commandInput.focus();
    commandInput.value = "Create a simple react app";
  });

  pauseBtn.addEventListener("click", function () {
    paused = !paused;
    pauseBtn.textContent = paused ? "▶" : "❚❚";
  });
  speedBtn.addEventListener("click", function () {
    speed = speed === 1 ? 2 : speed === 2 ? 4 : 1;
    speedBtn.textContent = speed + "x";
  });
  pauseBtn.textContent = paused ? "▶" : "❚❚";
  speedBtn.textContent = speed + "x";

  // Arcade panel
  document.getElementById("arcadeCloseBtn").addEventListener("click", function () { arcadePanel.classList.add("hidden"); });
  document.getElementById("arcadeExitBtn").addEventListener("click", function () { arcadePanel.classList.add("hidden"); });
  document.getElementById("pongBtn").addEventListener("click", function () {
    arcadeScreen.textContent = "PONG — " + selected().name + " is on it.";
    Sim.sendToArcade(state, selectedId);
  });
  document.getElementById("tetrisBtn").addEventListener("click", function () {
    arcadeScreen.textContent = "TETRIS — " + selected().name + " is on it.";
    Sim.sendToArcade(state, selectedId);
  });

  // Panel controls
  document.getElementById("minimizeBtn").addEventListener("click", function () {
    document.getElementById("panel-content").classList.toggle("hidden");
  });
  document.getElementById("closeBtn").addEventListener("click", function () {
    document.getElementById("panel").classList.toggle("hidden");
  });

  // World clicks: select an agent by desk, or open the arcade.
  canvas.addEventListener("click", function (e) {
    var rect = canvas.getBoundingClientRect();
    var scaleX = canvas.width / rect.width, scaleY = canvas.height / rect.height;
    var pxScale = canvas.width / R.W;
    var x = Math.floor((e.clientX - rect.left) * scaleX / (R.TILE * pxScale));
    var y = Math.floor((e.clientY - rect.top) * scaleY / (R.TILE * pxScale));

    var desk = Sim.MAP.desks.find(function (d) { return d.x === x && (d.y === y || d.y + 1 === y); });
    if (desk) {
      var agent = state.agents[Sim.MAP.desks.indexOf(desk)];
      setCurrentAgent(agent);
      appendLocal("Opened Manager Office for " + agent.name + ".");
      return;
    }
    var arc = Sim.MAP.arcade;
    if (x === arc.x && y >= arc.y - 1 && y <= arc.y + 1) {
      arcadePanel.classList.remove("hidden");
      return;
    }
    // otherwise: select the nearest agent
    var best = null, bestD = 2.5;
    state.agents.forEach(function (a) {
      var d = Math.abs(a.x - x) + Math.abs(a.y - y);
      if (d < bestD) { best = a; bestD = d; }
    });
    if (best) setCurrentAgent(best);
  });

  function appendLocal(msg) {
    var div = document.createElement("div");
    div.textContent = "> " + msg;
    outputLog.prepend(div);
  }

  // --- Main loop: fixed-timestep sim, rAF render ------------------------------------

  var msPerTick = 1000 / Sim.CFG.tickHz;
  var acc = 0, last = performance.now();

  function loop(now) {
    var dt = Math.min(250, now - last);
    last = now;
    if (!paused) {
      acc += dt * speed;
      var safety = 64;
      while (acc >= msPerTick && safety-- > 0) {
        Sim.step(state);
        acc -= msPerTick;
      }
    }
    R.draw(ctx, state, { timeOverride: timeOverride });
    drainEvents();
    refreshAgentCard();
    requestAnimationFrame(loop);
  }

  setCurrentAgent(state.agents[0]);
  renderTasks();
  appendLocal("System ready. Click a desk to control an agent. Try ?seed= ?speed= ?time= in the URL.");
  requestAnimationFrame(loop);
})();
