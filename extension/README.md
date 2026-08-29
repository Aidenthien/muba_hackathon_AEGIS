# AEGIS — browser extension

The pre-execution security oracle, as a real Chrome MV3 extension. Any dApp
that calls `aegis.analyze()` gets a wallet-style confirmation popup that
simulates and risk-scores the transaction **before** the wallet is ever asked
to sign.

## Install (unpacked)

1. Open `chrome://extensions`
2. Turn on **Developer mode** (top-right)
3. Click **Load unpacked** and select this `extension/` folder
4. **Pin AEGIS to the toolbar** (puzzle-piece icon → pin). The confirmation is
   an anchored panel, so it appears under the icon — unpinned, it drops out of
   the overflow menu instead, which is easy to miss.
5. Reload any open dApp tab so the content script injects

Click the icon any time to check whether the agent server is reachable and to
change its address.

Requires Chrome 116+ (uses `world: "MAIN"` content scripts). Chrome 127+ gets
the anchored panel; older versions fall back to a standalone window
automatically.

### The panel closes when it loses focus

That's how Chrome's anchored panels work — clicking the page behind it, or
switching windows, dismisses it. AEGIS treats that as `cancelled` and the
page's promise resolves, so nothing hangs; the user just runs the analysis
again. The whole review → analyze → confirm flow happens inside the panel, so
no click outside it is ever required.

## Requirements

The extension calls the AEGIS **agent server** directly — it does not go
through the dApp. Start it first:

```bash
cd agent-server   # the LangGraph project (D:\Sui_Dev\agent-server)
pnpm dev          # listens on http://localhost:3001
```

If your agent runs elsewhere, click the AEGIS toolbar icon and change the
**Agent server** field (stored in `chrome.storage.local`). The extension needs
a matching entry in `host_permissions` in `manifest.json` for any host other
than `localhost:3001` / `127.0.0.1:3001`.

### Agent contract

`POST {agentUrl}/analyze-stream` with `{ rawPtb, walletAddress }`, responding
with SSE frames:

```
data: {"type":"tool_start","tool":"parse_ptb","label":"Decoding PTB"}
data: {"type":"tool_end","tool":"parse_ptb","summary":"4 commands"}
data: {"type":"thought","text":"…","source":"gemini"}
data: {"type":"result","data":{ …AgentAnalysis… }}
data: {"type":"error","message":"…"}
```

A plain-JSON response (`AgentAnalysis`) is also accepted, so a non-streaming
agent build still works.

## Integrating a dApp

```ts
import { aegis } from "@/lib/aegis-sdk";

const result = await aegis.analyze({
  transaction: await tx.toJSON(),
  sender: account.address,
  network: "testnet",
});

if (result.status === "not_installed") return showInstallPrompt();
if (result.status === "approved") await signAndExecuteTransaction({ transaction: tx });
```

`analyze()` never throws. Statuses: `approved`, `rejected`, `cancelled`
(popup closed), `not_installed`, `error`.

The raw provider is on `window.aegis` for non-React consumers, and fires an
`aegis#initialized` event on the window when it is injected.

## Architecture

```
page (MAIN world)          window.aegis          inpage.js
      │ postMessage
      ▼
content script (ISOLATED)  long-lived Port       content.js
      │ chrome.runtime
      ▼
service worker             routes + popup mgmt   background.js
      │ chrome.action.openPopup()   ← Chrome 127+
      │ chrome.windows.create       ← fallback
      ▼
confirmation panel         review → stream →     popup/
                           verdict → decide
                                  │
                                  ▼
                           agent server :3001
```

Three design points worth keeping:

- **The service worker never calls the agent.** The popup does, so the request
  dies with the surface and the verdict is rendered by whoever fetched it.
- **A long-lived `Port`, not `sendMessage`.** A confirmation can sit open for
  minutes; an MV3 service worker is killed after ~30s idle. A connected port
  keeps it alive and gives a clean disconnect signal for pending requests.
- **The popup holds its own port too.** An anchored panel fires no
  `windows.onRemoved`, so its port disconnecting is how the worker learns the
  panel closed and cancels an undecided request.

The panel is opened without a `requestId` in its URL, so `popup.js` asks the
worker for whatever is pending; the fallback window names its request in the
query string. Either way, closing without deciding resolves the page's promise
as `cancelled` — it never hangs.

## Files

| File | Role |
| --- | --- |
| `manifest.json` | MV3 manifest, permissions, content-script worlds |
| `inpage.js` | MAIN world — defines `window.aegis` |
| `content.js` | ISOLATED world — postMessage ⇄ Port bridge |
| `background.js` | Service worker — request routing, popup lifecycle |
| `lib/ptb.js` | Reads Sui transaction JSON v2 for the review screen |
| `popup/` | The confirmation UI (`mode.js` picks panel vs window sizing) |
| `icons/` | Generated PNGs |
