# AI‑Office — Technical Specification & Delivery Plan

**Source:** Demo video reverse‑engineering + PRD

---

## 1) System Architecture (Proposed)

### 1.1 Frontend
- **Renderer/Game Engine:** Phaser 3 or PixiJS + custom tile system
- **UI Layer:** React (or Svelte) overlay for panels; anchored to game viewport
- **State Management:** Zustand/Redux for UI + agent/task state
- **Networking:** WebSocket for realtime agent updates; REST for persistence

### 1.2 Backend
- **API:** Node/Express or FastAPI
- **Realtime:** WS gateway (Socket.IO or native WS)
- **LLM Orchestration:** Modular “agent engine” with prompt templates + tool actions
- **Persistence:** Postgres + Redis (for fast state + queues)
- **Storage:** S3/MinIO for video/log artifacts

### 1.3 Agent Orchestration
- **Agent Manager:** Creates agents, routes tasks, tracks state
- **Task Scheduler:** Assigns tasks, coordinates multi‑agent deployment
- **Action Executor:** Interfaces with external tools (shell, APIs)

---

## 2) Data Model (Detailed)

### 2.1 Agent
```json
{
  "id": "uuid",
  "name": "Lisa",
  "sprite": "agent_female_01",
  "state": "IDLE|WORKING|PLAYING|BREAK",
  "location": {"x": 14, "y": 9},
  "currentTaskId": "uuid|null",
  "createdAt": "iso",
  "updatedAt": "iso"
}
```

### 2.2 Task
```json
{
  "id": "uuid",
  "title": "Create a React app",
  "status": "PENDING|IN_PROGRESS|DONE|FAILED",
  "assignedAgents": ["uuid"],
  "steps": ["string"],
  "output": "string",
  "createdAt": "iso",
  "updatedAt": "iso"
}
```

### 2.3 World
```json
{
  "id": "office_main",
  "tilemap": "office_v1.json",
  "objects": [
    {"id": "pc_1", "type": "computer", "pos": {"x": 6, "y": 4}},
    {"id": "arcade_1", "type": "arcade", "pos": {"x": 16, "y": 8}}
  ]
}
```

---

## 3) UI/UX Spec

### 3.1 Game World
- Top‑down view, fixed camera
- Agents animate when moving/working/playing
- Clickable hotspots with hover highlight

### 3.2 Manager Office Panel
- **Left Column:** agent card, status, task list, command input
- **Right Column:** task board (tabs), current task summary, output log
- **Actions:** send, undo, clear, deploy, add task, save template

### 3.3 Arcade Panel
- Tabbed mini‑games (Pong/Tetris)
- Simple arrow controls

### 3.4 Full Report Panel
- Markdown/HTML viewer
- Scrollable

---

## 4) Agent + Task Flow Logic

1. User clicks computer → open manager panel
2. User enters NL command → NLP parses intent + targets
3. Task created + assigned to agent(s)
4. Agent state set to WORKING → pathfind to desk
5. Task execution → output log streamed to UI
6. On completion → state returns to IDLE, task marked DONE

---

## 5) NLP & Intent Schema

### 5.1 Supported Intents (v1)
- `create_app` (params: framework, name)
- `summarize_report` (params: report_id)
- `explain_concept` (params: topic)
- `wake_agent` (params: agent_name)
- `deploy_task` (params: task_id, agent_list)

### 5.2 Entity Extraction
- Agent names, task types, project names

---

## 6) APIs

### 6.1 REST
- `POST /tasks` create task
- `GET /tasks` list
- `PATCH /tasks/:id` update
- `GET /agents` list
- `PATCH /agents/:id/state`

### 6.2 WebSocket Events
- `agent.updated`
- `task.updated`
- `world.event`

---

## 7) Backlog (Epics → Stories)

### Epic 1: Core World + Agents
- Build tile‑based map renderer
- Add sprites + movement + pathfinding
- Agent states + status labels

### Epic 2: Manager Office Panel
- UI overlay with agent info + task list
- Command input + send/undo/clear
- Task board tabs + output log

### Epic 3: Task Engine
- NLP parsing
- Task creation and assignment
- Execution + progress updates

### Epic 4: Multi‑Agent Deployment
- Select agents + deploy options
- Progress summary
- State syncing

### Epic 5: Reports
- Full report panel
- Render markdown

### Epic 6: Arcade Mini‑Games
- Arcade UI
- Pong + Tetris integration

### Epic 7: Persistence
- Save/load tasks, agents, world state
- History tab

### Epic 8: Polish
- Animations, transitions
- Performance optimizations

---

## 8) Risks & Open Questions
- Which engine best for pixel‑art + UI overlay?
- NLP accuracy for freeform commands
- Balancing sim vs real external actions

---

## Appendix
If new insights appear from the demo video, iterate on intents + UI spec accordingly.
