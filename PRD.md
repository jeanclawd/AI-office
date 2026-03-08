# AI‑Office — Product Requirements Document (PRD)

**Source:** Reverse‑engineered from demo video (`ai-office.mp4`) using Ponty analysis

## 1. Summary
AI‑Office is a 2D pixel‑art “office simulator” for controlling and observing multiple AI agents. Users issue natural‑language commands, assign tasks, and watch agents move through an office world and perform actions. A context‑aware control panel provides task management, reporting, and optional mini‑games.

## 2. Goals
- Provide a playful, visual interface for AI agent orchestration.
- Enable natural‑language task assignment and multi‑agent deployment.
- Maintain a responsive, real‑time status view of agents and tasks.

## 3. Non‑Goals (v1)
- Real-time multiplayer or shared sessions
- Complex economy or resource simulation
- Advanced 3D graphics

## 4. Target Users
- Builders/teams experimenting with multi‑agent workflows
- Demonstrators of AI agent orchestration

## 5. User Experience Overview
- Top‑down pixel‑art office scene with movable agents and interactive objects.
- Right‑side overlay panel (“Manager Office”) for commands, task board, outputs.
- Optional “Arcade Table” panel with mini‑games.

## 6. Core User Flows
1. **Issue a command:** Click a computer → Manager panel opens → Type NL command → Agent moves to desk → Status updates → Task appears in list.
2. **Deploy task to multiple agents:** Open task board → Configure deployment options → Select agents → Deploy → Agents switch to Working.
3. **Play mini‑game:** Click arcade table → Choose Pong/Tetris → Agent plays → Exit returns to office.
4. **View report:** Open task board → Full report → Read generated summary.

## 7. Functional Requirements

### 7.1 Office World
- Tile‑based 2D map with multiple rooms/areas.
- Interactive objects: computers, arcade table, decorative items.
- Click targets on objects trigger panel context.

### 7.2 Agents
- Multiple agents with unique names and sprites.
- State machine: Idle, Working, Playing, Sleeping/On‑Break.
- Pathfinding to destinations (desk, arcade table, hotspots).
- Status label displayed above each agent.

### 7.3 Control Panel (Manager Office)
- Overlay UI with **Agent Info**, **Task List**, **Command Input**, **Task Board**.
- Command input with Send/Undo/Clear.
- Task list with status icons and actions (Load, Deploy).
- Task board tabs: Current, History, Projects, Analytics, Settings.
- Output log area for agent responses and system messages.

### 7.4 Task System
- Task creation from NL command.
- Task states: Pending, In‑Progress, Completed, Failed.
- Multi‑agent deployment with progress summary.
- Optional templates for saving common tasks.

### 7.5 NLP / Agent Intelligence
- Parse commands into intents, agent targets, and parameters.
- Support commands like:
  - “Create a React app called my‑app.”
  - “Ask Lisa to explain optimization.”
  - “Wake up everyone.”

### 7.6 Mini‑Games
- Arcade table panel.
- Selectable mini‑games (Pong, Tetris).
- Basic on‑screen controls.

### 7.7 Reporting
- “Full Report” view for a detailed document.
- Viewable inside the panel as a static report.

### 7.8 Persistence
- Save/load office state, agent state, and task history.

## 8. Non‑Functional Requirements
- Real‑time updates with minimal UI lag.
- Responsive layout (desktop‑first).
- Clear visual feedback for status and progress.

## 9. Data Model (High‑Level)
- **Agent**: id, name, sprite, state, location, currentTaskId
- **Task**: id, title, status, assignedAgents, createdAt, updatedAt, output
- **World**: mapId, objects[], hotspots[]

## 10. Milestones (Suggested)
1. **MVP**: Map + agents + basic panel + NL command to task + movement.
2. **Task Board**: Multi‑agent deployment, progress, history.
3. **Reports**: Full report view.
4. **Mini‑games**: Arcade panel integration.
5. **Polish**: Persistence, analytics, settings.

## 11. Open Questions
- Which game engine or UI framework? (e.g., Phaser, Pixi.js)
- Which LLM / agent backend?
- How tasks map to real external actions vs simulation only?

---

## Appendix: Source
See `/requirements.md` for the raw reverse‑engineered notes.
