/**
 * Service worker: routes a page's `aegis.analyze()` call to a confirmation
 * surface and returns the user's decision.
 *
 * Presentation is the toolbar-anchored panel (chrome.action.openPopup), the
 * same surface you get clicking a wallet's icon. That API only exists in
 * Chrome 127+ and can refuse when no browser window is focused, so a standalone
 * popup window is kept as an automatic fallback.
 *
 * It deliberately does NOT talk to the agent server — the popup does that
 * itself. Keeping the network call in the surface that renders the verdict
 * means the page never sits in the trust path, and the analysis is torn down
 * with the popup if the user walks away.
 */

const POPUP_WIDTH = 396;
const POPUP_HEIGHT = 640;

/** requestId -> { id, port, params, origin, mode, windowId, settled } */
const requests = new Map();
/** windowId -> requestId (window fallback only) */
const windows = new Map();
/** popup Port -> requestId, so closing the panel cancels the request */
const popupPorts = new Map();

function newRequestId() {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function updateBadge() {
  const pending = requests.size;
  chrome.action.setBadgeText({ text: pending ? String(pending) : "" });
  chrome.action.setBadgeBackgroundColor({ color: "#4da2ff" });
}

// Keep-alive heartbeat while any confirmations are pending so MV3 doesn't kill the worker
setInterval(() => {
  if (requests.size > 0) {
    for (const req of requests.values()) {
      try {
        req.port.postMessage({ __heartbeat: true });
      } catch {}
    }
  }
}, 8000);

function settle(requestId, result, error) {
  const req = requests.get(requestId);
  if (!req || req.settled) return;
  req.settled = true;
  requests.delete(requestId);
  if (req.windowId != null) windows.delete(req.windowId);
  updateBadge();

  try {
    req.port.postMessage({ id: req.id, result, error });
  } catch {
    // The page navigated away mid-confirmation; nothing left to answer.
  }
}

/** Standalone window, positioned top-right of the active window like a wallet. */
async function openConfirmationWindow(requestId) {
  let top = 80;
  let left = 100;
  try {
    const focused = await chrome.windows.getLastFocused();
    if (focused && focused.width != null && focused.left != null) {
      top = Math.max(0, (focused.top ?? 0) + 72);
      left = Math.max(0, focused.left + focused.width - POPUP_WIDTH - 24);
    }
  } catch {
    // Fall back to the defaults above.
  }

  const url = chrome.runtime.getURL(
    `popup/popup.html?requestId=${encodeURIComponent(requestId)}&mode=window`
  );
  const win = await chrome.windows.create({
    url,
    type: "popup",
    width: POPUP_WIDTH,
    height: POPUP_HEIGHT,
    top,
    left,
    focused: true,
  });
  return win.id;
}

/**
 * Prefers the anchored panel; falls back to a window. The panel carries no
 * requestId in its URL, so the popup asks for whatever is pending instead.
 */
async function presentConfirmation(requestId) {
  if (typeof chrome.action?.openPopup === "function") {
    try {
      await chrome.action.openPopup();
      return { mode: "panel", windowId: null };
    } catch {
      // Chrome < 127, no focused window, or the browser refused — use a window.
    }
  }
  const windowId = await openConfirmationWindow(requestId);
  return { mode: "window", windowId };
}

// ── Page ⇄ worker ────────────────────────────────────────────────────
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "aegis-popup") {
    // The confirmation surface itself. Its disconnect is how we learn the
    // panel closed — anchored panels get no windows.onRemoved event.
    port.onMessage.addListener((msg) => {
      if (!msg) return;
      if (msg.requestId) popupPorts.set(port, msg.requestId);
      if (msg.type === "AEGIS_POPUP_DECISION" && msg.requestId) {
        popupPorts.delete(port);
        settle(msg.requestId, {
          status: msg.approved ? "approved" : "rejected",
          analysis: msg.analysis ?? null,
          requestId: msg.requestId,
        });
      }
    });
    port.onDisconnect.addListener(() => {
      const requestId = popupPorts.get(port);
      popupPorts.delete(port);
      if (!requestId) return;
      // No-op if the user already decided; settle() guards on that.
      settle(requestId, { status: "cancelled", analysis: null, requestId });
    });
    return;
  }

  if (port.name !== "aegis-page") return;

  port.onMessage.addListener(async (msg) => {
    if (!msg) return;
    if (msg.__heartbeat) return;
    if (!msg.id) return;

    if (msg.method === "ping") {
      port.postMessage({
        id: msg.id,
        result: { ok: true, version: chrome.runtime.getManifest().version },
      });
      return;
    }

    if (msg.method !== "analyze") {
      port.postMessage({
        id: msg.id,
        error: { code: "UNSUPPORTED_METHOD", message: `Unknown method: ${msg.method}` },
      });
      return;
    }

    // One confirmation at a time, exactly like a wallet.
    if (requests.size > 0) {
      const [existing] = requests.values();
      try {
        if (existing.mode === "window" && existing.windowId != null) {
          await chrome.windows.update(existing.windowId, { focused: true, drawAttention: true });
        } else if (typeof chrome.action?.openPopup === "function") {
          await chrome.action.openPopup();
        }
      } catch {
        // Surface is gone but its cleanup hasn't fired yet; let it settle.
      }
      port.postMessage({
        id: msg.id,
        error: {
          code: "REQUEST_PENDING",
          message: "An AEGIS confirmation is already open. Finish it before starting another.",
        },
      });
      return;
    }

    const requestId = newRequestId();
    requests.set(requestId, {
      id: msg.id,
      port,
      params: msg.params,
      origin: msg.origin,
      mode: null,
      windowId: null,
      settled: false,
      createdAt: Date.now(),
    });
    updateBadge();

    try {
      const { mode, windowId } = await presentConfirmation(requestId);
      const req = requests.get(requestId);
      if (!req) {
        // Settled already (page disconnected); close the orphan window.
        if (windowId != null) chrome.windows.remove(windowId).catch(() => {});
        return;
      }
      req.mode = mode;
      req.windowId = windowId;
      if (windowId != null) windows.set(windowId, requestId);
    } catch (e) {
      settle(requestId, undefined, {
        code: "POPUP_FAILED",
        message: e && e.message ? e.message : "Could not open the AEGIS confirmation.",
      });
    }
  });

  // If the page goes away mid-flight, drop its requests and close their windows.
  port.onDisconnect.addListener(() => {
    for (const [requestId, req] of [...requests.entries()]) {
      if (req.port !== port) continue;
      req.settled = true;
      requests.delete(requestId);
      if (req.windowId != null) {
        windows.delete(req.windowId);
        chrome.windows.remove(req.windowId).catch(() => {});
      }
    }
    updateBadge();
  });
});

// ── Popup ⇄ worker ───────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || typeof msg.type !== "string") return;

  if (msg.type === "AEGIS_POPUP_GET") {
    // The panel has no requestId in its URL — hand it whatever is pending.
    const entry = msg.requestId
      ? [msg.requestId, requests.get(msg.requestId)]
      : [...requests.entries()].find(([, r]) => !r.settled) ?? [];
    const [requestId, req] = entry;

    sendResponse(
      req
        ? { ok: true, request: { requestId, origin: req.origin, params: req.params } }
        : { ok: false, reason: "not_found" }
    );
    return;
  }

  if (msg.type === "AEGIS_POPUP_DECISION") {
    for (const [p, reqId] of popupPorts.entries()) {
      if (reqId === msg.requestId) popupPorts.delete(p);
    }
    settle(msg.requestId, {
      status: msg.approved ? "approved" : "rejected",
      analysis: msg.analysis ?? null,
      requestId: msg.requestId,
    });
    sendResponse({ ok: true });
    return;
  }

  if (msg.type === "AEGIS_POPUP_STATUS") {
    sendResponse({ ok: true, pending: requests.size });
    return;
  }
});

// Closing the fallback window without deciding is a cancellation.
chrome.windows.onRemoved.addListener((windowId) => {
  const requestId = windows.get(windowId);
  if (!requestId) return;
  windows.delete(windowId);
  settle(requestId, { status: "cancelled", analysis: null, requestId });
});

chrome.runtime.onInstalled.addListener(() => updateBadge());
