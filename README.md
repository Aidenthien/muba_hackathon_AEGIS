# 🛡️ AEGIS — Pre-Execution Security Oracle for Sui

> Stop the exploit before the signature.

![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Sui](https://img.shields.io/badge/Sui-Move-4DA2FF?logo=sui&logoColor=white)
![Chrome Extension](https://img.shields.io/badge/Chrome-MV3_Extension-4285F4?logo=googlechrome&logoColor=white)
![Enoki zkLogin](https://img.shields.io/badge/Enoki-zkLogin_%2B_Sponsored_Gas-6fbcf0)
![Status](https://img.shields.io/badge/status-hackathon_build-orange)

This is the **frontend, Chrome extension, and dApp SDK** for [AEGIS](https://github.com/Aidenthien/muba_hackathon_AEGIS) — the pre-execution security oracle for Sui. The backend reasoning engine lives in the sibling [aegis-ai-agent](https://github.com/johnp2003/aegis-ai-agent) repo; this repo contains the web application, the interactive transaction lab, and the browser extension that intercepts transactions before signing.

---

## Table of Contents

- [📝 Description](#-description)
- [💡 Why We Built AEGIS](#-why-we-built-aegis)
- [✨ Features](#-features)
- [📜 Smart Contract Information](#-smart-contract-information)
- [⚙️ How It Works](#️-how-it-works)
- [🚀 Getting Started](#-getting-started)
- [🧱 Technology Stack](#-technology-stack)
- [👥 Team](#-team)

---

## 📝 Description

AEGIS is a **pre-execution security oracle** for the Sui blockchain. It sits between a dApp and a user's wallet as a browser extension: any dApp that calls `aegis.analyze(tx)` gets a wallet-style confirmation popup that simulates and risk-scores the transaction *before* the wallet is ever asked to sign it.

Under the hood, an agent pipeline decodes the raw PTB, dry-runs it against live chain state for a deterministic post-state, resolves every Move call against a registry of known Sui protocols, and reasons over the resulting object delta to produce a risk score, explanation, and verdict — all before the user's signature is requested.

## 💡 Why We Built AEGIS

Signing Web3 transactions blindly leads to lost funds. On Sui, this is driven by three key problems:

1. **Hidden Scams in Complex Transactions** — Multi-step transactions make it easy for attackers to hide malicious drainers inside innocent-looking interactions.
2. **User Signs Blindly** — Wallets display raw hex code and technical data instead of showing what will actually happen to your assets.
3. **Zero Room for Error** — Sui finalizes in ~400ms with no mempool waiting room. Once signed, funds are gone instantly with no way to undo or revoke.

**AEGIS simulates transactions before you sign**, catching hidden scams and giving you a clear, plain-English verdict so you never have to sign blindly.

## ✨ Features

- **Zero Custody, Zero God-Mode** — AEGIS never holds funds, private keys, or Admin Capabilities. There is nothing to steal, nothing to inject into, and no kill switch to abuse.
- **Deterministic Move Simulation** — Dry-runs compute the exact post-state of any PTB against live chain data. Verdicts are grounded in execution results, not guesses about intent.
- **Known-Protocol Registry** — Every Move call is resolved against a registry of Sui protocols carrying audit status and risk rating. A call into an unverified package is named as one, not silently trusted.
- 🔑 **zkLogin & Sponsored Transactions (Enoki)** — Seamless Web2 social login via zkLogin paired with Enoki sponsored gas pools so users can onboard and transact completely gasless without holding SUI.
- 🤝 **Dual-Model Cross-Verification (Gonka Router)** — Dispatches parallel inference across two distinct decentralized models (`DeepSeek-V4-Flash` and `MiniMax-M2.7`) with neutral prompts and strict evidence citations.
- 🛡️ **Defense-in-Depth Consensus Engine** — Automatically resolves model divergence by choosing the strictest conservative verdict and dynamically scoring Truth Confidence (0–100%).
- 🧮 **Transparent, Auditable Risk Scoring** — A fixed, additive point system (see [The Risk Engine](#-the-risk-engine)) anyone can read top to bottom, with human-readable flags attached to every point.
- 📜 **Permanent Audit Proofs (Walrus Storage + MongoDB)** — Stores cryptographic audit records, request proof IDs (`x-request-id`, `x-devshard-id`), and consensus verdicts on decentralized blob storage.
- **One-Call dApp SDK** — Import one object, call one method, branch on the result. `aegis.analyze()` never throws; every outcome, including "not installed," comes back as a status you can handle.
- **Real Chrome MV3 Extension** — Ships as an installable, anchored-panel extension (Chrome 127+, with an automatic standalone-window fallback on older Chrome 116+), not just a demo widget.
- **Streaming Agent Reasoning** — The agent server streams `tool_start` / `tool_end` / `thought` / `result` frames over SSE, so the popup can show its analysis working in real time.
- **Interactive Transaction Lab** — A live demo (`/demo`) with prebuilt scenarios (safe transfer, an audited-protocol swap, a multi-protocol DeFi chain, and a simulated wallet-drain) to see approve / caution / reject verdicts against real Move contracts.

## 📜 Smart Contract Information

The live demo scenarios (swaps, staking, lending, capability creation/deletion) interact with the **`aegis_defi_demo`** Move package deployed on Sui Testnet:

- **Network:** Sui Testnet
- **Package ID:** [`0x603912ab3714c5333b58f30523e379a87b95e975fae5e9a9c7565ed9c1b073d8`](https://suiscan.xyz/testnet/object/0x603912ab3714c5333b58f30523e379a87b95e975fae5e9a9c7565ed9c1b073d8)
- **Explorer:** [View on Suiscan](https://suiscan.xyz/testnet/object/0x603912ab3714c5333b58f30523e379a87b95e975fae5e9a9c7565ed9c1b073d8)
- **Purpose:** Deploys mock DeFi modules (`router`, `pool`, `lending`, `farm`, `rewards`, `vault`) on Sui Testnet. This provides a live, executable environment for the AEGIS interactive demo lab (`/demo`) to simulate and risk-score real on-chain Programmable Transaction Blocks (PTBs) across audited, unaudited, and multi-protocol scenarios.

## ⚙️ How It Works

![AEGIS Architecture and Concept](https://res.cloudinary.com/dzumvmtzs/image/upload/v1788535965/AEGIS_Pitching_Slides_cimmeo.png)

### System Architecture (Extension Side)

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

Design points that keep the flow safe and non-hanging:

- **The service worker never calls the agent.** The popup does, so the request dies with the surface and the verdict is rendered by whoever fetched it.
- **A long-lived `Port`, not `sendMessage`.** A confirmation can sit open for minutes; an MV3 service worker is killed after ~30s idle. A connected port keeps it alive and gives a clean disconnect signal for pending requests.
- **The popup holds its own port too.** An anchored panel fires no `windows.onRemoved`, so its port disconnecting is how the worker learns the panel closed and cancels an undecided request.
- **Closing without deciding never hangs the dApp.** The panel resolves the page's promise as `cancelled` — the dApp always gets an answer.

**dApp Integration:**

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

`analyze()` never throws. Possible statuses: `approved`, `rejected`, `cancelled` (popup closed), `not_installed`, `error`.

## 🚀 Getting Started

### Prerequisites

- Node.js and a package manager (npm, pnpm, yarn, or bun)
- Chrome 116+ (127+ for the anchored confirmation panel; older versions fall back to a standalone window automatically)
- An AEGIS agent server reachable at `http://localhost:3001` (or a custom URL configured in the extension popup)

### 1. Install dependencies and run the web app

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The interactive transaction lab is at `/demo`.

### 2. Configure environment variables

Copy `.env.example` to `.env.local` and fill in your [Enoki](https://enoki.mystenlabs.com) credentials for zkLogin and sponsored gas:

```bash
NEXT_PUBLIC_ENOKI_API_KEY=
NEXT_PUBLIC_ENOKI_GOOGLE_CLIENT_ID=
ENOKI_PRIVATE_KEY=
AGENT_SERVER_URL=
```

### 3. Load the browser extension

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select the `extension/` folder
4. Pin AEGIS to the toolbar (the confirmation panel anchors under the icon)
5. Reload any open dApp tab so the content script injects

### 4. Start the agent server

The extension calls the AEGIS agent server directly. Clone and start the [aegis-ai-agent](https://github.com/johnp2003/aegis-ai-agent) backend:

```bash
git clone https://github.com/johnp2003/aegis-ai-agent
cd aegis-ai-agent
pnpm install
pnpm dev          # listens on http://localhost:3001
```

If the agent runs elsewhere, change the **Agent server** field from the AEGIS toolbar icon popup (stored in `chrome.storage.local`), and add a matching entry to `host_permissions` in `extension/manifest.json`.

### Other useful scripts

```bash
npm run lint             # eslint
npm run test:scenarios   # scripts/test-demo-scenarios.ts — runs the demo scenarios end-to-end
npm run pack:extension   # scripts/pack-extension.mjs — zips the extension for distribution
```

## 🧱 Technology Stack

- **Web App & UI:** Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS 4, Three.js, GSAP
- **Browser Extension:** Chrome Manifest V3 (Anchored Panel & Long-Lived Port Messaging)
- **Blockchain & SDK:** Sui (`@mysten/sui` PTB builder & client, `@mysten/dapp-kit-react`)
- **Auth & Gas:** Enoki (zkLogin & Sponsored Gas Pool), Slush
- **Smart Contracts:** Sui Move (`edition = "2024.beta"`, deployed on Sui Testnet)
- **Agent & Consensus:** [AEGIS AI Agent](https://github.com/johnp2003/aegis-ai-agent) (LangGraph & Gonka Router Dual-Model Consensus)
- **Audit & Storage:** Walrus Storage, MongoDB

---

## 👥 Team

- **John Paulose** – Full Stack Developer
- **Thien Wei Jian** – Full Stack Developer

---

<p align="center">
  <strong>🛡️ Stop the exploit before the signature.</strong>
</p>

