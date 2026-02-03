import {
  MLCEngine,
  prebuiltAppConfig,
} from "https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm/+esm";

const el = (id) => document.getElementById(id);

/* ---------------- State ---------------- */
let engine = null;
let messages = [];
let modelLoaded = false;
let isGenerating = false;
let abortController = null;

/* ---------------- Constants ---------------- */
const QUICK_MODELS_KEY = "localmind_quick_models";

/* ---------------- UI Helpers ---------------- */
function setStatus(text) {
  const s = el("status");
  if (s) s.textContent = text;
}

function enableChat(enabled) {
  el("userInput").disabled = !enabled;
  el("sendBtn").disabled = !enabled;

  // Also disable stop button if chat is enabled (meaning not generating)
  const stopBtn = el("stopBtn");
  if (stopBtn) stopBtn.style.display = 'none';
}

function toggleStopButton(show) {
  el("stopBtn").style.display = show ? 'inline-block' : 'none';
  el("sendBtn").disabled = show;
}

function renderMessageContent(div, text) {
  // Use marked to parse markdown
  if (typeof marked !== 'undefined') {
    div.innerHTML = marked.parse(text);
    // Apply syntax highlighting
    if (typeof hljs !== 'undefined') {
      div.querySelectorAll('pre code').forEach((block) => {
        hljs.highlightElement(block);
      });
    }
  } else {
    div.textContent = text; // Fallback
  }
}

function addMessage(role, text = "") {
  const div = document.createElement("div");
  div.className = `msg ${role}`;
  renderMessageContent(div, text);

  el("chat").appendChild(div);
  scrollToBottom();
  return div;
}

function scrollToBottom() {
  const chat = el("chat");
  chat.scrollTop = chat.scrollHeight;
}

function resetChat() {
  el("chat").innerHTML = "";
  messages = [
    {
      role: "system",
      content: el("systemPrompt").value,
    },
  ];
}

/* ---------------- Models ---------------- */
/* ---------------- Models ---------------- */
/* ---------------- Models ---------------- */
function populateModels() {
  const modelSelect = el("modelSelect");
  if (!modelSelect) return;

  modelSelect.innerHTML = ""; // Clear existing

  prebuiltAppConfig.model_list.forEach((m) => {
    const opt = document.createElement("option");
    opt.value = m.model_id;

    // Attempt to find context size
    let ctx = "4k"; // Default assumption for WebLLM WASM
    if (m.overrides && m.overrides.context_window_size) {
      ctx = Math.round(m.overrides.context_window_size / 1024) + "k";
    } else if (m.model_id.includes("128k")) {
      ctx = "128k";
    } else if (m.model_id.toLowerCase().includes("llama-3")) {
      ctx = "8k"; // Llama-3 usually compiled with 8k in newer MLC
    }

    opt.textContent = `[${ctx}] ${m.model_id}`;
    modelSelect.appendChild(opt);
  });
}

/* ---------------- Quick Models ---------------- */
let quickModels = JSON.parse(localStorage.getItem(QUICK_MODELS_KEY)) || [
  "Phi-3-mini-4k-instruct-q4f16_1",
  "TinyLlama-1.1B-Chat-v1.0-q4f16_1",
];

function renderQuickModels() {
  const container = el("quickModelsView");
  container.innerHTML = "";

  quickModels.forEach((id) => {
    const btn = document.createElement("button");
    btn.textContent = id.replace("-q4f16_1", "");
    btn.onclick = () => loadModel(id);
    container.appendChild(btn);
  });
}

el("editQuickModelsBtn").onclick = () => {
  el("quickModelsInput").value = quickModels.join("\n");
  el("quickModelsEditor").style.display = "block";
};

el("saveQuickModelsBtn").onclick = () => {
  quickModels = el("quickModelsInput")
    .value.split("\n")
    .map((v) => v.trim())
    .filter(Boolean);

  localStorage.setItem(QUICK_MODELS_KEY, JSON.stringify(quickModels));

  el("quickModelsEditor").style.display = "none";
  renderQuickModels();
};

/* ---------------- Load Model ---------------- */
async function loadModel(modelId) {
  // Disconnect existing if any
  if (engine) {
    await engine.unload();
  }

  setStatus("Loading model...");
  engine ??= new MLCEngine();

  engine.setInitProgressCallback((report) => {
    setStatus(report.text);
  });

  await engine.reload(modelId);

  modelLoaded = true;
  resetChat();
  enableChat(true);
  setStatus(`Model loaded: ${modelId}`);
}

el("loadModelBtn").onclick = () => {
  loadModel(el("modelSelect").value);
};

/* ---------------- Chat ---------------- */
async function sendMessage() {
  if (!modelLoaded || isGenerating) return;

  const text = el("userInput").value.trim();
  if (!text) return;

  el("userInput").value = "";
  el("userInput").style.height = 'auto'; // Reset height

  addMessage("user", text);
  messages.push({ role: "user", content: text });

  isGenerating = true;
  toggleStopButton(true);

  const assistantDiv = document.createElement("div");
  assistantDiv.className = "msg model";
  assistantDiv.textContent = "Thinking...";
  el("chat").appendChild(assistantDiv);
  scrollToBottom();

  let reply = "";

  try {
    const res = await engine.chat.completions.create({
      messages,
      temperature: +el("temperature").value,
      top_p: +el("topP").value,
      max_tokens: +el("maxTokens").value,
      stream: true,
    });

    for await (const chunk of res) {
      // Check if we pushed stop
      if (!isGenerating) {
        // engine interrupt logic would go here if supported by this version of WebLLM API exposed to us
        // but usually break loop is enough to stop processing stream
        break;
      }

      const delta = chunk.choices?.[0]?.delta?.content || "";
      reply += delta;

      // Re-render with markdown on every chunk or every few chunks
      // For performance, maybe just textContent during stream, then marked at end?
      // But let's try live marked rendering, it might be flickering.
      // Better: update innerHTML but minimal flicker?
      // Simple approach: usage of marked on incomplete text works okay usually.
      renderMessageContent(assistantDiv, reply);
      scrollToBottom();

      // Update stats (Est. or Real)
      const speed = (await engine.runtimeStatsText()).match(/([0-9.]+) tok\/s/)?.[1] || "?";

      let used = 0;
      let capacity = 4096; // Default assumption

      if (chunk.usage) {
        used = chunk.usage.total_tokens;
      } else {
        // Estimate if no usage data yet: words * 1.3 or chars / 4
        const replyTokens = Math.ceil(reply.length / 3.5);
        const promptTokens = messages.reduce((acc, m) => acc + (m.content?.length || 0) / 3.5, 0);
        used = Math.floor(promptTokens + replyTokens);
      }

      const pct = Math.min(100, (used / capacity) * 100).toFixed(1);

      el("tokenStatus").innerHTML = `
        <div style="display:flex; align-items:center; gap:8px; width:100%;">
            <small style="white-space:nowrap;">Used: <b>${used}</b> / ${capacity}</small>
            <div style="flex:1; height:6px; background:var(--bg-app); border-radius:3px; overflow:hidden;">
                <div style="width:${pct}%; height:100%; background:var(--accent-primary); transition:width 0.2s;"></div>
            </div>
            <small style="white-space:nowrap;">${speed} t/s</small>
        </div>
      `;
    }
  } catch (err) {
    console.error(err);
    assistantDiv.textContent += "\n[Error or Stopped]";
  }

  if (isGenerating) {
    // Only push to history if we finished naturally (not stopped manually effectively?)
    // Actually we should push partial too.
    messages.push({ role: "assistant", content: reply });
  } else {
    messages.push({ role: "assistant", content: reply }); // Save what we got
  }

  isGenerating = false;
  toggleStopButton(false);
  enableChat(true);
}

el("sendBtn").onclick = sendMessage;

el("userInput").onkeydown = (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
  // Auto-expand
  setTimeout(() => {
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
  }, 0);
};


el("stopBtn").onclick = async () => {
  if (isGenerating) {
    isGenerating = false;
    await engine.interruptGenerate(); // Attempt to stop engine
    toggleStopButton(false);
    enableChat(true);
    setStatus("Generation stopped.");
  }
};

/* ---------------- Sliders ---------------- */
el("temperature").oninput = () =>
  (el("tempVal").textContent = el("temperature").value);

el("topP").oninput = () => (el("topPVal").textContent = el("topP").value);

/* ---------------- Reset ---------------- */
el("clearChatBtn").onclick = () => {
  if (!modelLoaded) return;
  resetChat();
  setStatus("Chat reset.");
};

/* ---------------- Init ---------------- */
populateModels();
renderQuickModels();
enableChat(false);
// Setup Marked options if needed
if (typeof marked !== 'undefined') {
  // Optional: marked.setOptions({ ... });
}

/* ---------------- Theme Logic ---------------- */
const THEME_KEY = "localmind_theme";



const THEMES = ["dark", "light", "ocean", "forest", "sunset", "matrix"];

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(THEME_KEY, theme);
}

function toggleTheme() {
  const current = localStorage.getItem(THEME_KEY) || "dark";
  const idx = THEMES.indexOf(current);
  const next = THEMES[(idx + 1) % THEMES.length];
  applyTheme(next);
}

// Init Theme
applyTheme(localStorage.getItem(THEME_KEY) || "dark");

const themeBtn = document.getElementById("themeToggleBtn");
if (themeBtn) {
  themeBtn.onclick = toggleTheme;
}

/* ---------------- Sidebar Logic ---------------- */
const SIDEBAR_KEY = "localmind_sidebar_collapsed";
const sidebar = document.getElementById("sidebar");
const expandBtn = document.getElementById("expandSidebarBtn");
const collapseBtn = document.getElementById("collapseSidebarBtn");

function setSidebarState(collapsed) {
  if (!sidebar) return;

  if (collapsed) {
    sidebar.classList.add("collapsed");
    if (expandBtn) expandBtn.style.display = "block";
  } else {
    sidebar.classList.remove("collapsed");
    if (expandBtn) expandBtn.style.display = "none";
  }
  localStorage.setItem(SIDEBAR_KEY, collapsed);
}

// Init Sidebar
const isCollapsed = localStorage.getItem(SIDEBAR_KEY) === "true";
setSidebarState(isCollapsed);

if (collapseBtn) {
  collapseBtn.onclick = () => setSidebarState(true);
}

if (expandBtn) {
  expandBtn.onclick = () => setSidebarState(false);
}