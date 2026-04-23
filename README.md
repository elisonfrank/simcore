<p align="center">
  <strong><span style="color: #00d4aa">Sim</span><span style="color: #7c5cfc">Core</span></strong>
</p>

<h1 align="center">SimCore</h1>

<p align="center">
  <strong>Open-source social simulation engine powered by LLM agents</strong>
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> &bull;
  <a href="#scenarios">Scenarios</a> &bull;
  <a href="#how-it-works">How It Works</a> &bull;
  <a href="#dashboard">Dashboard</a> &bull;
  <a href="#configuration">Configuration</a> &bull;
  <a href="#api">API</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/python-3.11+-blue?logo=python&logoColor=white" alt="Python 3.11+">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="MIT License">
  <img src="https://img.shields.io/badge/LLM-multi--provider-purple" alt="Multi-LLM">
  <img src="https://img.shields.io/badge/status-alpha-orange" alt="Alpha">
</p>

---

Create autonomous agents with personalities, memories, and goals. Drop them into a virtual world defined in YAML. Watch emergent behavior unfold in real-time through an interactive dashboard.

SimCore isn't a toy demo — it's a **framework** for running social simulations at any scale, with any LLM provider, on any scenario you can imagine.

## Quick Start

```bash
# Install
pip install simcore-ai

# Run a demo (no API key needed)
simcore run scenarios/marketplace/config.yaml --dashboard --demo

# Run with real LLM
export OPENAI_API_KEY=sk-...
simcore run scenarios/marketplace/config.yaml --dashboard
```

Open `http://localhost:5173` and watch the simulation live.

## What Happens

1. Agents wake up in their starting locations
2. Each tick (1 simulated hour), every agent **observes** their surroundings, **thinks** using an LLM, and **acts**
3. Agents talk to each other, trade, move between locations, work, rest
4. Their **memories** accumulate — they remember conversations, form opinions, build relationships
5. **Scheduled events** disrupt the world — a competitor opens, it starts raining, a crisis hits
6. You can **inject events** mid-simulation through the dashboard
7. Emergent stories arise from the interactions

## Scenarios

SimCore ships with 4 ready-to-run scenarios:

### Marketplace
A local market economy with competing shops, consumers, and an incoming discount chain threat.
- 5 agents: shop owners, consumers, a trader
- Events: competitor announcement, heavy rain

### Urban Life
A day in a small city — politics, protests, infrastructure failures, and community bonds.
- 6 agents: council member, engineer, hospital director, activist, cafe owner, journalist
- Events: student protest, water main break, leaked document scandal

### Outbreak
A mysterious illness hits a small town. Residents face impossible choices between self-preservation and community.
- 6 agents: the only doctor, the mayor, a teacher, a farmer, a pastor, the store owner who controls medicine supply
- Events: first cases, panic buying, child falls ill, treatment found, aid arrives

### High School
Social dynamics, cliques, bullying, and the pressure to fit in.
- 5 agents: popular leader, quiet artist, star athlete, class bully, overachiever
- Events: public bullying incident, prom drama, academic breakdown

```bash
simcore run scenarios/epidemic/config.yaml --dashboard --demo
```

## How It Works

```
Each Tick (1 simulated hour):
┌──────────────────────────────────────────┐
│  1. Clock advances                       │
│  2. Scheduled events fire                │
│  3. For each agent (parallel):           │
│     Observe → Think (LLM) → Act         │
│  4. Interactions resolve                 │
│  5. Every 12 ticks: agents reflect       │
│  6. State broadcasts via WebSocket       │
└──────────────────────────────────────────┘
```

### Agent Architecture

Every agent has:

- **Persona** — Name, age, profession, Big Five personality traits (OCEAN), goals, backstory
- **Memory** — Short-term (recent events), long-term (important moments), relationships (sentiment toward other agents), periodic reflections
- **State** — Current location, mood, energy, resources, current action

The LLM receives the agent's full persona, memory context, and current observation, then decides what to do: move, speak, trade, work, rest, or observe.

### Personality Model

Agents use the [Big Five (OCEAN)](https://en.wikipedia.org/wiki/Big_Five_personality_traits) model:

| Trait | High | Low |
|---|---|---|
| **Openness** | Curious, creative | Practical, conventional |
| **Conscientiousness** | Organized, disciplined | Flexible, spontaneous |
| **Extraversion** | Outgoing, energetic | Reserved, solitary |
| **Agreeableness** | Cooperative, trusting | Competitive, skeptical |
| **Neuroticism** | Sensitive, anxious | Calm, resilient |

These traits shape how agents make decisions, who they interact with, and how they respond to events.

## Dashboard

The real-time dashboard shows:

- **Grid View** — Animated canvas with agents moving between locations, particle trails, glowing dots
- **Agent Inspector** — Click any agent to see their thoughts, memory, mood, energy, personality, relationships
- **Log Stream** — Live feed of every action, color-coded by type
- **Timeline** — Play/pause/stop controls, progress bar, simulation clock
- **Event Injector** — Type an event and inject it into the running simulation
- **Stats Bar** — Agent count, average mood/energy, LLM call stats

## Configuration

Scenarios are defined in YAML:

```yaml
simulation:
  name: "My Scenario"
  time_step: "1 hour"
  duration: "3 days"
  seed: 42

environment:
  type: grid
  size: [20, 20]
  locations:
    - name: "Town Square"
      type: commercial
      position: [10, 10]
      capacity: 30

agents:
  - name: "Alice"
    age: 30
    profession: "shop owner"
    personality:
      openness: 0.7
      conscientiousness: 0.8
      extraversion: 0.6
      agreeableness: 0.5
      neuroticism: 0.3
    goals:
      - "maximize profit"
      - "build customer loyalty"
    starting_location: "Town Square"
    backstory: "Alice opened her shop last year..."
    resources:
      money: 10000

events:
  scheduled:
    - tick: 24
      type: "crisis"
      description: "A fire breaks out in the market"
  injectable: true
```

Create a new scenario:

```bash
simcore init my-scenario --template marketplace
```

## LLM Providers

SimCore uses [LiteLLM](https://github.com/BerriAI/litellm) under the hood, supporting:

| Provider | Model Example | Env Variable |
|---|---|---|
| OpenAI | `gpt-4o-mini` | `OPENAI_API_KEY` |
| Anthropic | `claude-sonnet-4-20250514` | `ANTHROPIC_API_KEY` |
| Ollama | `ollama/llama3` | (local, no key) |
| Any LiteLLM provider | See [docs](https://docs.litellm.ai/docs/providers) | Varies |

**Demo mode** (`--demo`) uses a built-in rule-based engine — no API key needed.

## CLI Reference

```bash
# Run simulation with dashboard
simcore run config.yaml --dashboard

# Demo mode (no API key)
simcore run config.yaml --dashboard --demo

# Headless (fast, no UI)
simcore run config.yaml --headless --output results/

# Control speed
simcore run config.yaml --dashboard --speed 2.0

# Replay saved simulation
simcore replay results/sim_20260422.db

# Create new scenario
simcore init my-scenario --template marketplace
```

## API

When running with `--dashboard`, SimCore exposes a REST + WebSocket API:

```
GET  /api/state          — Full simulation state
GET  /api/agents         — All agents
GET  /api/agents/:id     — Single agent details
GET  /api/clock          — Current time/tick
POST /api/inject         — Inject event {"description": "...", "location": "..."}
POST /api/control/pause  — Pause simulation
POST /api/control/resume — Resume simulation
POST /api/control/stop   — Stop simulation
WS   /ws                 — Real-time event stream
```

## Tech Stack

| Layer | Technology |
|---|---|
| Core Engine | Python 3.11+, asyncio |
| LLM | LiteLLM (unified multi-provider) |
| API | FastAPI + WebSocket |
| Dashboard | React + Vite + Canvas |
| Storage | SQLite (async, via aiosqlite) |
| Config | YAML + Pydantic validation |
| CLI | Click |

## Project Structure

```
simcore/
├── simcore/           # Python package
│   ├── engine/        # Simulation loop, clock, events
│   ├── agents/        # Agent, persona, memory, actions
│   ├── world/         # Environment, locations, interactions
│   ├── llm/           # LLM provider, prompts, cache, mock
│   ├── config/        # YAML loader, Pydantic schemas
│   ├── storage/       # SQLite persistence
│   ├── server/        # FastAPI + WebSocket
│   └── cli.py         # CLI entry point
├── dashboard/         # React frontend
├── scenarios/         # Ready-to-run YAML scenarios
└── tests/             # Test suite
```

## Contributing

SimCore is open source under the MIT license. Contributions welcome.

```bash
git clone https://github.com/yourusername/simcore.git
cd simcore
pip install -e ".[dev]"
pytest
```

## License

MIT
