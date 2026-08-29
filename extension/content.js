/**
 * ISOLATED-world bridge between the page's `window.aegis` (inpage.js) and the
 * service worker.
 *
 * Uses a long-lived Port rather than one-shot sendMessage: a confirmation can
 * sit open for minutes while the user reads the verdict, and an MV3 service
 * worker is torn down after ~30s idle. A connected port keeps it alive and
 * gives us a disconnect signal to fail pending requests cleanly.
 */
(() => {
  "use strict";

  const TARGET_ORIGIN =
    window.location.origin && window.location.origin !== "null"
      ? window.location.origin
      : "*";

  /** id -> true, for requests we've forwarded and not yet answered. */
  const inflight = new Set();
  let port = null;

  function toPage(payload) {
    window.postMessage({ __aegis: true, direction: "to-page", ...payload }, TARGET_ORIGIN);
  }

  function failAll(message, code) {
    for (const id of inflight) toPage({ id, error: { code, message } });
    inflight.clear();
  }

  function getPort() {
    if (port) return port;
    try {
      port = chrome.runtime.connect({ name: "aegis-page" });
    } catch {
      return null; // extension reloaded or context invalidated
    }

    port.onMessage.addListener((msg) => {
      if (!msg || !msg.id) return;
      inflight.delete(msg.id);
      toPage({ id: msg.id, result: msg.result, error: msg.error });
    });

    port.onDisconnect.addListener(() => {
      port = null;
      failAll(
        "The AEGIS extension was reloaded or disconnected. Refresh the page and try again.",
        "DISCONNECTED"
      );
    });

    return port;
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const msg = event.data;
    if (!msg || msg.__aegis !== true || msg.direction !== "to-extension") return;

    const p = getPort();
    if (!p) {
      toPage({
        id: msg.id,
        error: {
          code: "DISCONNECTED",
          message: "The AEGIS extension is not reachable. Refresh the page and try again.",
        },
      });
      return;
    }

    inflight.add(msg.id);
    try {
      p.postMessage({
        id: msg.id,
        method: msg.method,
        params: msg.params,
        origin: window.location.origin,
      });
    } catch {
      inflight.delete(msg.id);
      toPage({
        id: msg.id,
        error: { code: "DISCONNECTED", message: "Could not reach the AEGIS extension." },
      });
    }
  });
})();
