# 🧠 LocalMind

**LocalMind** is a local-first AI interface that runs large language models directly in your browser using **WebGPU**.  
It is designed to be **private**, **transparent**, and **user-controlled**, with no backend servers involved.

LocalMind combines:

- A lightweight single-page website (Home / About / Features)
- Dedicated application pages for **Chat** and **AI-assisted Web Browsing**

---

## ✨ Key Principles

- **Local-first** — models run on your device
- **No backend** — no prompts or data are sent to servers
- **Explicit context** — the AI only sees what you give it
- **Browser-native** — respects browser security rules
- **Simple architecture** — no unnecessary frameworks

---

## 🧩 Project Structure

```

localmind/
├── index.html
├── chat.html
├── browse.html
├── css/
│   └── localmind.css
├── main.chat.js
├── main.browse.js
└── README.md


```

---

## 🌐 Pages Overview

### 1️⃣ Home (`index.html`)

A lightweight single-page site that explains:

- What LocalMind is
- Its philosophy and limitations
- Links to launch the apps

No models are loaded here.

---

### 2️⃣ Chat (`chat.html`)

A pure LLM chat interface:

- Load and switch local models
- Quick model buttons
- Editable system prompts
- Model parameters (temperature, tokens)
- Streaming responses via WebGPU

This page is focused only on conversational AI.

---

### 3️⃣ Browse (`browse.html`)

An AI-assisted browsing interface:

- Load any website in a browser frame
- Explicitly send page content to the AI
- Chat with the model _about_ the page
- Same model controls as Chat mode

⚠️ Due to browser security:

- Pages are **not read automatically**
- Only user-approved content is added to AI context

---

## 🔒 Privacy & Security

LocalMind:

- Does **not** collect data
- Does **not** send prompts to external servers
- Does **not** bypass browser security (CORS, SOP)
- Does **not** track users

All computation happens locally using WebGPU.

---

## 🚀 Getting Started (Local Development)

### 1️⃣ Clone or download the project

```bash
git clone <repo-url>
cd localmind
```

### 2️⃣ Start a local server

```bash
python -m http.server
```

### 3️⃣ Open in browser

```
http://localhost:8000
```

> ⚠️ A local server is required.
> Opening files directly (`file://`) will not work.

---

## 🧠 Supported Technology

- **WebGPU** (Chrome / Edge recommended)
- **@mlc-ai/web-llm**
- ES Modules
- Vanilla HTML, CSS, JavaScript

---

## ⚠️ Known Limitations

- Exact token counts are estimated, not exact
- Some websites block fetching due to CORS
- Large pages are truncated for context safety
- Performance depends on device GPU

These are inherent browser and WebGPU constraints.

---

## 🛣️ Roadmap (Possible Next Steps)

- Reader-mode text extraction
- Context size indicators
- Replace vs append page context toggle
- Page summary button
- Shared core logic between Chat & Browse
- Chrome extension for full page access
- Agent workflows

---

## 🧠 Philosophy

LocalMind is an experiment in building AI tools that:

- Users can understand
- Developers can inspect
- Machines can run locally

No hype. No magic. Honest limitations.

---

## 📄 License

This project is currently provided as-is for experimentation and learning.
Choose a license (MIT / Apache-2.0) before public release.

---

## 🙌 Acknowledgements

- WebLLM by MLC-AI
- WebGPU community
- Open-source LLM ecosystem
