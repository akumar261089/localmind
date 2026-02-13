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
let cachedModels = new Set();
let totalCacheSize = 0;

/* ---------------- Debug ---------------- */
const DEBUG_LLM = true;

function dbg(label, data) {
  if (!DEBUG_LLM) return;
  console.warn("🔥 LLM DEBUG:", label, data);
}

const el = (id) => document.getElementById(id);

/* ---------------- System Prompt Presets ---------------- */
const PROMPT_PRESETS = {
  helpful: "You are a helpful assistant.",
  code: "You are an expert programmer. Provide clear, well-commented code with explanations. Focus on best practices, efficiency, and readability.",
  creative:
    "You are a creative writer with a vivid imagination. Write engaging, descriptive content with rich details and compelling narratives.",
  concise:
    "You are a concise assistant. Provide brief, direct answers without unnecessary elaboration. Get straight to the point.",
  custom: "",
};

const DEFAULT_PROMPT = "You are a helpful assistant.";
const SYSTEM_PROMPT_KEY = "localmind_system_prompt";
const PROMPT_PRESET_KEY = "localmind_prompt_preset";
const PROMPT_COLLAPSED_KEY = "localmind_prompt_collapsed";

/* ---------------- System Prompt UI ---------------- */
function setupSystemPrompt() {
  const section = el("systemPromptSection");
  const header = el("systemPromptHeader");
  const editBtn = el("editPromptBtn");
  const textarea = el("systemPrompt");
  const presets = el("promptPresets");
  const resetBtn = el("resetPromptBtn");
  const preview = el("promptPreview");
  const charCount = el("promptCharCount");

  // Safety check - return if critical elements don't exist
  if (!section || !header || !textarea) {
    console.warn("System prompt elements not found");
    return;
  }

  // Load saved state
  const savedPrompt = localStorage.getItem(SYSTEM_PROMPT_KEY);
  const savedPreset = localStorage.getItem(PROMPT_PRESET_KEY) || "helpful";
  const isCollapsed = localStorage.getItem(PROMPT_COLLAPSED_KEY) !== "false";

  if (savedPrompt) {
    textarea.value = savedPrompt;
  }
  if (presets) {
    presets.value = savedPreset;
  }

  if (!isCollapsed) {
    section.classList.remove("collapsed");
  }

  updatePreview();
  updateCharCount();

  // Toggle collapse on header click (but not on edit button)
  header.onclick = (e) => {
    if (editBtn && (e.target === editBtn || editBtn.contains(e.target))) return;
    toggleSystemPrompt();
  };

  // Edit button expands
  if (editBtn) {
    editBtn.onclick = (e) => {
      e.stopPropagation();
      if (section.classList.contains("collapsed")) {
        section.classList.remove("collapsed");
        localStorage.setItem(PROMPT_COLLAPSED_KEY, "false");
      }
      textarea.focus();
    };
  }

  // Preset selection
  if (presets) {
    presets.onchange = () => {
      const preset = presets.value;
      if (preset !== "custom") {
        textarea.value = PROMPT_PRESETS[preset];
        savePrompt();
      }
      localStorage.setItem(PROMPT_PRESET_KEY, preset);
    };
  }

  // Update on textarea change
  textarea.oninput = () => {
    updateCharCount();
    // Set to custom if user types
    if (presets) {
      const currentText = textarea.value.trim();
      const isPreset = Object.values(PROMPT_PRESETS).some(
        (p) => p === currentText,
      );
      if (!isPreset && presets.value !== "custom") {
        presets.value = "custom";
        localStorage.setItem(PROMPT_PRESET_KEY, "custom");
      }
    }
  };

  textarea.onblur = () => {
    savePrompt();
  };

  // Reset button
  if (resetBtn) {
    resetBtn.onclick = () => {
      textarea.value = DEFAULT_PROMPT;
      if (presets) presets.value = "helpful";
      savePrompt();
      localStorage.setItem(PROMPT_PRESET_KEY, "helpful");
    };
  }

  function toggleSystemPrompt() {
    section.classList.toggle("collapsed");
    const isCollapsed = section.classList.contains("collapsed");
    localStorage.setItem(PROMPT_COLLAPSED_KEY, isCollapsed);
  }

  function savePrompt() {
    const text = textarea.value.trim();
    localStorage.setItem(SYSTEM_PROMPT_KEY, text);
    updatePreview();
    updateCharCount();

    // Update messages if chat has started
    if (messages.length > 0 && messages[0].role === "system") {
      messages[0].content = text;
    }
  }

  function updatePreview() {
    if (!preview) return;
    const text = textarea.value.trim() || "No system prompt set";
    preview.textContent =
      text.length > 50 ? text.substring(0, 50) + "..." : text;
  }

  function updateCharCount() {
    if (!charCount) return;
    const count = textarea.value.length;
    charCount.textContent = `${count} character${count !== 1 ? "s" : ""}`;
  }
}

/* ---------------- Device Detection ---------------- */
function getDeviceInfo() {
  const isMobile = window.innerWidth <= 768;
  const deviceMemory = navigator.deviceMemory || 4; // GB, defaults to 4

  return {
    isMobile,
    deviceMemory,
    userAgent: navigator.userAgent.toLowerCase(),
  };
}

/* ---------------- Modal Dialog ---------------- */
function showModal(title, message) {
  return new Promise((resolve) => {
    const modal = el("confirmModal");
    el("modalTitle").textContent = title;
    el("modalMessage").textContent = message;

    modal.classList.add("active");

    const confirm = () => {
      modal.classList.remove("active");
      resolve(true);
    };

    const cancel = () => {
      modal.classList.remove("active");
      resolve(false);
    };

    el("modalConfirm").onclick = confirm;
    el("modalCancel").onclick = cancel;

    // ESC key cancels
    const escHandler = (e) => {
      if (e.key === "Escape") {
        cancel();
        document.removeEventListener("keydown", escHandler);
      }
    };
    document.addEventListener("keydown", escHandler);
  });
}

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

/* ---------------- Smart Model Recommendations ---------------- */
function getRecommendedModels() {
  const { isMobile, deviceMemory } = getDeviceInfo();

  // Define recommended model patterns - ONLY SMALL MODELS FOR BROWSER
  const recommendations = {
    // Mobile: max 1B
    mobile_low: ["SmolLM2-135M", "Qwen2.5-360M"],
    mobile_mid: ["Qwen2.5-0.5B", "TinyLlama-1.1B"],

    // Desktop: max 3B (no 7B or 8B models for browser!)
    desktop_low: ["TinyLlama-1.1B", "Qwen2.5-1.5B"],
    desktop_high: ["Llama-3.2-3B", "Qwen2.5-3B"],
  };

  let category;
  if (isMobile) {
    category = deviceMemory < 2 ? "mobile_low" : "mobile_mid";
  } else {
    category = deviceMemory < 8 ? "desktop_low" : "desktop_high";
  }

  return recommendations[category] || recommendations.desktop_low;
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
  let ctx = 4096;

  if (model.overrides && model.overrides.context_window_size) {
    ctx = model.overrides.context_window_size;
  } else if (model.model_id.includes("128k")) {
    ctx = 128000;
  } else if (model.model_id.toLowerCase().includes("llama-3")) {
    ctx = 8192;
  }

  return ctx >= 1000 ? Math.round(ctx / 1024) + "k" : ctx;
}

function getModelFamily(modelId) {
  // Extract base model name without quantization
  return modelId.replace(/-q\w+(-MLC)?$/i, "").replace(/-MLC$/i, "");
}

function categorizeModel(size) {
  if (size.value === 0) return "Other"; // Changed from "Unknown" to "Other" and will be sorted last
  if (size.value < 500) return "Tiny";
  if (size.value < 2000) return "Small";
  if (size.value < 8000) return "Medium";
  return "Large";
}

function isRecommended(modelId) {
  const size = extractModelSize(modelId);

  // Don't recommend if we can't determine the size (no M or B in name)
  if (size.value === 0) {
    return false;
  }

  const recommended = getRecommendedModels();
  return recommended.some((pattern) => modelId.includes(pattern));
}

function populateModels() {
  const modelSelect = el("modelSelect");
  if (!modelSelect) return;

  const recommendedPatterns = getRecommendedModels();

  // Group models by family and keep only the best quantization
  const familyMap = new Map();

  prebuiltAppConfig.model_list.forEach((m) => {
    const family = getModelFamily(m.model_id);

    // Prefer q4f16 (balanced), then q4f32, then others
    const currentBest = familyMap.get(family);

    if (!currentBest) {
      familyMap.set(family, m);
    } else {
      // Priority: q4f16 > q4f32 > others
      const current = currentBest.model_id;
      const candidate = m.model_id;

      if (candidate.includes("q4f16") && !current.includes("q4f16")) {
        familyMap.set(family, m);
      } else if (
        candidate.includes("q4f32") &&
        !current.includes("q4f16") &&
        !current.includes("q4f32")
      ) {
        familyMap.set(family, m);
      }
    }
  });

  allModels = Array.from(familyMap.values()).map((m) => {
    const size = extractModelSize(m.model_id);
    const ctx = extractContextSize(m);
    const category = categorizeModel(size);
    const recommended = isRecommended(m.model_id);

    return {
      id: m.model_id,
      size: size,
      ctx: ctx,
      category: recommended ? "Recommended" : category,
      displayName: getModelFamily(m.model_id),
      searchText: m.model_id.toLowerCase(),
      isRecommended: recommended,
      downloaded: cachedModels.has(m.model_id),
    };
  });

  // Sort: Recommended first, then by size, then Other/unknown at end
  allModels.sort((a, b) => {
    // Recommended always first
    if (a.isRecommended && !b.isRecommended) return -1;
    if (!a.isRecommended && b.isRecommended) return 1;

    // Other category always last
    if (a.category === "Other" && b.category !== "Other") return 1;
    if (a.category !== "Other" && b.category === "Other") return -1;

    // Otherwise sort by size
    return a.size.value - b.size.value;
  });

  filteredModels = [...allModels];
  renderModelList();
}

function renderModelList() {
  const modelSelect = el("modelSelect");
  modelSelect.innerHTML = "";

  let currentCategory = null;

  filteredModels.forEach((model) => {
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

    // Show size if available, otherwise show "?"
    const sizeDisplay = model.size.value > 0 ? model.size.display : "?";
    let text = `[${sizeDisplay} | ${model.ctx}] ${model.displayName}`;

    if (model.isRecommended) {
      text += " ⭐";
    }
    if (model.downloaded) {
      text += " ✓";
    }

    opt.textContent = text;
    opt.style.color = model.downloaded ? "#3b82f6" : "";
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

/* ---------------- Cache Storage Management ---------------- */
async function updateCacheInfo() {
  try {
    if ("storage" in navigator && "estimate" in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      const usage = estimate.usage || 0;
      const quota = estimate.quota || 0;

      totalCacheSize = usage;

      const usageMB = (usage / 1024 / 1024).toFixed(1);
      const quotaGB = (quota / 1024 / 1024 / 1024).toFixed(1);
      const percent = quota > 0 ? ((usage / quota) * 100).toFixed(1) : 0;

      el("storageSize").textContent = `${usageMB} MB / ${quotaGB} GB`;
      el("storageBarFill").style.width = `${percent}%`;
    } else {
      el("storageSize").textContent = "N/A";
    }
  } catch (err) {
    console.warn("Could not estimate storage:", err);
    el("storageSize").textContent = "Unknown";
  }
}

async function detectCachedModels() {
  try {
    // Check if cache API is available
    if ("caches" in window) {
      const cacheNames = await caches.keys();
      cachedModels.clear();

      for (const cacheName of cacheNames) {
        // WebLLM typically uses cache names containing model IDs
        const cache = await caches.open(cacheName);
        const keys = await cache.keys();

        // Try to match cache names to model IDs
        allModels.forEach((model) => {
          if (
            cacheName.includes(model.id) ||
            keys.some((req) => req.url.includes(model.id))
          ) {
            cachedModels.add(model.id);
            model.downloaded = true;
          }
        });
      }

      dbg("Detected cached models", Array.from(cachedModels));
    }
  } catch (err) {
    console.warn("Could not detect cached models:", err);
  }

  await updateCacheInfo();
  renderDownloadedModels();
  renderModelList();
}
async function downloadModelInBackground(modelId) {
  if (cachedModels.has(modelId)) {
    setStatus("Model already downloaded.");
    return;
  }

  setStatus(`Downloading ${modelId} in background...`, true);

  try {
    const bgEngine = new MLCEngine();

    bgEngine.setInitProgressCallback((report) => {
      setStatus(`Downloading ${modelId}: ${report.text}`, true);
    });

    // This triggers full download
    await bgEngine.reload(modelId);

    // Immediately unload after download
    await bgEngine.unload();

    // Mark as downloaded
    cachedModels.add(modelId);
    const model = allModels.find((m) => m.id === modelId);
    if (model) model.downloaded = true;

    await updateCacheInfo();
    renderDownloadedModels();
    renderModelList();

    setStatus(`✓ ${modelId} downloaded (ready to switch instantly)`);

    dbg("Background download completed", modelId);
  } catch (err) {
    console.error("Background download failed:", err);
    setStatus("❌ Background download failed.");
  }
}

async function deleteModelFromCache(modelId) {
  const confirmed = await showModal(
    "Delete Model",
    `Are you sure you want to delete "${modelId}"? 
This model will be removed from browser storage and must be re-downloaded to use again.`,
  );

  if (!confirmed) return;

  let deletedEntries = 0;
  let deletedCaches = 0;

  try {
    setStatus("Deleting model from cache...", true);

    // 🔹 If this model is currently loaded, unload it first
    if (engine && currentModelId === modelId) {
      try {
        await engine.unload();
        modelLoaded = false;
        currentModelId = null;
        enableChat(false);
        dbg("Engine unloaded before deletion", modelId);
      } catch (unloadErr) {
        console.warn("Could not unload engine:", unloadErr);
      }
    }

    if (!("caches" in window)) {
      throw new Error("Cache API not supported in this browser.");
    }

    const cacheNames = await caches.keys();

    if (!cacheNames.length) {
      dbg("No caches found during deletion");
    }

    // 🔹 Scan ALL caches
    for (const cacheName of cacheNames) {
      try {
        const cache = await caches.open(cacheName);
        const requests = await cache.keys();

        for (const request of requests) {
          if (request.url.includes(modelId)) {
            const success = await cache.delete(request);
            if (success) deletedEntries++;
          }
        }

        // Optional: delete empty cache containers
        const remaining = await cache.keys();
        if (remaining.length === 0) {
          const removed = await caches.delete(cacheName);
          if (removed) deletedCaches++;
        }
      } catch (cacheErr) {
        console.warn(`Error processing cache "${cacheName}":`, cacheErr);
      }
    }

    // 🔹 Update internal state
    cachedModels.delete(modelId);

    const model = allModels.find((m) => m.id === modelId);
    if (model) model.downloaded = false;

    // 🔹 Re-scan to verify deletion
    await detectCachedModels();

    setStatus(`✓ Deleted ${modelId} (${deletedEntries} files removed)`);

    dbg("Deletion summary", {
      modelId,
      deletedEntries,
      deletedCaches,
    });

    await updateCacheInfo();
    renderDownloadedModels();
    renderModelList();
  } catch (err) {
    console.error("Error deleting model:", err);

    setStatus("❌ Error deleting model. Check console for details.");

    dbg("Delete failure", {
      modelId,
      error: err.message,
    });
  }
}

/* ---------------- Downloaded Models Display ---------------- */
function renderDownloadedModels() {
  const container = el("quickModelsView");
  container.innerHTML = "";

  const downloaded = allModels.filter((m) => m.downloaded);

  if (downloaded.length === 0) {
    const notice = document.createElement("div");
    notice.style.color = "var(--text-muted)";
    notice.style.fontSize = "0.85rem";
    notice.style.padding = "8px";
    notice.textContent =
      "No models downloaded yet. Select a model below to load.";
    container.appendChild(notice);
    return;
  }

  downloaded.forEach((model) => {
    const item = document.createElement("div");
    item.className = "quick-model-item";

    const btn = document.createElement("button");
    btn.textContent = model.displayName.substring(0, 20);
    btn.title = model.id;
    btn.onclick = () => loadModel(model.id);

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-model-btn";
    deleteBtn.textContent = "✕";
    deleteBtn.title = "Delete from cache";
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      deleteModelFromCache(model.id);
    };

    item.appendChild(btn);
    item.appendChild(deleteBtn);
    container.appendChild(item);
  });
}

/* ---------------- Sidebar Toggle (Desktop & Mobile) ---------------- */
function setupSidebar() {
  const sidebar = el("sidebar");
  const overlay = el("sidebarOverlay");
  const hamburger = el("hamburgerBtn");

  // Safety check - return if elements don't exist
  if (!sidebar || !overlay) {
    console.warn("Sidebar or overlay element not found");
    return;
  }

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

  // Start with sidebar OPEN on desktop, CLOSED on mobile
  if (window.innerWidth <= 768) {
    closeSidebar();
  } else {
    sidebar.classList.remove("collapsed");
    overlay.classList.remove("active");
  }
}

/* ---------------- Load Model ---------------- */
async function loadModel(modelId) {
  // Save current chat history before unloading
  const previousMessages = [...messages];

  if (engine) {
    await engine.unload();
  }

  setStatus("Loading model...", true);
  engine ??= new MLCEngine();

  engine.setInitProgressCallback((report) => {
    setStatus(report.text, true);
  });

  await engine.reload(modelId);

  // Mark as downloaded
  cachedModels.add(modelId);
  const model = allModels.find((m) => m.id === modelId);
  if (model) model.downloaded = true;

  // Store current model info
  currentModelId = modelId;
  const modelInfo = allModels.find((m) => m.id === modelId);
  if (modelInfo) {
    currentModelContextSize = parseInt(modelInfo.ctx) * 1024 || 4096;
  }

  modelLoaded = true;

  // Restore chat history instead of resetting
  if (previousMessages.length > 0) {
    messages = previousMessages;
    // Update system prompt if it exists
    if (messages[0]?.role === "system") {
      messages[0].content = el("systemPrompt").value;
    }
  } else {
    // Only reset if no previous messages
    resetChat();
  }

  enableChat(true);
  setStatus(`✓ Loaded: ${modelInfo ? modelInfo.displayName : modelId}`);

  // Update UI
  await updateCacheInfo();
  renderDownloadedModels();
  renderModelList();

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
  if (!selected) return;

  if (cachedModels.has(selected)) {
    loadModel(selected); // instant switch
  } else {
    downloadModelInBackground(selected);
  }
};

/* ---------------- Auto-select Recommended Model on First Load ---------------- */
async function autoSelectRecommendedModel() {
  // Only auto-select on MOBILE and if no model is loaded and this is first visit
  const isMobile = window.innerWidth <= 768;

  if (!isMobile) {
    return; // Skip on desktop
  }

  const hasLoadedBefore = localStorage.getItem("localmind_has_loaded_model");

  if (!hasLoadedBefore && !modelLoaded) {
    // Get all recommended models and find the SMALLEST one for memory efficiency
    const recommendedModels = allModels.filter((m) => m.isRecommended);

    if (recommendedModels.length === 0) return;

    // Sort by size (smallest first) and pick the first one
    recommendedModels.sort((a, b) => a.size.value - b.size.value);
    const smallestModel = recommendedModels[0];

    if (smallestModel) {
      const shouldLoad = await showModal(
        "Load Recommended Model",
        `Would you like to load "${smallestModel.displayName}" (${smallestModel.size.display})? This is the most memory-efficient model recommended for your device. It may take a few moments to download.`,
      );

      if (shouldLoad) {
        el("modelSelect").value = smallestModel.id;
        await loadModel(smallestModel.id);
        localStorage.setItem("localmind_has_loaded_model", "true");
      }
    }
  }
}

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
setupSidebar();
setupSystemPrompt();
enableChat(false);

if (typeof marked !== "undefined") {
  marked.setOptions({
    breaks: true,
    gfm: true,
  });
}

// Detect cached models and update storage info
detectCachedModels().then(() => {
  // After detecting cache, auto-select recommended if first time
  setTimeout(() => autoSelectRecommendedModel(), 1000);
});

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
  deviceInfo: getDeviceInfo(),
  recommendedModels: getRecommendedModels(),
});
