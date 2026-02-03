import {
  MLCEngine,
  prebuiltAppConfig,
} from "https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm/+esm";

/* =========================
   Helpers
========================= */
const el = (id) => document.getElementById(id);
const setStatus = (t) => (el("status").textContent = t);

/* =========================
   UI Elements
========================= */
const chatEl = el("chat");
const userInput = el("userInput");
const sendBtn = el("sendBtn");
const modelSelect = el("modelSelect");

const temperatureEl = el("temperature");
const topPEl = el("topP");
const maxTokensEl = el("maxTokens");

el("tempVal").textContent = temperatureEl.value;
el("topPVal").textContent = topPEl.value;

/* =========================
   System Prompt
========================= */
const systemPromptEl = el("systemPrompt");
const systemPresetEl = el("systemPreset");
const tokenStatusEl = el("tokenStatus");

function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

function updateTokenStatus(promptTokens, responseTokens) {
  tokenStatusEl.textContent = `Tokens: Prompt ~${promptTokens} | Response ~${responseTokens} | Total ~${promptTokens + responseTokens}`;
}

const SYSTEM_PRESETS = {
  assistant: "You are a helpful, concise assistant.",
  coder:
    "You are a senior software engineer. Write clean, production-quality code.",
  teacher: "You are a patient teacher who explains concepts step by step.",
  agent: "You are an autonomous agent. Think carefully before responding.",
};

/* =========================
   Quick Models
========================= */
const QUICK_MODELS_KEY = "quickModels";
const DEFAULT_QUICK_MODELS = [
  "Phi-3-mini-4k-instruct-q4f16_1",
  "TinyLlama-1.1B-Chat-v1.0-q4f16_1",
];

let quickModels =
  JSON.parse(localStorage.getItem(QUICK_MODELS_KEY)) || DEFAULT_QUICK_MODELS;

/* =========================
   State
========================= */
let engine;
let modelLoaded = false;
let streaming = false;

/**
 * messages[0] is ALWAYS system
 */
let messages = [];

/* =========================
   UI Helpers
========================= */
function enableChat(v) {
  userInput.disabled = !v;
  sendBtn.disabled = !v;
  if (v) userInput.focus();
}

function addMessage(role, text = "") {
  const div = document.createElement("div");
  div.className = `msg ${role}`;
  div.textContent = text;
  chatEl.appendChild(div);
  chatEl.scrollTop = chatEl.scrollHeight;
  return div;
}

/* =========================
   Quick Models UI
========================= */
function renderQuickModels() {
  const c = el("quickModelsView");
  c.innerHTML = "";

  quickModels.forEach((id) => {
    const btn = document.createElement("button");
    btn.className = "model-btn";
    btn.textContent = id.replace("-q4f16_1", "");
    btn.onclick = () => loadModel(id);
    c.appendChild(btn);
  });
}

el("editQuickModelsBtn").onclick = () => {
  el("quickModelsInput").value = quickModels.join("\n");
  el("quickModelsEditor").style.display = "block";
  el("editQuickModelsBtn").style.display = "none";
};

el("saveQuickModelsBtn").onclick = () => {
  quickModels = el("quickModelsInput")
    .value.split("\n")
    .map((x) => x.trim())
    .filter(Boolean);

  localStorage.setItem(QUICK_MODELS_KEY, JSON.stringify(quickModels));
  el("quickModelsEditor").style.display = "none";
  el("editQuickModelsBtn").style.display = "block";
  renderQuickModels();
};

/* =========================
   Model List
========================= */
function populateModels() {
  modelSelect.innerHTML = "";
  prebuiltAppConfig.model_list.forEach((m) => {
    const opt = document.createElement("option");
    opt.value = m.model_id;
    opt.textContent = m.model_id;
    modelSelect.appendChild(opt);
  });
}

/* =========================
   Reset Chat (CLEAN)
========================= */
function resetChat() {
  chatEl.innerHTML = "";

  messages = [
    {
      role: "system",
      content: systemPromptEl.value || SYSTEM_PRESETS.assistant,
    },
  ];

  systemPromptEl.disabled = false;
  systemPresetEl.disabled = false;

  setStatus("🧠 System prompt active. Chat reset.");
}

/* =========================
   Load Model
========================= */
async function loadModel(modelId) {
  setStatus(`Loading ${modelId}…`);
  enableChat(false);

  engine ??= new MLCEngine({
    initProgressCallback: (p) =>
      setStatus(`Loading ${Math.round(p.progress * 100)}%`),
  });

  await engine.reload(modelId);

  modelLoaded = true;
  resetChat();
  enableChat(true);

  setStatus(`✅ Loaded ${modelId}`);
  addMessage("model", "Model ready. Ask me anything.");
}

/* =========================
   Build Messages (SAFE)
========================= */
function buildMessagesForModel() {
  const system = messages[0];
  const convo = messages
    .slice(1)
    .filter((m) => m.role === "user" || m.role === "assistant");
  return [system, ...convo];
}

/* =========================
   Send Message (STREAMING)
========================= */
async function sendMessage() {
  if (!modelLoaded || streaming) return;

  const text = userInput.value.trim();
  if (!text) return;

  streaming = true;
  userInput.value = "";
  enableChat(false);

  systemPromptEl.disabled = true;
  systemPresetEl.disabled = true;

  addMessage("user", text);
  messages.push({ role: "user", content: text });

  // 🔒 Freeze prompt once
  const promptMessages = buildMessagesForModel();
  const promptText = promptMessages.map((m) => m.content).join("");
  const promptTokens = estimateTokens(promptText);

  const assistantDiv = addMessage("model", "");
  let assistantText = "";

  try {
    const stream = await engine.chat.completions.create({
      messages: promptMessages,
      temperature: +temperatureEl.value,
      top_p: +topPEl.value,
      max_tokens: +maxTokensEl.value,
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content;
      if (!delta) continue;

      assistantText += delta;
      assistantDiv.textContent = assistantText;
      chatEl.scrollTop = chatEl.scrollHeight;
    }
  } catch (err) {
    assistantDiv.textContent += "\n\n⚠️ Error generating response.";
  }

  // ✅ FINALIZE (this always runs)
  messages.push({ role: "assistant", content: assistantText });

  const finalAssistantText = assistantDiv.textContent || "";
  const responseTokens = estimateTokens(finalAssistantText);

  updateTokenStatus(promptTokens, responseTokens);

  streaming = false;
  enableChat(true);
}

/* =========================
   Events
========================= */
el("loadModelBtn").onclick = () => loadModel(modelSelect.value);
sendBtn.onclick = sendMessage;

userInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    sendMessage();
  }
});

el("clearChatBtn").onclick = resetChat;

systemPresetEl.onchange = () => {
  systemPromptEl.value = SYSTEM_PRESETS[systemPresetEl.value];
  resetChat();
};

temperatureEl.oninput = () => (el("tempVal").textContent = temperatureEl.value);
topPEl.oninput = () => (el("topPVal").textContent = topPEl.value);

/* =========================
   Init
========================= */
renderQuickModels();
populateModels();
systemPromptEl.value = SYSTEM_PRESETS.assistant;
setStatus("Select a model to start.");
