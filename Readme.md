# 🧠 LocalMind

### A Browser-Native AI Experimentation Platform

LocalMind is a **technical AI experimentation platform** that runs modern Large Language Models (LLMs) directly inside the browser using WebGPU.

This is not a chatbot product.
This is not a polished consumer assistant.

This is a **local AI lab** designed to explore the evolution of:

```
LLM → Assistant → Agent → Agentic AI
```

All fully client-side.

---

# 🎯 Project Intention

LocalMind exists to:

1. Experiment with local LLM execution in the browser
2. Understand system prompts and inference behavior
3. Explore tool-augmented assistants
4. Build agent loops
5. Prototype early-stage agentic AI systems
6. Observe token usage, memory injection, and reasoning transparency
7. Study architectural patterns of modern AI systems

This is an experiment.
This is a sandbox.
This is an AI systems playground.

---

# 🟢 Current State (As of Now)

LocalMind currently supports:

## ✅ 1. Pure LLM Mode (Chat)

- WebGPU-powered local LLM execution
- Model switching
- Background model downloading
- Cache storage tracking
- Model deletion
- Token usage visualization
- Streaming responses
- Temperature control
- Top-P control
- Max tokens configuration
- Editable system prompt
- Prompt presets
- Context window tracking
- Runtime speed stats
- Local storage persistence
- Responsive UI

This mode acts as:

> A local inference playground.

---

## ⚠️ 2. Browse Mode (Experimental / Legacy)

- URL loading in iframe
- Proxy-based auto-fetch
- Manual content injection
- Simple system prompt
- Model switching

However:

- Many websites block iframe
- Proxy reliability varies
- Tool integration is limited
- Architecture differs from Chat mode

This mode is considered experimental and may be redesigned.

---

# 🧠 Architectural Philosophy

LocalMind is evolving into a layered capability system:

```
Level 1 → LLM
Level 2 → Assistant (Tools)
Level 3 → Agent (Loop + Tools)
Level 4 → Agentic (Planning + Memory + Reflection)
```

Each level builds on the previous.

The platform is designed to:

- Expose internal mechanics
- Show token usage
- Reveal tool calls
- Display reasoning steps
- Avoid hiding system construction
- Allow deep experimentation

---

# 🚀 Planned Evolution

## 🟢 Level 1 – LLM Mode (Current Core)

Focus: Pure inference experimentation

Planned improvements:

- Prompt visualizer (final compiled prompt display)
- Determinism testing (repeat prompt comparisons)
- Side-by-side model comparison
- Prompt templates library
- JSON / structured output mode
- Export / save conversations

---

## 🔵 Level 2 – Assistant Mode

Focus: Tool-augmented intelligence

Replace fragile iframe browsing with tool-based architecture:

Planned tools:

- 🔍 Web search (API-based)
- 🌐 URL fetch (clean extraction)
- 📄 PDF reader
- 📂 Local file reader
- 🧠 Memory store
- 📊 Structured output parser

UI additions:

- Tool registry panel
- Tool call log
- Tool result injection viewer
- Prompt assembly visualizer

Assistant flow:

```
User → Model → Tool Call → Tool Result → Model → Final Answer
```

All visible.

---

## 🟣 Level 3 – Agent Mode

Focus: Multi-step execution

Add:

- Goal input field
- Execution loop
- Step counter
- Reflection step
- Structured reasoning log
- Manual step control

Example execution:

```
Goal: Summarize latest AI research
Step 1: Search web
Step 2: Fetch top result
Step 3: Summarize
Reflection: Not enough info
Step 4: Refine search
```

User can:

- Step once
- Run multiple steps
- Stop execution

---

## 🔴 Level 4 – Agentic Mode

Focus: Autonomous experimentation

Add:

- Planning phase
- Task decomposition tree
- Memory object model
- Iteration limit
- Token budget
- Self-reflection logic
- Abort safeguards

This becomes:

> A safe local AutoGPT-style experimental environment.

---

# 🏗 Target Architecture

Move toward a unified architecture:

```
app.html
app.js
modelManager.js
modeController.js
toolManager.js
agentRunner.js
storageManager.js
```

Single engine instance.
Single model lifecycle manager.
Single UI shell.
Modes switch internally.

No fragmented multi-page logic.

---

# 🛠 Model Management Design

Current capabilities:

- Background downloads
- Cache detection
- Model deletion
- Storage estimation
- Runtime stats

Future improvements:

- Model size tracking
- Concurrent download management
- Download queue
- Prefetch recommended models
- Shared ModelManager across modes

---

# 🔬 Experimental Features Planned

To make LocalMind a real AI lab:

### 🧪 Prompt Visualizer

Show the exact prompt sent to model.

### 🧪 Token Flow Analyzer

Break down:

- Prompt tokens
- Completion tokens
- Tool tokens
- Memory tokens

### 🧪 Memory Inspector

Display memory state object.

### 🧪 Tool Call Inspector

Show:

- Tool name
- Parameters
- Raw output

### 🧪 Determinism Lab

Run same prompt multiple times and compare outputs.

### 🧪 Model Comparison Mode

Side-by-side response comparison.

### 🧪 Agent Loop Debug Console

Step-by-step execution visibility.

---

# 🧭 Design Principles

1. Transparency over polish
2. Architecture over UI cosmetics
3. Inspectability over abstraction
4. Safety over autonomy
5. Experimental flexibility over stability
6. No hidden magic

---

# 🔐 Privacy Model

- 100% client-side execution
- No server dependency
- No data collection
- Model files cached locally
- Requires WebGPU-compatible browser

---

# 📌 Current Limitations

- WebGPU browser support required
- Memory constraints on low-end devices
- Large models (>3B) not ideal for browser
- Iframe browsing unreliable
- Tool architecture not fully implemented yet

---

# 🎓 Intended Audience

LocalMind is for:

- AI engineers
- LLM experimenters
- Browser AI researchers
- Agent system builders
- Students learning LLM architecture
- Developers exploring WebGPU

Not for:

- General consumers
- Production AI deployment
- Enterprise-grade workloads

---

# 🧠 Long-Term Vision

LocalMind becomes:

> A browser-native AI systems experimentation lab.

A place where developers can:

- Understand how LLMs behave
- Build tool-augmented assistants
- Prototype agents
- Explore agentic loops
- Analyze token economics
- Test architectural patterns

All locally.

---

# 📅 High-Level Roadmap

Phase 1 – Stabilize LLM core
Phase 2 – Implement Tool system
Phase 3 – Add Agent loop
Phase 4 – Add Planning + Memory
Phase 5 – Refactor into unified app architecture

---

# ⚙️ Technology Stack

- WebLLM (MLC-AI)
- WebGPU
- Vanilla JS
- Browser Cache API
- IndexedDB (if needed)
- LocalStorage
- Marked (Markdown rendering)
- Highlight.js

---

# 🧪 Status Summary

| Capability          | Status         |
| ------------------- | -------------- |
| Local LLM           | ✅ Stable      |
| Model Manager       | ✅ Advanced    |
| Background Download | ✅ Implemented |
| Storage Tracking    | ✅ Implemented |
| Tool System         | 🚧 Planned     |
| Agent Loop          | 🚧 Planned     |
| Agentic Mode        | 🚧 Concept     |
| Unified App         | 🚧 Planned     |

---

# 📣 Final Note

LocalMind is an experiment.

It is not finished.
It is not polished.
It is evolving.

The goal is not perfection.
The goal is understanding.
