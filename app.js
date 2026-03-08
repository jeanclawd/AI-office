const canvas = document.getElementById("worldCanvas");
const ctx = canvas.getContext("2d");

const TILE = 30;
const COLS = 30;
const ROWS = 18;

const world = {
  desks: [
    { id: "desk_noe", x: 6, y: 5 },
    { id: "desk_tibo", x: 10, y: 5 },
    { id: "desk_lisa", x: 14, y: 5 }
  ],
  arcade: { id: "arcade", x: 22, y: 11 }
};

const agents = [
  { id: "noe", name: "Noe", color: "#ffb454", x: 2, y: 4, state: "Idle", target: null, desk: world.desks[0] },
  { id: "tibo", name: "Tibo", color: "#6be675", x: 3, y: 10, state: "Idle", target: null, desk: world.desks[1] },
  { id: "lisa", name: "Lisa", color: "#8bb8ff", x: 4, y: 14, state: "Idle", target: null, desk: world.desks[2] }
];

let currentAgent = agents[0];
let tasks = [];
let taskId = 1;

const agentNameEl = document.getElementById("agentName");
const agentStatusEl = document.getElementById("agentStatus");
const taskListEl = document.getElementById("taskList");
const commandInput = document.getElementById("commandInput");
const outputLog = document.getElementById("outputLog");
const currentTaskEl = document.getElementById("currentTask");
const deploySummaryEl = document.getElementById("deploySummary");

const arcadePanel = document.getElementById("arcadePanel");
const arcadeScreen = document.getElementById("arcadeScreen");

function log(message) {
  const div = document.createElement("div");
  div.textContent = `> ${message}`;
  outputLog.prepend(div);
}

function setCurrentAgent(agent) {
  currentAgent = agent;
  agentNameEl.textContent = `AGENT: ${agent.name}`;
  agentStatusEl.textContent = `Status: ${agent.state}`;
  document.getElementById("agentIcon").style.background = agent.color;
}

function renderTasks() {
  taskListEl.innerHTML = "";
  tasks.forEach(task => {
    const li = document.createElement("li");
    li.className = "task-item";
    const status = document.createElement("span");
    status.className = `task-status ${task.status === "Done" ? "done" : ""}`;
    const text = document.createElement("span");
    text.textContent = task.title;
    li.append(status, text);
    taskListEl.appendChild(li);
  });

  const active = tasks.find(t => t.status === "In Progress");
  currentTaskEl.textContent = active ? active.title : "None";
  const activeCount = tasks.filter(t => t.status === "In Progress").length;
  deploySummaryEl.textContent = `${activeCount} / ${agents.length} agents`;
}

function createTask(command, targetAgents = [currentAgent]) {
  const task = {
    id: taskId++,
    title: command,
    status: "In Progress",
    agents: targetAgents.map(a => a.id)
  };
  tasks.unshift(task);
  renderTasks();

  targetAgents.forEach(agent => {
    agent.state = "Working";
    agent.target = { x: agent.desk.x, y: agent.desk.y };
  });

  log(`Task created: ${command} (assigned to ${targetAgents.map(a => a.name).join(", ")})`);

  setTimeout(() => {
    task.status = "Done";
    targetAgents.forEach(agent => {
      agent.state = "Idle";
      agent.target = null;
    });
    log(`Task completed: ${command}`);
    renderTasks();
    setCurrentAgent(currentAgent);
  }, 4000);
}

function handleCommand() {
  const cmd = commandInput.value.trim();
  if (!cmd) return;
  createTask(cmd);
  commandInput.value = "";
}

function deployAll() {
  const cmd = commandInput.value.trim() || "Deploy current task";
  createTask(cmd, agents);
}

// UI events

document.getElementById("sendBtn").addEventListener("click", handleCommand);
commandInput.addEventListener("keydown", e => {
  if (e.key === "Enter") handleCommand();
});

document.getElementById("clearBtn").addEventListener("click", () => commandInput.value = "");

document.getElementById("undoBtn").addEventListener("click", () => {
  commandInput.value = commandInput.value.slice(0, -1);
});

document.getElementById("deployBtn").addEventListener("click", deployAll);

document.getElementById("addTaskBtn").addEventListener("click", () => {
  commandInput.focus();
  commandInput.value = "Create a simple react app";
});

// Arcade panel

document.getElementById("arcadeCloseBtn").addEventListener("click", () => arcadePanel.classList.add("hidden"));

document.getElementById("arcadeExitBtn").addEventListener("click", () => arcadePanel.classList.add("hidden"));

document.getElementById("pongBtn").addEventListener("click", () => {
  arcadeScreen.textContent = "PONG — (MVP placeholder)";
});

document.getElementById("tetrisBtn").addEventListener("click", () => {
  arcadeScreen.textContent = "TETRIS — (MVP placeholder)";
});

// Panel controls

document.getElementById("minimizeBtn").addEventListener("click", () => {
  document.getElementById("panel-content").classList.toggle("hidden");
});

document.getElementById("closeBtn").addEventListener("click", () => {
  document.getElementById("panel").classList.toggle("hidden");
});

// World rendering
function drawWorld() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      ctx.fillStyle = y < 8 ? "#16324f" : "#2b2f3a";
      ctx.fillRect(x * TILE, y * TILE, TILE - 1, TILE - 1);
    }
  }

  // desks
  world.desks.forEach(desk => {
    ctx.fillStyle = "#c79b5b";
    ctx.fillRect(desk.x * TILE, desk.y * TILE, TILE, TILE);
  });

  // arcade
  ctx.fillStyle = "#9b59b6";
  ctx.fillRect(world.arcade.x * TILE, world.arcade.y * TILE, TILE, TILE);

  // agents
  agents.forEach(agent => {
    ctx.fillStyle = agent.color;
    ctx.fillRect(agent.x * TILE + 6, agent.y * TILE + 6, TILE - 12, TILE - 12);
    ctx.fillStyle = "#ffffff";
    ctx.font = "8px monospace";
    ctx.fillText(agent.name, agent.x * TILE + 2, agent.y * TILE - 2);
  });
}

function tick() {
  agents.forEach(agent => {
    if (agent.target) {
      if (Math.abs(agent.target.x - agent.x) > 0) {
        agent.x += Math.sign(agent.target.x - agent.x) * 0.04;
      }
      if (Math.abs(agent.target.y - agent.y) > 0) {
        agent.y += Math.sign(agent.target.y - agent.y) * 0.04;
      }
      if (Math.abs(agent.target.x - agent.x) < 0.05 && Math.abs(agent.target.y - agent.y) < 0.05) {
        agent.x = agent.target.x;
        agent.y = agent.target.y;
      }
    }
  });
  drawWorld();
  requestAnimationFrame(tick);
}

canvas.addEventListener("click", (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((e.clientX - rect.left) / TILE);
  const y = Math.floor((e.clientY - rect.top) / TILE);

  const desk = world.desks.find(d => d.x === x && d.y === y);
  if (desk) {
    const agent = agents.find(a => a.desk.id === desk.id);
    if (agent) {
      setCurrentAgent(agent);
      log(`Opened Manager Office for ${agent.name}`);
    }
    return;
  }

  if (x === world.arcade.x && y === world.arcade.y) {
    arcadePanel.classList.remove("hidden");
    const player = agents[0];
    player.state = "Playing";
    player.target = { x: world.arcade.x, y: world.arcade.y };
    setCurrentAgent(player);
    log(`${player.name} is playing at the arcade.`);
    return;
  }
});

setCurrentAgent(currentAgent);
renderTasks();
log("System ready. Click a desk to control an agent.");

tick();
