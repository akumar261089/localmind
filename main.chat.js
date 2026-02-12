import {
  MLCEngine,
  prebuiltAppConfig,
} from "https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm/+esm";

/* ---------------- State ---------------- */
let engine = null;
let messages = [];
let modelLoaded = false;
let isGenerating = false;
let currentModelId = null;
let currentModelContextSize = 4096;
let renderTimer = null;
let pendingContent = "";

/* ---------------- Debug ---------------- */
const DEBUG_LLM = true;

function dbg(label, data) {
  if (!DEBUG_LLM) return;
  console.warn("🔥 LLM DEBUG:", label, data);
}

const el = (id) => document.getElementById(id);

/* ---------------- Constants ---------------- */
const QUICK_MODELS_KEY = "localmind_quick_models";

/* ---------------- UI Helpers ---------------- */
function setStatus(text, showSpinner = false) {
  const s = el("status");
  if (s) {
    if (showSpinner) {
      s.innerHTML = `<span class="loading-spinner"></span> ${text}`;
    } else {
      s.textContent = text;
    }
  }
}

function enableChat(enabled) {
  el("userInput").disabled = !enabled;
  el("sendBtn").disabled = !enabled;
}

function toggleStopButton(show) {
  el("stopBtn").style.display = show ? "inline-flex" : "none";
  el("sendBtn").disabled = show;
}

function renderMessageContent(div, text) {
  if (typeof marked !== "undefined") {
    div.innerHTML = marked.parse(text);
    if (typeof hljs !== "undefined") {
      div.querySelectorAll("pre code").forEach((block) => {
        hljs.highlightElement(block);
      });
    }
  } else {
    div.textContent = text;
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

/* ---------------- Model List with Search & Grouping ---------------- */
let allModels = [];
let filteredModels = [];

function extractModelSize(modelId) {
  // Extract size like "135M", "1.1B", "3B", "7B"
  const match = modelId.match(/(\d+\.?\d*)(M|B)/i);
  if (!match) return { value: 0, unit: "", display: "" };

  const value = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  const numValue = unit === "B" ? value * 1000 : value;

  return {
    value: numValue,
    unit: unit,
    display: `${match[1]}${unit}`,
  };
}

function extractContextSize(model) {
  let ctx = 4096; // Default

  if (model.overrides && model.overrides.context_window_size) {
    ctx = model.overrides.context_window_size;
  } else if (model.model_id.includes("128k")) {
    ctx = 128000;
  } else if (model.model_id.toLowerCase().includes("llama-3")) {
    ctx = 8192;
  }

  // Format to k
  return ctx >= 1000 ? Math.round(ctx / 1024) + "k" : ctx;
}

function categorizeModel(size) {
  if (size.value === 0) return "Unknown";
  if (size.value < 500) return "Tiny"; // < 500M
  if (size.value < 2000) return "Small"; // 500M - 2B
  if (size.value < 8000) return "Medium"; // 2B - 8B
  return "Large"; // 8B+
}

function populateModels() {
  const modelSelect = el("modelSelect");
  if (!modelSelect) return;

  allModels = prebuiltAppConfig.model_list.map((m) => {
    const size = extractModelSize(m.model_id);
    const ctx = extractContextSize(m);
    const category = categorizeModel(size);

    return {
      id: m.model_id,
      size: size,
      ctx: ctx,
      category: category,
      displayName: m.model_id.replace(/-q\w+$/, ""), // Remove quantization suffix
      searchText: m.model_id.toLowerCase(),
    };
  });

  // Sort by size (smallest first)
  allModels.sort((a, b) => a.size.value - b.size.value);

  filteredModels = [...allModels];
  renderModelList();
}

function renderModelList() {
  const modelSelect = el("modelSelect");
  modelSelect.innerHTML = "";

  let currentCategory = null;

  filteredModels.forEach((model) => {
    // Add category header if changed
    if (model.category !== currentCategory) {
      const categoryOpt = document.createElement("option");
      categoryOpt.disabled = true;
      categoryOpt.textContent = `── ${model.category} ──`;
      categoryOpt.style.fontWeight = "bold";
      categoryOpt.style.color = "var(--text-muted)";
      modelSelect.appendChild(categoryOpt);
      currentCategory = model.category;
    }

    const opt = document.createElement("option");
    opt.value = model.id;
    opt.textContent = `[${model.ctx}] ${model.displayName}`;
    modelSelect.appendChild(opt);
  });

  if (filteredModels.length === 0) {
    const opt = document.createElement("option");
    opt.disabled = true;
    opt.textContent = "No models found";
    modelSelect.appendChild(opt);
  }
}

// Model Search Functionality
el("modelSearch").oninput = (e) => {
  const query = e.target.value.toLowerCase().trim();

  if (!query) {
    filteredModels = [...allModels];
  } else {
    filteredModels = allModels.filter((m) => m.searchText.includes(query));
  }

  renderModelList();
};

/* ---------------- Quick Models ---------------- */
let quickModels = JSON.parse(localStorage.getItem(QUICK_MODELS_KEY)) || [
  "SmolLM2-135M-Instruct-q0f32-MLC",
  "TinyLlama-1.1B-Chat-v1.0-q4f16_1",
];

function renderQuickModels() {
  const container = el("quickModelsView");
  container.innerHTML = "";

  quickModels.forEach((id) => {
    const btn = document.createElement("button");
    btn.textContent = id.replace(/-q\w+$/, "").substring(0, 25);
    btn.title = id;
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

/* ---------------- Sidebar Toggle (Desktop & Mobile) ---------------- */
function setupSidebar() {
  const sidebar = el("sidebar");
  const overlay = el("sidebarOverlay");
  const hamburger = el("hamburgerBtn");

  function toggleSidebar() {
    const isCollapsed = sidebar.classList.contains("collapsed");

    if (isCollapsed) {
      sidebar.classList.remove("collapsed");
      overlay.classList.add("active");
    } else {
      sidebar.classList.add("collapsed");
      overlay.classList.remove("active");
    }
  }

  function closeSidebar() {
    sidebar.classList.add("collapsed");
    overlay.classList.remove("active");
  }

  if (hamburger) {
    hamburger.onclick = toggleSidebar;
  }

  if (overlay) {
    overlay.onclick = closeSidebar;
  }

  // Start with sidebar open on desktop, closed on mobile
  if (window.innerWidth <= 768) {
    closeSidebar();
  } else {
    sidebar.classList.remove("collapsed");
  }
}

/* ---------------- Load Model ---------------- */
async function loadModel(modelId) {
  if (engine) {
    await engine.unload();
  }

  setStatus("Loading model...", true);
  engine ??= new MLCEngine();

  engine.setInitProgressCallback((report) => {
    setStatus(report.text, true);
  });

  await engine.reload(modelId);

  // Store current model info
  currentModelId = modelId;
  const modelInfo = allModels.find((m) => m.id === modelId);
  if (modelInfo) {
    currentModelContextSize = parseInt(modelInfo.ctx) * 1024 || 4096;
  }

  modelLoaded = true;
  resetChat();
  enableChat(true);
  setStatus(`✓ Loaded: ${modelId.replace(/-q\w+$/, "")}`);

  // Auto-focus input
  el("userInput").focus();

  // Close sidebar on mobile after loading
  if (window.innerWidth <= 768) {
    el("sidebar").classList.add("collapsed");
    el("sidebarOverlay").classList.remove("active");
  }
}

el("loadModelBtn").onclick = () => {
  const selected = el("modelSelect").value;
  if (selected) {
    loadModel(selected);
  }
};

/* ---------------- Optimized Rendering ---------------- */
let lastRenderTime = 0;
const RENDER_THROTTLE = 150; // ms

function scheduleRender(div, content) {
  pendingContent = content;

  const now = Date.now();
  if (now - lastRenderTime >= RENDER_THROTTLE) {
    renderMessageContent(div, content);
    lastRenderTime = now;
    pendingContent = "";
  } else if (!renderTimer) {
    renderTimer = setTimeout(() => {
      if (pendingContent) {
        renderMessageContent(div, pendingContent);
        lastRenderTime = Date.now();
        pendingContent = "";
      }
      renderTimer = null;
    }, RENDER_THROTTLE);
  }
}

/* ---------------- Chat ---------------- */
async function sendMessage() {
  if (!modelLoaded || isGenerating) return;

  const text = el("userInput").value.trim();
  if (!text) return;

  el("userInput").value = "";
  el("userInput").style.height = "auto";

  addMessage("user", text);
  messages.push({ role: "user", content: text });

  dbg("User Message Added", {
    latestMessage: text,
    fullMessages: structuredClone(messages),
  });

  isGenerating = true;
  toggleStopButton(true);

  const assistantDiv = document.createElement("div");
  assistantDiv.className = "msg model";
  assistantDiv.textContent = "●●●"; // Thinking indicator
  el("chat").appendChild(assistantDiv);
  scrollToBottom();

  let reply = "";
  let chunkCount = 0;

  try {
    const llmPayload = {
      messages: structuredClone(messages),
      temperature: +el("temperature").value,
      top_p: +el("topP").value,
      max_tokens: +el("maxTokens").value,
      stream: true,
    };

    dbg("LLM Request Payload", llmPayload);

    const res = await engine.chat.completions.create(llmPayload);

    for await (const chunk of res) {
      if (!isGenerating) break;

      const delta = chunk.choices?.[0]?.delta?.content || "";
      reply += delta;
      chunkCount++;

      // Optimized rendering: throttled updates
      scheduleRender(assistantDiv, reply);

      // Scroll occasionally
      if (chunkCount % 5 === 0) {
        scrollToBottom();
      }

      // Update stats
      const speed =
        (await engine.runtimeStatsText()).match(/([0-9.]+) tok\/s/)?.[1] || "?";

      let used = 0;
      if (chunk.usage) {
        used = chunk.usage.total_tokens;
      } else {
        // Improved estimation
        const estimatedTokens = reply.length / 3.5;
        const promptTokens = messages.reduce(
          (acc, m) => acc + (m.content?.length || 0) / 3.5,
          0,
        );
        used = Math.floor(promptTokens + estimatedTokens);
      }

      const pct = Math.min(100, (used / currentModelContextSize) * 100).toFixed(
        1,
      );

      el("tokenStatus").innerHTML = `
        <div style="display:flex; align-items:center; gap:8px; width:100%;">
            <small style="white-space:nowrap;">Used: <b>${used}</b> / ${currentModelContextSize}</small>
            <div style="flex:1; height:6px; background:var(--bg-app); border-radius:3px; overflow:hidden;">
                <div style="width:${pct}%; height:100%; background:var(--accent-primary); transition:width 0.2s;"></div>
            </div>
            <small style="white-space:nowrap;">${speed} t/s</small>
        </div>
      `;
    }

    // Final render
    if (pendingContent) {
      renderMessageContent(assistantDiv, reply);
    }
  } catch (err) {
    console.error(err);
    assistantDiv.innerHTML += "<br><i>[Error or Stopped]</i>";
  }

  messages.push({ role: "assistant", content: reply });

  isGenerating = false;
  toggleStopButton(false);
  enableChat(true);

  // Auto-focus input for next message
  el("userInput").focus();
  scrollToBottom();
}

el("sendBtn").onclick = sendMessage;

el("userInput").onkeydown = (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
  // Auto-expand
  setTimeout(() => {
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 200) + "px";
  }, 0);
};

el("stopBtn").onclick = async () => {
  if (isGenerating) {
    isGenerating = false;
    try {
      await engine.interruptGenerate();
    } catch (err) {
      console.warn("Could not interrupt:", err);
    }
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

applyTheme(localStorage.getItem(THEME_KEY) || "dark");

const themeBtn = el("themeToggleBtn");
if (themeBtn) {
  themeBtn.onclick = toggleTheme;
}

/* ---------------- Keyboard Shortcuts ---------------- */
document.addEventListener("keydown", (e) => {
  // Ctrl/Cmd + K: Focus input
  if ((e.ctrlKey || e.metaKey) && e.key === "k") {
    e.preventDefault();
    el("userInput").focus();
  }

  // Escape: Stop generation or close sidebar
  if (e.key === "Escape") {
    if (isGenerating) {
      el("stopBtn").click();
    } else if (
      window.innerWidth <= 768 &&
      !el("sidebar").classList.contains("collapsed")
    ) {
      el("sidebar").classList.add("collapsed");
      el("sidebarOverlay").classList.remove("active");
    }
  }
});

/* ---------------- Init ---------------- */
populateModels();
renderQuickModels();
setupSidebar();
enableChat(false);

if (typeof marked !== "undefined") {
  marked.setOptions({
    breaks: true,
    gfm: true,
  });
}

// Handle window resize
let resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const sidebar = el("sidebar");
    const overlay = el("sidebarOverlay");

    if (window.innerWidth > 768) {
      // Desktop: keep sidebar open
      sidebar.classList.remove("collapsed");
      overlay.classList.remove("active");
    } else {
      // Mobile: keep current state but remove overlay if open
      if (!sidebar.classList.contains("collapsed")) {
        overlay.classList.add("active");
      }
    }
  }, 250);
});

dbg("LocalMind Chat Initialized", {
  modelsAvailable: allModels.length,
  currentTheme: localStorage.getItem(THEME_KEY) || "dark",
});
