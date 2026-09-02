# 🛡️ AEGIS — Pre-Execution Security Oracle for Sui

> Stop the exploit before the signature.

![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Sui](https://img.shields.io/badge/Sui-Move-4DA2FF?logo=sui&logoColor=white)
![Chrome Extension](https://img.shields.io/badge/Chrome-MV3_Extension-4285F4?logo=googlechrome&logoColor=white)
![Enoki zkLogin](https://img.shields.io/badge/Enoki-zkLogin_%2B_Sponsored_Gas-6fbcf0)
![Status](https://img.shields.io/badge/status-hackathon_build-orange)
![License](https://img.shields.io/badge/license-TBD-lightgrey)

AEGIS simulates every Sui transaction *before* it is signed — dry-running the exact Programmable Transaction Block (PTB) against live chain state, scoring the risk, and handing the wallet a plain-language verdict (**approve / caution / reject**) inside a real Chrome MV3 extension. No custody, no admin keys, no privileged contract access — AEGIS never holds funds or capabilities, so there is nothing for an attacker to steal or hijack.

Built for **[MUBA Hackathon]** on Sui.

---

## Table of Contents

- [📝 Description](#-description)
- [❗ Problem Statement](#-problem-statement)
- [🎯 Project Objective](#-project-objective)
- [💡 Motivation and Challenges](#-motivation-and-challenges)
- [✨ Features](#-features)
- [📜 Smart Contract Information](#-smart-contract-information)
- [⚙️ How It Works](#️-how-it-works)
- [🚀 Getting Started](#-getting-started)
- [🧱 Technology Stack](#-technology-stack)
- [🧩 Overall Concept](#-overall-concept)

---

## 📝 Description

AEGIS is a **pre-execution security oracle** for the Sui blockchain. It sits between a dApp and a user's wallet as a browser extension: any dApp that calls `aegis.analyze(tx)` gets a wallet-style confirmation popup that simulates and risk-scores the transaction *before* the wallet is ever asked to sign it.

Under the hood, an agent pipeline decodes the raw PTB, dry-runs it against live chain state for a deterministic post-state, resolves every Move call against a registry of known Sui protocols, and reasons over the resulting object delta to produce a risk score, explanation, and verdict — all before the user's signature is requested.

## ❗ Problem Statement

Three structural gaps make "AI watching the mempool" and similar off-chain security models unworkable on Sui:

- **The Mempool Myth** — Sui has no waiting room. Owned-object transactions bypass consensus and finalize in ~400ms; even shared-object DeFi flows settle sub-second. An off-chain AI watching "the mempool" is racing a chain that already finished — the hack is over before the HTTP request routes.
- **The God-Mode Key** — An AI that can pause contracts or move funds needs a privileged Admin Capability: a centralized kill switch wearing a security badge. One prompt-injection payload hidden in on-chain metadata, or one hallucinated "attack" on a high-volume day, and the guard becomes the exploit.
- **The Indexing Wall** — Every Sui asset is a distinct cryptographic object with its own lineage, not a row in a balances table. Real-time indexing of millions of dynamic objects into an LLM context window means runaway cloud spend and latency that kills the product before the market does.

Existing wallet security tools either react after the fact (post-execution monitoring, block explorers, revoke-approval dashboards) or require handing an AI custody and privileged capabilities to intervene — both models fail against Sui's speed and object model.

## 🎯 Project Objective

Give users and dApps a way to see the true, simulated outcome of a transaction — in plain language — *before* a signature is ever produced, without requiring any party to give up custody of funds, keys, or contract privileges.

Concretely, AEGIS aims to:

1. Intercept a transaction while it is still unsigned, regardless of which dApp constructed it.
2. Compute its exact on-chain effect deterministically, not probabilistically.
3. Explain that effect and a risk verdict in language a non-technical user can act on in seconds.
4. Do all of this with zero custody and zero standing privilege over user funds or protocol contracts.
5. Remove "I don't have gas" as a reason to skip a security check, via sponsored transactions.

## 💡 Motivation and Challenges

**Motivation.** Wallet-drain attacks and malicious approvals remain one of the most common ways users lose funds in Web3, and the tooling that could stop them almost always trades one risk for another — either it's too slow to matter on a sub-second chain, or it demands the very custody/privilege that makes a compromise catastrophic instead of merely annoying. AEGIS is built to resolve that trade-off on Sui specifically, using properties (deterministic Move execution, object-centric state, zkLogin + sponsored gas) that most chains don't offer.

**Challenges tackled:**

- **Racing finality.** Designing the intercept so analysis happens entirely pre-signature, inside the extension/agent boundary, rather than trying to out-race Sui's ~400ms settlement after the fact.
- **Staying privilege-free.** Deliberately excluding any Admin Capability, custodial wallet, or on-chain intervention power from the design, even though it would make some attacks easier to stop directly — a false positive must degrade to friction (a dismissible warning), never to a frozen protocol or seized funds.
- **MV3 extension lifecycle.** Chrome kills an idle MV3 service worker after ~30s, but a confirmation can sit open for minutes. This required a long-lived `Port` (not `sendMessage`) and a popup that holds its own port so a closed panel is detected and resolved as `cancelled` rather than hanging the dApp's promise.
- **Object-model risk scoring without full indexing.** Grounding verdicts in a real dry-run + protocol registry lookup instead of attempting full real-time indexing of Sui's object graph, which the Indexing Wall makes economically unworkable.
- **Zero-gas onboarding.** Integrating zkLogin sign-in and Enoki-sponsored gas so a user with no wallet and no SUI can still transact and still see a verdict before signing — without letting a sponsored gas coin be spent or spoofed by the transaction being reviewed.

## ✨ Features

- **Zero Custody, Zero God-Mode** — AEGIS never holds funds, private keys, or Admin Capabilities. There is nothing to steal, nothing to inject into, and no kill switch to abuse.
- **Deterministic Move Simulation** — Dry-runs compute the exact post-state of any PTB against live chain data. Verdicts are grounded in execution results, not guesses about intent.
- **Known-Protocol Registry** — Every Move call is resolved against a registry of Sui protocols carrying audit status and risk rating. A call into an unverified package is named as one, not silently trusted.
- **One-Call dApp SDK** — Import one object, call one method, branch on the result. `aegis.analyze()` never throws; every outcome, including "not installed," comes back as a status you can handle.
- **Hallucination-Proof by Design** — A false positive is a dismissible warning, not a frozen protocol. The failure mode of AEGIS is friction; the failure mode of intervening AI is catastrophe.
- **Gasless by Design** — zkLogin sign-in plus Enoki-sponsored gas means a user with no wallet and no SUI can transact — and still sees the verdict before they sign.
- **Real Chrome MV3 Extension** — Ships as an installable, anchored-panel extension (Chrome 127+, with an automatic standalone-window fallback on older Chrome 116+), not just a demo widget.
- **Streaming Agent Reasoning** — The agent server streams `tool_start` / `tool_end` / `thought` / `result` frames over SSE, so the popup can show its analysis working in real time (with a plain-JSON fallback for non-streaming callers).
- **Interactive Transaction Lab** — A live demo (`/demo`) with prebuilt scenarios (safe transfer, an audited-protocol swap, a multi-protocol DeFi chain, and a simulated wallet-drain) to see approve / caution / reject verdicts against real Move contracts.

## 📜 Smart Contract Information

*(to be completed)*

## ⚙️ How It Works

AEGIS runs a four-stage pipeline entirely before a wallet signature is requested:

1. **Intercept** — One call from the dApp, `aegis.analyze(tx)`, hands the pending Programmable Transaction Block to the AEGIS extension. It is inspected while still unsigned, before the wallet is ever asked to open.
2. **Simulate** — Because Move is fully deterministic, AEGIS dry-runs the PTB against current chain state in a sandboxed executor. The exact post-state is computed, not predicted.
3. **Analyze** — The agent reads the resulting object delta, resolves every Move call against a registry of known Sui protocols, and compares the shape against attack patterns it has seen before. Out comes a risk score, the flags behind it, and the reasoning.
4. **Verdict** — AEGIS renders the outcome in plain language and returns one of three verdicts: **approve**, **caution**, or **reject**. On approve, the transaction can execute with gas sponsored, so the user never needed SUI to begin with.

**System architecture (extension side):**

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

**dApp integration:**

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

**Agent server contract:** the extension calls the AEGIS agent server directly (not through the dApp), `POST {agentUrl}/analyze-stream` with `{ rawPtb, walletAddress }`, and streams back SSE frames (`tool_start`, `tool_end`, `thought`, `result`, `error`). A plain-JSON response is also accepted for non-streaming agent builds.

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
```

### 3. Load the browser extension

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select the `extension/` folder
4. Pin AEGIS to the toolbar (the confirmation panel anchors under the icon)
5. Reload any open dApp tab so the content script injects

### 4. Start the agent server

The extension calls the AEGIS agent server directly:

```bash
cd agent-server   # the LangGraph analysis pipeline
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

**Frontend**
- [Next.js 16](https://nextjs.org) (App Router) + React 19 + TypeScript
- Tailwind CSS 4, `shadcn`
- GSAP (`SplitText`, `ScrambleTextPlugin`, `ScrollTrigger`) for motion/reveal animation
- `three.js` via `@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing` for the 3D hero/transaction-simulation scenes
- `lenis` for smooth scrolling

**Sui / Web3**
- `@mysten/sui` — transaction building (PTBs), client
- `@mysten/dapp-kit-react` — wallet connection
- `@mysten/enoki` — zkLogin authentication and sponsored (gasless) transaction execution
- `@tanstack/react-query` — async/data-fetching state

**Browser Extension**
- Chrome Manifest V3
- `world: "MAIN"` + `world: "ISOLATED"` content scripts bridged via `postMessage` ⇄ a long-lived `chrome.runtime.Port`
- Service-worker-managed anchored confirmation panel (`chrome.action.openPopup()`) with a standalone-window fallback (`chrome.windows.create`) for pre-127 Chrome

**Smart Contracts**
- Sui Move, `edition = "2024.beta"`, targeting the `sui-framework/testnet` toolchain
- Deployed to Sui Testnet (see [Smart Contract Information](#smart-contract-information))

**Agent / Analysis Server**
- A LangGraph-based pipeline (separate service) that decodes PTBs, dry-runs them against live chain state, resolves protocol identities, and streams risk analysis back over Server-Sent Events

**Tooling**
- ESLint 9, TypeScript 5
- `tsx` for scripted scenario tests

## 🧩 Overall Concept

*(to be completed)*

---

## 🗂️ Repository Layout

```
contracts/            Sui Move package (demo DeFi protocols used for risk-scoring scenarios)
extension/             Chrome MV3 extension — the security oracle popup
src/app/               Next.js routes (marketing site, /demo, /demo-light, /developer, API proxies)
src/components/        Marketing site sections, demo app, developer docs, 3D scenes
src/lib/                aegis-sdk.ts (dApp SDK), Enoki/sponsor helpers, dApp-kit config
scripts/                Scenario test runner, extension packer
```

## 📄 License

*(to be completed)*
