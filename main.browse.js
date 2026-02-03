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

  if (enabled) {
    el("stopBtn").style.display = 'none';
  }
}

function toggleStopButton(show) {
  el("stopBtn").style.display = show ? 'inline-block' : 'none';
  el("sendBtn").disabled = show;
}

function renderMessageContent(div, text) {
  if (typeof marked !== 'undefined') {
    div.innerHTML = marked.parse(text);
    if (typeof hljs !== 'undefined') {
      div.querySelectorAll('pre code').forEach((block) => {
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
  el("chat").scrollTop = el("chat").scrollHeight;
  return div;
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
function populateModels() {
  prebuiltAppConfig.model_list.forEach((m) => {
    const opt = document.createElement("option");
    opt.value = m.model_id;
    opt.textContent = m.model_id;
    el("modelSelect").appendChild(opt);
  });
}

let quickModels = JSON.parse(localStorage.getItem(QUICK_MODELS_KEY)) || [
  "Phi-3-mini-4k-instruct-q4f16_1",
  "TinyLlama-1.1B-Chat-v1.0-q4f16_1",
];

function renderQuickModels() {
  const container = el("quickModelsView");
  if (!container) return;
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
  if (engine) await engine.unload(); // Unload previous if any

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

/* ---------------- Browser & Context ---------------- */
el("loadPageBtn").onclick = () => {
  const url = el("urlInput").value;
  if (!url) return;

  el("browserFrame").src = url;

  const linkBtn = el("externalLinkBtn");
  if (linkBtn) {
    linkBtn.style.display = "inline-block";
    linkBtn.onclick = () => window.open(url, '_blank');
  }

  setStatus("Attempting to load... If empty/blocked, use 'Auto-Read' or 'Manual Paste'.");
};

/* ---------------- Auto-Read (Fetch) Logic ---------------- */
el("autoFetchBtn").onclick = async () => {
  const url = el("urlInput").value.trim();
  if (!url) {
    setStatus("Please enter a URL first.");
    return;
  }

  setStatus("⏳ fetching content via proxy...");

  // Also try to show in iframe visually if possible (optional, but good UX)
  el("browserFrame").src = url;

  async function tryFetch(proxyUrl, isJson = false) {
    try {
      const res = await fetch(proxyUrl);
      if (!res.ok) throw new Error(`Status ${res.status}`);
      if (isJson) {
        const data = await res.json();
        return data.contents;
      } else {
        return await res.text();
      }
    } catch (e) {
      console.warn("Proxy failed:", proxyUrl, e);
      return null;
    }
  }

  try {
    let content = null;
    const encodedUrl = encodeURIComponent(url);

    // 1. Try AllOrigins
    if (!content) {
      content = await tryFetch(`https://api.allorigins.win/get?url=${encodedUrl}`, true);
    }

    // 2. Try CORSProxy.io
    if (!content) {
      content = await tryFetch(`https://corsproxy.io/?${encodedUrl}`, false);
    }

    // 3. Try ThingProxy
    if (!content) {
      content = await tryFetch(`https://thingproxy.freeboard.io/fetch/${url}`, false);
    }

    if (!content) {
      throw new Error("All proxies failed.");
    }

    // Parse HTML to Text
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, "text/html");

    // Remove scripts/styles
    doc.querySelectorAll('script, style, noscript, svg, img, video').forEach(n => n.remove());

    // Get text
    let cleanText = doc.body.innerText || doc.body.textContent || "";
    cleanText = cleanText.replace(/\s+/g, ' ').trim().substring(0, 15000); // Limit context

    if (cleanText.length < 50) {
      setStatus("⚠️ Fetched content seems too short. Site might block proxies.");
      addMessage("system", `[Warning] Auto-Read fetched very little content from ${url}. It might be blocked or empty. Content: "${cleanText}"`);
      return;
    }

    // Inject Context
    addMessage("system", `[Auto-Read Success] I have read the content from: ${url} (${cleanText.length} chars)`);

    const contextMsg = `\n\n[Context from ${url}]:\n"""\n${cleanText}\n"""\n`;
    if (messages.length > 0 && messages[0].role === "system") {
      messages[0].content += contextMsg;
    } else {
      messages.unshift({ role: "system", content: "You are a helpful assistant." + contextMsg });
    }

    setStatus("✅ Content read! You can now ask questions.");

  } catch (err) {
    console.error(err);
    setStatus("❌ Auto-Read failed. Proxy might be blocked. Try 'Manual Paste'.");
    addMessage("system", `[Error] Could not auto-fetch ${url}. All proxies failed. Please copy-paste the text manually.`);
  }
};

// Toggle Paste Area
if (el("togglePasteBtn")) {
  el("togglePasteBtn").onclick = () => {
    const area = el("manualContextArea");
    area.style.display = area.style.display === 'none' ? 'block' : 'none';
  };
}

// Set Context from Paste
if (el("setContextBtn")) {
  el("setContextBtn").onclick = () => {
    const text = el("manualContextInput").value.trim();
    const url = el("urlInput").value || "Manual Context";

    if (!text) {
      setStatus("Please paste some text first.");
      return;
    }

    addMessage("system", `[Context Set] I have read the pasted content from: ${url}`);

    // Inject system context
    const contextMsg = `\n\n[Manual Context from ${url}]:\n"""\n${text}\n"""\n`;
    if (messages.length > 0 && messages[0].role === "system") {
      messages[0].content += contextMsg;
    } else {
      messages.unshift({ role: "system", content: "You are a helpful assistant." + contextMsg });
    }

    el("manualContextArea").style.display = "none";
    setStatus("Context set! You can now ask questions.");
  };
}

/* ---------------- Chat Logic ---------------- */
async function sendMessage() {
  if (!modelLoaded || isGenerating) return;

  const text = el("userInput").value.trim();
  if (!text) return;

  el("userInput").value = "";
  el("userInput").style.height = 'auto'; // Reset

  addMessage("user", text);
  messages.push({ role: "user", content: text });

  isGenerating = true;
  toggleStopButton(true);

  const assistantDiv = document.createElement("div");
  assistantDiv.className = "msg model";
  assistantDiv.textContent = "Thinking...";
  el("chat").appendChild(assistantDiv);
  el("chat").scrollTop = el("chat").scrollHeight;

  let reply = "";

  try {
    const res = await engine.chat.completions.create({
      messages,
      temperature: +el("temperature").value,
      top_p: 0.9, // Fixed top_p for browse or could add slider
      max_tokens: +el("maxTokens").value,
      stream: true,
    });

    for await (const chunk of res) {
      if (!isGenerating) break; // Stop clicked

      const delta = chunk.choices?.[0]?.delta?.content || "";
      reply += delta;
      renderMessageContent(assistantDiv, reply);
      el("chat").scrollTop = el("chat").scrollHeight;

      // Update stats (Est. or Real)
      try {
        let speed = "?";
        try {
          const stats = await engine.runtimeStatsText();
          speed = stats.match(/([0-9.]+) tok\/s/)?.[1] || "?";
        } catch (e) { /* ignore stats error */ }

        let used = 0;
        let capacity = 4096; // Default assumption

        if (chunk.usage) {
          used = chunk.usage.total_tokens;
        } else {
          // Estimate if no usage data yet
          const replyTokens = Math.ceil(reply.length / 3.5);
          const promptTokens = messages.reduce((acc, m) => acc + (m.content?.length || 0) / 3.5, 0);
          used = Math.floor(promptTokens + replyTokens);
        }

        const pct = Math.min(100, (used / capacity) * 100).toFixed(1);

        const statusEl = el("tokenStatus");
        if (statusEl) {
          statusEl.innerHTML = `
                <div style="display:flex; align-items:center; gap:8px; width:100%;">
                    <small style="white-space:nowrap;">Used: <b>${used}</b> / ${capacity}</small>
                    <div style="flex:1; height:6px; background:var(--bg-app); border-radius:3px; overflow:hidden;">
                        <div style="width:${pct}%; height:100%; background:var(--accent-primary); transition:width 0.2s;"></div>
                    </div>
                    <small style="white-space:nowrap;">${speed} t/s</small>
                </div>
            `;
        }
      } catch (err) { console.error("Stats update error", err); }
    }
  } catch (e) {
    console.error(e);
    assistantDiv.textContent += "\n[Error]";
  }

  if (isGenerating) {
    messages.push({ role: "assistant", content: reply });
  } else {
    messages.push({ role: "assistant", content: reply });
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
  setTimeout(() => {
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
  }, 0);
};

el("stopBtn").onclick = async () => {
  if (isGenerating) {
    isGenerating = false;
    await engine.interruptGenerate();
    toggleStopButton(false);
    enableChat(true);
    setStatus("Generation stopped.");
  }
};

/* ---------------- Cleanup ---------------- */
el("clearChatBtn").onclick = () => {
  resetChat();
  setStatus("Chat cleared.");
};

el("temperature").oninput = () => el("tempVal").textContent = el("temperature").value;

/* ---------------- Init ---------------- */
populateModels();
renderQuickModels();
enableChat(false);

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