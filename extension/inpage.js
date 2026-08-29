/**
 * Runs in the page's MAIN world at document_start, so `window.aegis` exists
 * before any dApp script runs. This half cannot touch chrome.* APIs — it talks
 * to content.js (ISOLATED world) over window.postMessage, which relays to the
 * service worker.
 *
 * Wire format, both directions:
 *   { __aegis: true, direction: "to-extension" | "to-page", id, ... }
 */
(() => {
  "use strict";

  const VERSION = "0.1.0";
  const RDNS = "xyz.aegis.oracle";

  // A sandboxed document reports origin "null", which postMessage rejects as a
  // target. Fall back to "*" there — the listener still checks event.source.
  const TARGET_ORIGIN =
    window.location.origin && window.location.origin !== "null"
      ? window.location.origin
      : "*";

  const pending = new Map();
  let seq = 0;

  function request(method, params) {
    return new Promise((resolve, reject) => {
      const id = `aegis:${Date.now().toString(36)}:${seq++}`;
      pending.set(id, { resolve, reject });
      window.postMessage(
        { __aegis: true, direction: "to-extension", id, method, params },
        TARGET_ORIGIN
      );
    });
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const msg = event.data;
    if (!msg || msg.__aegis !== true || msg.direction !== "to-page") return;

    const entry = pending.get(msg.id);
    if (!entry) return;
    pending.delete(msg.id);

    if (msg.error) {
      const err = new Error(msg.error.message || "AEGIS request failed");
      err.code = msg.error.code || "UNKNOWN";
      entry.reject(err);
    } else {
      entry.resolve(msg.result);
    }
  });

  const provider = {
    isAegis: true,
    version: VERSION,
    rdns: RDNS,

    /**
     * Opens the AEGIS confirmation popup for a transaction and resolves once
     * the user decides.
     *
     * @param {{ transaction: string, sender: string, network?: string, label?: string }} params
     *   `transaction` is the JSON string from `tx.toJSON()`.
     * @returns {Promise<{ status: "approved"|"rejected"|"cancelled", analysis: object|null, requestId: string }>}
     */
    analyze(params) {
      if (!params || typeof params.transaction !== "string") {
        return Promise.reject(
          new Error("aegis.analyze: `transaction` must be the JSON string from tx.toJSON()")
        );
      }
      if (!params.sender) {
        return Promise.reject(new Error("aegis.analyze: `sender` is required"));
      }
      return request("analyze", {
        transaction: params.transaction,
        sender: params.sender,
        network: params.network || "testnet",
        label: params.label || null,
      });
    },

    /** Liveness check — resolves with provider info if the extension is healthy. */
    ping() {
      return request("ping", {});
    },
  };

  Object.defineProperty(window, "aegis", {
    value: Object.freeze(provider),
    writable: false,
    configurable: false,
    enumerable: false,
  });

  // Announce for dApps that loaded before the extension (mirrors EIP-6963's
  // announce pattern). The SDK listens for this as a fallback to polling.
  window.dispatchEvent(
    new CustomEvent("aegis#initialized", {
      detail: { name: "AEGIS", rdns: RDNS, version: VERSION },
    })
  );
})();
