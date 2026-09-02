/**
 * Confirmation popup controller.
 *
 * Screens: review → analyzing → verdict (or error). The agent server is called
 * from here rather than from the service worker so the request dies with the
 * window, and so the page never sits between the user and the verdict.
 */
import { summarizeTransaction, formatSui, shortAddress } from "../lib/ptb.js";

const DEFAULT_AGENT_URL = "https://aegis-ai-agent-production.up.railway.app";
// const DEFAULT_AGENT_URL = "http://localhost:3001";
const AGENT_URL_KEY = "agentServerUrl";

const TOOL_ICONS = {
  parse_ptb: "🔧",
  lookup_protocol: "🌐",
  plan_agent: "🧠",
  dry_run_rpc: "⚡",
  fetch_history: "📜",
  vector_search: "🔍",
  score_risk: "🛡️",
  gonka_verification: "⚡",
  walrus_storage: "🦭",
};

const VERDICT_COPY = {
  approve: { cls: "approve", title: "Safe to sign", cta: "Confirm & continue", ctaCls: "safe" },
  caution: { cls: "caution", title: "Proceed with caution", cta: "Confirm & continue", ctaCls: "" },
  reject: { cls: "reject", title: "High risk — do not sign", cta: "Approve anyway", ctaCls: "danger" },
};

const $ = (id) => document.getElementById(id);

const SCREENS = ["idle", "review", "analyzing", "verdict", "error"];

const state = {
  requestId: null,
  origin: null,
  params: null,
  summary: null,
  analysis: null,
  toolCalls: [],
  decided: false,
  agentUrl: DEFAULT_AGENT_URL,
  abort: null,
  port: null,
};

/**
 * Holds a port open for as long as this surface is. An anchored panel gets no
 * windows.onRemoved event, so the worker watches this port's disconnect to
 * learn the panel closed and cancel an undecided request.
 */
function holdPort(requestId) {
  try {
    state.port = chrome.runtime.connect({ name: "aegis-popup" });
    state.port.postMessage({ requestId });
  } catch {
    // Worker unavailable; the request will time out on the page side instead.
  }
}

// ── Chrome helpers ───────────────────────────────────────────────────

async function getAgentUrl() {
  try {
    const stored = await chrome.storage.local.get(AGENT_URL_KEY);
    const url = stored[AGENT_URL_KEY];
    if (typeof url === "string" && url.trim()) {
      const clean = url.trim().replace(/\/+$/, "");
      // Auto-migrate from the legacy default localhost to the production agent URL
      if (clean === "http://localhost:3001" || clean === "http://127.0.0.1:3001") {
        await chrome.storage.local.set({ [AGENT_URL_KEY]: DEFAULT_AGENT_URL });
        return DEFAULT_AGENT_URL;
      }
      return clean;
    }
  } catch {
    // storage unavailable; fall through to the default
  }
  return DEFAULT_AGENT_URL;
}

async function setAgentUrl(url) {
  state.agentUrl = url.trim().replace(/\/+$/, "") || DEFAULT_AGENT_URL;
  try {
    await chrome.storage.local.set({ [AGENT_URL_KEY]: state.agentUrl });
  } catch {
    // Non-fatal: the value still applies for this window.
  }
}

// ── Screen + action plumbing ─────────────────────────────────────────

function setScreen(name) {
  for (const s of SCREENS) $(`screen-${s}`).hidden = s !== name;
  document.querySelector(".body").scrollTop = 0;
}

function setActions(config) {
  const bar = $("actions");
  if (!config) {
    bar.hidden = true;
    return;
  }
  bar.hidden = false;

  const primary = $("btn-primary");
  const secondary = $("btn-secondary");

  primary.textContent = config.primary;
  primary.disabled = Boolean(config.primaryDisabled);
  primary.className = `btn btn-primary${config.primaryClass ? ` ${config.primaryClass}` : ""}`;
  primary.onclick = config.onPrimary ?? null;

  secondary.hidden = !config.secondary;
  if (config.secondary) {
    secondary.textContent = config.secondary;
    secondary.onclick = config.onSecondary ?? null;
  }
}

// ── Decision ─────────────────────────────────────────────────────────

async function decide(approved) {
  if (state.decided) return;
  state.decided = true;
  if (state.abort) state.abort.abort();

  if (state.requestId) {
    try {
      await chrome.runtime.sendMessage({
        type: "AEGIS_POPUP_DECISION",
        requestId: state.requestId,
        approved,
        analysis: state.analysis,
      });
    } catch {
      // The worker is gone; closing the window still cancels the request.
    }
  }
  window.close();
}

// ── Screen 1: review ─────────────────────────────────────────────────

function renderReview() {
  const { params, summary } = state;

  $("rv-sender").textContent = shortAddress(summary.sender ?? params.sender, 10, 6);
  $("rv-sender").title = summary.sender ?? params.sender;
  $("rv-network").textContent = params.network;
  $("rv-commands").textContent = `${summary.commandCount} ${
    summary.commandCount === 1 ? "command" : "commands"
  }`;

  if (summary.splitTotalMist > 0n) {
    $("rv-amount-row").hidden = false;
    $("rv-amount").textContent = `${formatSui(summary.splitTotalMist)} SUI`;
  }

  if (summary.recipients.length > 0) {
    $("rv-recipient-row").hidden = false;
    const isSelf =
      summary.recipients.length === 1 &&
      summary.recipients[0].toLowerCase() === (summary.sender ?? "").toLowerCase();
    const label =
      summary.recipients.length > 1
        ? `${summary.recipients.length} addresses`
        : shortAddress(summary.recipients[0], 10, 6) + (isSelf ? " (you)" : "");
    $("rv-recipient").textContent = label;
    $("rv-recipient").title = summary.recipients.join("\n");
  }

  if (summary.moveCalls.length > 0) {
    $("rv-calls-card").hidden = false;
    const list = $("rv-calls");
    list.replaceChildren(
      ...summary.moveCalls.map((call) => {
        const li = document.createElement("li");
        const pkg = document.createElement("span");
        pkg.className = "pkg";
        pkg.textContent = `${shortAddress(call.package, 8, 6)}::${call.module}::`;
        const fn = document.createElement("span");
        fn.className = "fn";
        fn.textContent = call.function;
        li.append(pkg, fn);
        return li;
      })
    );
  }

  const ops = [...new Set(state.summary.operations)];
  if (ops.length > 0) {
    const chips = $("rv-ops");
    chips.replaceChildren(
      ...ops.map((op) => {
        const span = document.createElement("span");
        span.className = "chip";
        const count = state.summary.operations.filter((o) => o === op).length;
        span.textContent = count > 1 ? `${op} ×${count}` : op;
        return span;
      })
    );
  } else {
    $("rv-ops-card").hidden = true;
  }

  setScreen("review");
  setActions({
    primary: "Analyze with AEGIS",
    secondary: "Cancel",
    onPrimary: runAnalysis,
    onSecondary: () => decide(false),
  });
}

// ── Screen 2: analyzing (Dynamic ReAct streaming from live agent) ────

const STEP_VERBS = {
  parse_ptb: { running: "parsing ptb...", done: "parsed ptb" },
  lookup_protocol: { running: "checking protocol registries...", done: "checked protocol registries" },
  plan_agent: { running: "routing security pipeline...", done: "routed security pipeline" },
  dry_run_rpc: { running: "simulating on sui rpc...", done: "simulated on sui rpc" },
  fetch_history: { running: "inspecting wallet history...", done: "inspected wallet history" },
  vector_search: { running: "scanning known exploit patterns...", done: "scanned known exploit patterns" },
  score_risk: { running: "computing safety score...", done: "computed safety score" },
};

// ── Screen 2: analyzing (Claude Code Expandable ReAct rendering) ──────

function setToolExpanded(toolName, expanded) {
  const call = state.toolCalls.find((t) => t.tool === toolName);
  if (call) call.expanded = expanded;

  for (const prefix of ["tool-node-", "recap-node-"]) {
    const node = $(`${prefix}${toolName}`);
    if (node) {
      const details = node.querySelector(".tool-details");
      const chevron = node.querySelector(".tool-chevron");
      if (details) {
        if (expanded) details.classList.add("expanded");
        else details.classList.remove("expanded");
      }
      if (chevron) {
        chevron.textContent = expanded ? "▾" : "▸";
      }
    }
  }
}

function toolNode(call, isRecap = false) {
  const li = document.createElement("li");
  li.className = `tool ${call.status === "running" ? "running" : call.status === "done" ? "done" : ""}`;
  li.id = isRecap ? `recap-node-${call.tool}` : `tool-node-${call.tool}`;

  const row = document.createElement("div");
  row.className = "tool-row";

  const left = document.createElement("div");
  left.className = "tool-left";

  const icon = document.createElement("span");
  icon.className = "tool-status-icon";
  if (call.status === "running") {
    const spinner = document.createElement("span");
    spinner.className = "tool-spinner";
    icon.appendChild(spinner);
  } else if (call.status === "done") {
    icon.className = "tool-status-icon icon-done";
    icon.textContent = "✓";
  } else if (call.status === "error") {
    icon.className = "tool-status-icon icon-error";
    icon.textContent = "✕";
  } else {
    icon.textContent = "•";
  }

  const defaultVerb = STEP_VERBS[call.tool] || { running: `${call.tool}...`, done: call.tool };
  const verbText = document.createElement("span");
  verbText.className = "tool-verb";
  verbText.textContent = call.status === "running" ? (call.verbRunning || defaultVerb.running) : (call.verbDone || defaultVerb.done);

  left.append(icon, verbText);

  const right = document.createElement("div");
  right.className = "tool-right";

  const timer = document.createElement("span");
  timer.className = "tool-timer";
  timer.id = isRecap ? `recap-timer-${call.tool}` : `timer-${call.tool}`;
  const displayElapsed =
    call.elapsedSec != null
      ? `${Number(call.elapsedSec).toFixed(1)}s`
      : call.status === "running"
      ? "0.0s"
      : "";
  timer.textContent = displayElapsed;

  const chevron = document.createElement("span");
  chevron.className = "tool-chevron";
  chevron.textContent = call.expanded ? "▾" : "▸";

  right.append(timer, chevron);
  row.append(left, right);
  li.append(row);

  // Expandable Detail Block
  const details = document.createElement("div");
  details.className = `tool-details ${call.expanded ? "expanded" : ""}`;

  // Direct click handler on the row toggles the local detail block and chevron
  row.onclick = (e) => {
    e.stopPropagation();
    const isNowExpanded = !details.classList.contains("expanded");
    call.expanded = isNowExpanded;
    if (isNowExpanded) {
      details.classList.add("expanded");
      chevron.textContent = "▾";
    } else {
      details.classList.remove("expanded");
      chevron.textContent = "▸";
    }
  };

  // 1. Thought Section
  if (call.thought) {
    const thoughtSec = document.createElement("div");
    thoughtSec.className = "react-section react-thought";
    const tag = document.createElement("span");
    tag.className = "react-tag";
    tag.textContent = "💭 THOUGHT";
    const text = document.createElement("p");
    text.className = "react-text thought-text";
    text.textContent = isRecap ? call.thought : call.renderedThought || call.thought;
    thoughtSec.append(tag, text);
    details.append(thoughtSec);
  }

  // 2. Action Section
  if (call.action) {
    const actionSec = document.createElement("div");
    actionSec.className = "react-section react-action";
    const tag = document.createElement("span");
    tag.className = "react-tag";
    tag.textContent = "⚡ ACTION";
    const text = document.createElement("p");
    text.className = "react-text action-text";
    text.textContent = call.action;
    actionSec.append(tag, text);
    details.append(actionSec);
  }

  // 3. Observation Section
  if (call.observation) {
    const obsSec = document.createElement("div");
    obsSec.className = "react-section react-observation";
    const tag = document.createElement("span");
    tag.className = "react-tag";
    tag.textContent = "🔍 OBSERVATION";
    const text = document.createElement("p");
    text.className = "react-text obs-text";
    text.textContent = isRecap ? call.observation : call.renderedObservation || call.observation;
    obsSec.append(tag, text);
    details.append(obsSec);
  }

  li.append(details);
  return li;
}

function renderTools(targetId) {
  const list = $(targetId);
  if (!list) return;
  if (state.toolCalls.length === 0) return;
  const isRecap = targetId === "tool-list-recap";
  list.replaceChildren(...state.toolCalls.map((c) => toolNode(c, isRecap)));
}

function renderThought(text, source) {
  $("thought-box").hidden = false;
  $("thought-text").textContent = text;
  const src = $("thought-src");
  src.hidden = !source;
  if (source) src.textContent = source;
}

// ── Pacing Queue, Timers & Typewriter Engine ─────────────────────────

const eventQueue = [];
let isProcessingQueue = false;
let stopQueue = false;
let liveTimerInterval = null;

function startLiveTimer() {
  if (liveTimerInterval) return;
  liveTimerInterval = setInterval(() => {
    const runningStep = state.toolCalls.find((t) => t.status === "running");
    if (!runningStep || !runningStep.startTime) return;
    const elapsed = ((performance.now() - runningStep.startTime) / 1000).toFixed(1);
    runningStep.elapsedSec = elapsed;
    const timerEl = $(`timer-${runningStep.tool}`);
    if (timerEl) {
      timerEl.textContent = `${elapsed}s`;
    }
  }, 100);
}

function stopLiveTimer() {
  if (liveTimerInterval) {
    clearInterval(liveTimerInterval);
    liveTimerInterval = null;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function scrollToBottom() {
  const body = document.querySelector(".body");
  if (body) {
    body.scrollTop = body.scrollHeight;
  }
}

async function typewriteText(element, fullText, speed = 14) {
  if (!element || !fullText) return;
  element.textContent = "";
  const cursor = document.createElement("span");
  cursor.className = "typewriter-cursor";
  element.appendChild(cursor);

  for (let i = 0; i < fullText.length; i++) {
    if (stopQueue) break;
    element.textContent = fullText.slice(0, i + 1);
    element.appendChild(cursor);
    scrollToBottom();
    await sleep(speed);
  }
  element.textContent = fullText;
}

async function processQueue() {
  if (isProcessingQueue) return;
  isProcessingQueue = true;

  while (eventQueue.length > 0 && !stopQueue) {
    const event = eventQueue.shift();

    if (event.type === "tool_start") {
      let call = state.toolCalls.find((t) => t.tool === event.tool);

      if (!call) {
        call = {
          tool: event.tool,
          status: "running",
          startTime: performance.now(),
          expanded: true,
          thought: event.thought || "",
          action: event.action || event.label || event.tool,
          verbRunning: event.verbRunning || "",
          verbDone: event.verbDone || "",
          observation: "",
          renderedThought: "",
          renderedObservation: "",
        };
        state.toolCalls.push(call);
      } else {
        call.status = "running";
        call.startTime = performance.now();
        call.expanded = true;
        if (event.thought) call.thought = event.thought;
        if (event.action || event.label) call.action = event.action || event.label;
        if (event.verbRunning) call.verbRunning = event.verbRunning;
        if (event.verbDone) call.verbDone = event.verbDone;
      }

      startLiveTimer();
      renderTools("tool-list");
      const node = $(`tool-node-${call.tool}`);
      const thoughtEl = node?.querySelector(".react-thought .react-text");
      if (thoughtEl && call.thought) {
        await typewriteText(thoughtEl, call.thought, 14);
        call.renderedThought = call.thought;
      }
      scrollToBottom();
      await sleep(350);
    } else if (event.type === "tool_end") {
      let call = state.toolCalls.find((t) => t.tool === event.tool);
      if (call) {
        call.status = "done";
        call.endTime = performance.now();
        call.elapsedSec = (
          (call.endTime - (call.startTime || performance.now())) /
          1000
        ).toFixed(1);

        if (event.thought) call.thought = event.thought;
        if (event.verbDone) call.verbDone = event.verbDone;
        call.observation = event.observation || event.summary || "Completed.";

        renderTools("tool-list");
        const node = $(`tool-node-${call.tool}`);
        const obsEl = node?.querySelector(".react-observation .react-text");
        if (obsEl && call.observation) {
          await typewriteText(obsEl, call.observation, 14);
          call.renderedObservation = call.observation;
        }
        scrollToBottom();

        // Auto-collapse after ~500ms so it stays clean and compact
        await sleep(500);
        setToolExpanded(call.tool, false);
        await sleep(150);
      }
    } else if (event.type === "thought") {
      renderThought(event.text, event.source);
      const textEl = $("thought-text");
      if (textEl && event.text) {
        await typewriteText(textEl, event.text, 14);
      }
    } else if (event.type === "result") {
      stopLiveTimer();
      await sleep(800);
      if (event.data) renderVerdict(event.data);
    }
  }

  isProcessingQueue = false;
}

// ── Screen 3: verdict ────────────────────────────────────────────────

function isSuiCoin(coinType) {
  return /^0x0*2::sui::SUI$/i.test(coinType) || coinType === "SUI";
}

function formatBalanceChange(amount, coinType) {
  const value = Number(amount);
  const sign = value > 0 ? "+" : "";
  if (isSuiCoin(coinType)) {
    return `${sign}${(value / 1e9).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    })} SUI`;
  }
  const parts = String(coinType).split("::");
  return `${sign}${value.toLocaleString()} ${parts[parts.length - 1] ?? coinType}`;
}

function fill(listId, cardId, items, build) {
  const card = $(cardId);
  const list = $(listId);
  if (!items || items.length === 0) {
    if (card) card.hidden = true;
    return;
  }
  if (card) card.hidden = false;
  if (list) list.replaceChildren(...items.map(build));
}

function renderVerdict(analysis) {
  state.analysis = analysis;

  const recommendation = VERDICT_COPY[analysis.recommendation] ? analysis.recommendation : "caution";
  const copy = VERDICT_COPY[recommendation];
  const score = Number.isFinite(Number(analysis.riskScore)) ? Number(analysis.riskScore) : 0;

  $("verdict-banner").className = `verdict ${copy.cls}`;
  $("verdict-title").textContent = copy.title;
  $("verdict-score").textContent = `${score}/100`;
  $("verdict-explanation").textContent =
    analysis.explanation || "The agent returned no explanation for this transaction.";
  requestAnimationFrame(() => {
    $("score-fill").style.width = `${Math.min(100, Math.max(score, 3))}%`;
  });

  fill("flags-list", "flags-card", analysis.riskFlags, (flag) => {
    const li = document.createElement("li");
    li.textContent = flag;
    return li;
  });

  const changes = analysis.simulation?.balanceChanges;
  if (changes?.length) {
    $("balance-label").textContent =
      analysis.simulation.status === "estimated"
        ? "Estimated balance changes"
        : "Simulated balance changes";
  }
  fill("balance-list", "balance-card", changes, (b) => {
    const li = document.createElement("li");
    li.className = Number(b.amount) < 0 ? "neg" : "pos";
    li.textContent = formatBalanceChange(b.amount, b.coinType);
    return li;
  });

  fill("protocol-list", "protocols-card", analysis.protocols, (p) => {
    const li = document.createElement("li");
    const name = document.createElement("span");
    name.className = `p-name${p.name === "Unknown" ? " unknown" : ""}`;
    name.textContent = p.name;
    const meta = document.createElement("span");
    meta.className = "p-meta";
    meta.textContent = `${p.category} · ${p.audited ? "audited" : "unaudited"}`;
    li.append(name, meta);
    return li;
  });

  fill("pattern-list", "patterns-card", analysis.similarPatterns, (pat) => {
    const li = document.createElement("li");
    const desc = document.createElement("span");
    desc.textContent = pat.description;
    const meta = document.createElement("span");
    meta.className = "p-meta";
    meta.textContent = `${Math.round((pat.similarity ?? 0) * 100)}% · ${pat.riskLevel}`;
    li.append(desc, meta);
    return li;
  });

  if (state.toolCalls.length > 0) {
    renderTools("tool-list-recap");
  } else {
    $("tool-recap").hidden = true;
  }

  renderGonkaVerification(analysis.gonkaVerification, analysis);

  setScreen("verdict");
  setActions({
    primary: copy.cta,
    primaryClass: copy.ctaCls,
    secondary: "Reject",
    onPrimary: () => decide(true),
    onSecondary: () => decide(false),
  });
}

function formatModelDisplayName(model) {
  if (!model) return "Model";
  if (model.toLowerCase().includes("deepseek")) return "DeepSeek V4";
  if (model.toLowerCase().includes("minimax")) return "MiniMax M2.7";
  if (model.toLowerCase().includes("kimi")) return "Kimi K2.6";
  const parts = model.split("/");
  return parts[parts.length - 1] || model;
}

function formatShortReqId(id) {
  if (!id) return "req-proof";
  if (id.startsWith("fallback-")) return "simulated";
  if (id.length > 18) {
    return `${id.slice(0, 8)}…${id.slice(-4)}`;
  }
  return id;
}

function renderGonkaVerification(gonka, analysis) {
  const card = $("gonka-card");
  if (!card) return;

  if (!gonka) {
    card.hidden = true;
    return;
  }
  card.hidden = false;

  const truthScore = Number.isFinite(Number(gonka.consensusTruthScore))
    ? Math.round(Number(gonka.consensusTruthScore))
    : 75;
  $("gonka-truth-badge").textContent = `${truthScore}% Truth`;

  const consensusPill = $("gonka-consensus-pill");
  if (consensusPill) {
    consensusPill.textContent = gonka.consensusAgreement
      ? "Dual-Model Verified"
      : "Reconciled";
    consensusPill.className = `gonka-consensus-tag${gonka.consensusAgreement ? "" : " conflict"}`;
  }

  const conflictBox = $("gonka-conflict-box");
  const conflictText = $("gonka-conflict-text");
  if (conflictBox && conflictText) {
    if (!gonka.consensusAgreement && gonka.conflictResolution) {
      conflictBox.removeAttribute("hidden");
      conflictText.textContent = gonka.conflictResolution;
    } else {
      conflictBox.setAttribute("hidden", "");
      conflictText.textContent = "";
    }
  }

  // Model 1 (Primary)
  const p = gonka.models?.primary;
  if (p) {
    const pName = formatModelDisplayName(p.model);
    $("primary-model-name").textContent = pName;
    const pVerdict = $("primary-verdict");
    if (pVerdict) {
      pVerdict.textContent = `${p.verdict} · ${p.truthScore}%`;
      pVerdict.className = `model-badge ${p.verdict}`;
    }
    $("primary-req-id").textContent = formatShortReqId(p.requestId);

    const pBtn = $("primary-req-btn");
    if (pBtn && p.requestId) {
      pBtn.onclick = () => copyToClipboard(p.requestId, $("primary-copy-icon"), pBtn);
    }

    $("primary-trace-title").textContent = `${pName} Reasoning Trace`;
    $("primary-reasoning-body").textContent = p.reasoningTrace || "No trace provided.";
    fill("primary-evidence-ul", null, p.evidenceCitations || [], (ev) => {
      const li = document.createElement("li");
      li.textContent = ev;
      return li;
    });
  }

  // Model 2 (Secondary)
  const s = gonka.models?.secondary;
  if (s) {
    const sName = formatModelDisplayName(s.model);
    $("secondary-model-name").textContent = sName;
    const sVerdict = $("secondary-verdict");
    if (sVerdict) {
      sVerdict.textContent = `${s.verdict} · ${s.truthScore}%`;
      sVerdict.className = `model-badge ${s.verdict}`;
    }
    $("secondary-req-id").textContent = formatShortReqId(s.requestId);

    const sBtn = $("secondary-req-btn");
    if (sBtn && s.requestId) {
      sBtn.onclick = () => copyToClipboard(s.requestId, $("secondary-copy-icon"), sBtn);
    }

    $("secondary-trace-title").textContent = `${sName} Reasoning Trace`;
    $("secondary-reasoning-body").textContent = s.reasoningTrace || "No trace provided.";
    fill("secondary-evidence-ul", null, s.evidenceCitations || [], (ev) => {
      const li = document.createElement("li");
      li.textContent = ev;
      return li;
    });
  }

  // Walrus Decentralized Audit Dossier Proof
  const walrusRow = $("walrus-proof-row");
  const walrusBlobId = $("walrus-blob-id");
  const walrusLink = $("walrus-blob-link");
  if (walrusRow && walrusBlobId && walrusLink) {
    if (analysis?.walrusBlobId) {
      walrusRow.removeAttribute("hidden");
      const shortBlob = analysis.walrusBlobId.length > 18
        ? `blob-${analysis.walrusBlobId.slice(0, 7)}…${analysis.walrusBlobId.slice(-4)}`
        : analysis.walrusBlobId;
      walrusBlobId.textContent = shortBlob;
      walrusLink.href = `https://aggregator.walrus-testnet.walrus.space/v1/blobs/${analysis.walrusBlobId}`;
      walrusLink.title = "View raw verified audit dossier on Walrus Aggregator";
    } else {
      walrusRow.setAttribute("hidden", "");
    }
  }

  // Ensure details is collapsed by default
  const details = $("gonka-traces-details");
  if (details) details.open = false;
}

async function copyToClipboard(text, iconEl, btnEl) {
  try {
    await navigator.clipboard.writeText(text);
    if (iconEl) iconEl.textContent = "✓";
    if (btnEl) btnEl.classList.add("copied");
    setTimeout(() => {
      if (iconEl) iconEl.textContent = "📋";
      if (btnEl) btnEl.classList.remove("copied");
    }, 1800);
  } catch (err) {
    console.error("Clipboard copy failed:", err);
  }
}

// ── Error ────────────────────────────────────────────────────────────

function showError(title, message) {
  $("error-title").textContent = title;
  $("error-text").textContent = message;
  $("agent-url-error").value = state.agentUrl;
  setScreen("error");
}

/** Recoverable: the user can fix the agent URL and run again. */
function renderError(title, message) {
  showError(title, message);
  setActions({
    primary: "Retry",
    secondary: "Cancel",
    onPrimary: async () => {
      await setAgentUrl($("agent-url-error").value);
      runAnalysis();
    },
    onSecondary: () => decide(false),
  });
}

/** Unrecoverable: there is no request left to answer, so only offer Close. */
function renderFatal(title, message) {
  state.decided = true;
  showError(title, message);
  setActions({ primary: "Close", onPrimary: () => window.close() });
}

function handleEvent(payload) {
  if (!payload || typeof payload !== "object") return;
  if (payload.type === "error") {
    throw new Error(payload.message || "The agent reported a failure.");
  }
  eventQueue.push(payload);
  void processQueue();
}

async function runAnalysis() {
  stopQueue = false;
  eventQueue.length = 0;
  state.toolCalls = [];
  state.analysis = null;
  $("thought-box").hidden = true;

  const waiting = document.createElement("li");
  waiting.className = "tool tool-waiting";
  const spinner = document.createElement("span");
  spinner.className = "tool-spinner";
  const waitingLabel = document.createElement("span");
  waitingLabel.className = "tool-name";
  waitingLabel.textContent = "connecting to agent…";
  waiting.append(spinner, waitingLabel);
  $("tool-list").replaceChildren(waiting);

  setScreen("analyzing");
  setActions({
    primary: "Analyzing…",
    primaryDisabled: true,
    secondary: "Cancel",
    onSecondary: () => {
      stopQueue = true;
      decide(false);
    },
  });

  const controller = new AbortController();
  state.abort = controller;

  let response;
  try {
    response = await fetch(`${state.agentUrl}/analyze-stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rawPtb: state.params.transaction,
        walletAddress: state.params.sender,
      }),
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (e) {
    if (controller.signal.aborted) return;
    renderError(
      "Agent unreachable",
      `Could not reach the AEGIS agent server at ${state.agentUrl}. Start it, or point AEGIS at the right address below. (${
        e?.message ?? "network error"
      })`
    );
    return;
  }

  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const body = await response.json();
      detail = body.message || body.error || detail;
    } catch {
      // Body wasn't JSON; the status line is all we have.
    }
    renderError("Agent returned an error", detail);
    return;
  }

  // The endpoint streams SSE, but tolerate a plain-JSON response so a
  // non-streaming agent build still works here.
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/event-stream")) {
    try {
      const data = await response.json();
      if (data && data.error) {
        renderError("Agent returned an error", data.message || data.error);
        return;
      }
      renderVerdict(data);
    } catch (e) {
      renderError("Unreadable response", e?.message ?? "The agent's response could not be parsed.");
    }
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";

      for (const frame of frames) {
        for (const line of frame.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const raw = trimmed.slice(5).trim();
          if (!raw || raw === "[DONE]") continue;

          let payload;
          try {
            payload = JSON.parse(raw);
          } catch {
            continue; // keep-alive or partial frame; skip it
          }
          handleEvent(payload);
        }
      }
    }

    // Wait for the animated presentation queue to finish displaying all steps
    while ((isProcessingQueue || eventQueue.length > 0) && !controller.signal.aborted) {
      await sleep(50);
    }
  } catch (e) {
    if (controller.signal.aborted) return;
    renderError("Analysis failed", e?.message ?? "The agent stream ended unexpectedly.");
    return;
  } finally {
    stopLiveTimer();
    state.abort = null;
  }

  if (!state.analysis && !controller.signal.aborted && !stopQueue) {
    renderError(
      "No verdict returned",
      "The agent stream closed without emitting a result. Check the agent server logs and retry."
    );
  }
}

// ── Idle screen (opened from the toolbar) ────────────────────────────

async function pingAgent(url) {
  const status = $("agent-status-idle");
  status.className = "hint";
  status.textContent = "Checking…";
  try {
    const res = await fetch(`${url}/health`, { cache: "no-store" });
    status.className = res.ok ? "hint ok" : "hint bad";
    status.textContent = res.ok
      ? "Agent server reachable."
      : `Agent server responded with HTTP ${res.status}.`;
  } catch {
    status.className = "hint bad";
    status.textContent = "Agent server not reachable. Start it before running an analysis.";
  }
}

function renderIdle() {
  $("agent-url-idle").value = state.agentUrl;
  $("save-url-idle").onclick = async () => {
    await setAgentUrl($("agent-url-idle").value);
    $("agent-url-idle").value = state.agentUrl;
    pingAgent(state.agentUrl);
  };
  setScreen("idle");
  setActions(null);
  pingAgent(state.agentUrl);
}

// ── Boot ─────────────────────────────────────────────────────────────

async function main() {
  state.agentUrl = await getAgentUrl();

  // The anchored panel is opened by chrome.action.openPopup() and so carries no
  // query string — ask the worker for whatever is pending. The fallback window
  // names its request explicitly.
  const urlRequestId = new URLSearchParams(window.location.search).get("requestId");

  let res;
  try {
    res = await chrome.runtime.sendMessage({
      type: "AEGIS_POPUP_GET",
      requestId: urlRequestId ?? undefined,
    });
  } catch {
    res = null;
  }

  if (!res || !res.ok) {
    // Clicking the toolbar icon with nothing pending is the normal way to
    // reach the status screen; a named request that's gone is an error.
    if (urlRequestId) {
      renderFatal(
        "Request expired",
        "This confirmation is no longer pending — the page may have navigated away. Close this and run the analysis again."
      );
    } else {
      renderIdle();
    }
    return;
  }

  state.requestId = res.request.requestId;
  state.origin = res.request.origin;
  state.params = res.request.params;
  holdPort(state.requestId);

  const pill = $("network-pill");
  pill.hidden = false;
  pill.textContent = state.params.network ?? "testnet";

  const bar = $("origin-bar");
  bar.hidden = false;
  try {
    $("origin-host").textContent = new URL(state.origin).host;
  } catch {
    $("origin-host").textContent = state.origin ?? "unknown site";
  }

  state.summary = summarizeTransaction(state.params.transaction);
  if (!state.summary.ok) {
    renderError("Unreadable transaction", state.summary.error ?? "The transaction payload could not be parsed.");
    return;
  }

  renderReview();
}

// Closing this surface without deciding — clicking away from the panel, or
// closing the fallback window — cancels the request via the port held above,
// so the page's promise always resolves.
main();
