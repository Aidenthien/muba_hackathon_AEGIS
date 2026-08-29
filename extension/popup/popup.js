/**
 * Confirmation popup controller.
 *
 * Screens: review → analyzing → verdict (or error). The agent server is called
 * from here rather than from the service worker so the request dies with the
 * window, and so the page never sits between the user and the verdict.
 */
import { summarizeTransaction, formatSui, shortAddress } from "../lib/ptb.js";

const DEFAULT_AGENT_URL = "http://localhost:3001";
const AGENT_URL_KEY = "agentServerUrl";

const TOOL_ICONS = {
  parse_ptb: "🔧",
  lookup_protocol: "🌐",
  plan_agent: "🧠",
  dry_run_rpc: "⚡",
  fetch_history: "📜",
  vector_search: "🔍",
  score_risk: "🛡️",
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
    if (typeof url === "string" && url.trim()) return url.trim().replace(/\/+$/, "");
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

// ── Screen 2: analyzing ──────────────────────────────────────────────

function toolNode(call) {
  const li = document.createElement("li");
  li.className = `tool ${call.status === "running" ? "running" : "done"}`;

  const icon = document.createElement("span");
  icon.className = "tool-icon";
  icon.textContent = TOOL_ICONS[call.tool] ?? "🔧";

  const name = document.createElement("span");
  name.className = "tool-name";
  name.textContent = call.tool;
  if (call.label) {
    const label = document.createElement("span");
    label.className = "tool-label";
    label.textContent = call.label;
    name.append(label);
  }

  const stateTag = document.createElement("span");
  stateTag.className = "tool-state";
  stateTag.textContent = call.status === "running" ? "running" : "done";

  li.append(icon, name, stateTag);

  if (call.summary) {
    const p = document.createElement("p");
    p.className = "tool-summary";
    p.textContent = call.summary;
    li.append(p);
  }
  return li;
}

function renderTools(targetId) {
  const list = $(targetId);
  if (!list) return;
  if (state.toolCalls.length === 0) return;
  list.replaceChildren(...state.toolCalls.map(toolNode));
}

function renderThought(text, source) {
  $("thought-box").hidden = false;
  $("thought-text").textContent = text;
  const src = $("thought-src");
  src.hidden = !source;
  if (source) src.textContent = source;
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
  if (!items || items.length === 0) return;
  $(cardId).hidden = false;
  $(listId).replaceChildren(...items.map(build));
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

  setScreen("verdict");
  setActions({
    primary: copy.cta,
    primaryClass: copy.ctaCls,
    secondary: "Reject",
    onPrimary: () => decide(true),
    onSecondary: () => decide(false),
  });
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

// ── The analysis run ─────────────────────────────────────────────────

function handleEvent(payload) {
  if (!payload || typeof payload !== "object") return;

  switch (payload.type) {
    case "tool_start": {
      const existing = state.toolCalls.find((t) => t.tool === payload.tool);
      if (existing) {
        existing.status = "running";
        existing.label = payload.label ?? existing.label;
      } else {
        state.toolCalls.push({
          tool: payload.tool,
          label: payload.label ?? "",
          status: "running",
        });
      }
      renderTools("tool-list");
      break;
    }
    case "tool_end": {
      const call = state.toolCalls.find((t) => t.tool === payload.tool);
      if (call) {
        call.status = "completed";
        call.summary = payload.summary ?? call.summary;
      }
      renderTools("tool-list");
      break;
    }
    case "thought":
      renderThought(payload.text, payload.source);
      break;
    case "result":
      if (payload.data) renderVerdict(payload.data);
      break;
    case "error":
      throw new Error(payload.message || "The agent reported a failure.");
    default:
      break;
  }
}

async function runAnalysis() {
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
    onSecondary: () => decide(false),
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
  } catch (e) {
    if (controller.signal.aborted) return;
    renderError("Analysis failed", e?.message ?? "The agent stream ended unexpectedly.");
    return;
  } finally {
    state.abort = null;
  }

  if (!state.analysis) {
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
