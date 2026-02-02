# 🧠 Browser-Based LLM Chat (Web-LLM + Streaming)

A **fully client-side**, **serverless**, **streaming LLM chat UI** that runs directly in the browser using **WebGPU** and **@mlc-ai/web-llm**.

No backend.  
No API keys.  
No servers.

Runs entirely on the user’s machine.

---

## ✨ Features

- 🚀 **Runs 100% in the browser**
- ⚡ **Token-by-token streaming output**
- 🧠 **Editable system prompt (locked after chat starts)**
- 🎛️ Adjustable model parameters (temperature, top-p, max tokens)
- 🔘 Quick model buttons + editable model list
- 🔁 Clean chat reset
- ⌨️ Proper keyboard handling (Enter to send)
- 💾 Quick models persisted via `localStorage`
- 🌐 GitHub Pages compatible (HTTPS + static hosting)

---

## 🖥️ Supported Browsers

This app **requires WebGPU**.

### ✅ Works on

- Chrome (latest)
- Edge (latest)
- Chromium-based browsers with WebGPU enabled

### ❌ Not supported

- Safari (partial WebGPU support)
- Firefox (WebGPU behind flags)
- Mobile browsers

> ⚠️ If `navigator.gpu` is not available, models will not load.

---

## 📦 Models

Models are downloaded **at runtime** via CDN and run locally in the browser.

Example models:

- `Phi-3-mini-4k-instruct-q4f16_1`
- `TinyLlama-1.1B-Chat-v1.0-q4f16_1`

📌 **First load may take time** (models can be hundreds of MB).  
Subsequent loads are cached by the browser.

---

## 🗂️ Project Structure

```

.
├── index.html    # UI layout & styles
├── main.js       # Chat logic, streaming, state management
├── README.md
└── .gitignore

```

---

## 🚀 Running Locally

You must use a local web server (ES modules + WebGPU require it).

### Option 1: Python

```bash
python -m http.server 8000
```

Then open:

```
http://localhost:8000
```

### Option 2: VS Code Live Server

- Install **Live Server**
- Right-click `index.html` → **Open with Live Server**

---

## 🌍 Deploying to GitHub Pages

1. Push files to GitHub:

```bash
git add .
git commit -m "Web-LLM streaming chat app"
git push origin main
```

2. Go to:

```
Repository → Settings → Pages
```

3. Configure:

- Source: `Deploy from a branch`
- Branch: `main`
- Folder: `/ (root)`

4. Save and wait ~30–60 seconds

Your app will be live at:

```
https://<username>.github.io/<repo-name>/
```

---

## 🧠 How It Works (High Level)

- Uses **@mlc-ai/web-llm** via CDN
- Loads models into WebGPU
- Maintains strict message roles:
  - `system` → persona
  - `user` → input
  - `assistant` → response

- Uses **streaming completions** for real-time output
- Entire inference happens on the client machine

---

## 🧪 Known Limitations

- Large model downloads on first use
- No mobile support
- No server-side tools or memory
- Browser GPU memory limits apply

---

## 🔐 Privacy

✔ All prompts and responses stay in the browser
✔ No data is sent to a server
✔ No tracking, no analytics, no logging

---

## 🛠️ Future Improvements (Optional)

- ⏹ Stop / cancel generation button
- 📜 Markdown rendering (code blocks)
- 🧠 Context trimming / memory management
- 🧩 Tool / function calling
- 🌍 WebGPU support detection UI
- 💾 Per-model saved system prompts

---

## 📄 License

MIT License
Use freely for learning, demos, or personal projects.
