"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AegisMark from "@/components/AegisMark";
import CodeBlock from "./CodeBlock";

const SECTIONS = [
  { id: "getting-started", label: "Getting started" },
  { id: "install", label: "Install the extension" },
  { id: "quick-start", label: "Quick start" },
  { id: "statuses", label: "Handling every status" },
  { id: "api", label: "API reference" },
  { id: "detect", label: "Detecting the extension" },
  { id: "how-it-works", label: "How it works" },
  { id: "agent-server", label: "Agent server" },
  { id: "troubleshooting", label: "Troubleshooting" },
];

const QUICK_START = `import { aegis } from "@/lib/aegis-sdk";

const result = await aegis.analyze({
  transaction: await tx.toJSON(),
  sender: account.address,
  network: "testnet",
});

if (result.status === "approved") {
  await signAndExecuteTransaction({ transaction: tx });
}`;

const FULL_EXAMPLE = `"use client";

import { useState } from "react";
import { useCurrentAccount, useDAppKit } from "@mysten/dapp-kit-react";
import { Transaction } from "@mysten/sui/transactions";
import { aegis } from "@/lib/aegis-sdk";

export function SendButton() {
  const account = useCurrentAccount();
  const dAppKit = useDAppKit();
  const [needsExtension, setNeedsExtension] = useState(false);

  async function send() {
    if (!account) return;

    // 1. Build the transaction exactly as you would today.
    const tx = new Transaction();
    tx.setSender(account.address);
    const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(50_000_000n)]);
    tx.transferObjects([coin], tx.pure.address(RECIPIENT));

    const payload = await tx.toJSON();

    // 2. Hand it to AEGIS. The extension popup opens; this awaits the user.
    const result = await aegis.analyze({
      transaction: payload,
      sender: account.address,
      network: "testnet",
      label: "Send 0.05 SUI",
    });

    if (result.status === "not_installed") {
      setNeedsExtension(true);
      return;
    }
    if (result.status !== "approved") return; // rejected or cancelled

    // 3. Sign the exact payload AEGIS analyzed — never a rebuilt one.
    await dAppKit.signAndExecuteTransaction({
      transaction: Transaction.from(payload),
    });
  }

  return <button onClick={send}>Send</button>;
}`;

const STATUS_EXAMPLE = `const result = await aegis.analyze({ transaction, sender, network });

switch (result.status) {
  case "approved":
    await signAndExecuteTransaction({ transaction: tx });
    break;

  case "rejected":
    toast("AEGIS flagged this transaction and you rejected it.");
    break;

  case "cancelled":
    // Popup closed without deciding — usually a no-op.
    break;

  case "not_installed":
    showInstallPrompt();
    break;

  case "error":
    toast.error(result.error!.message);
    break;
}`;

const DETECT_EXAMPLE = `import { useEffect, useState } from "react";
import { aegis } from "@/lib/aegis-sdk";

function useAegis() {
  const [version, setVersion] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    aegis.detect().then((provider) => {
      if (cancelled) return;
      setVersion(provider?.version ?? null);
      setChecked(true);
    });
    return () => { cancelled = true; };
  }, []);

  return { installed: version !== null, version, checked };
}`;

const RAW_PROVIDER = `// Without the SDK — the raw injected provider.
if (window.aegis?.isAegis) {
  const { status, analysis } = await window.aegis.analyze({
    transaction: await tx.toJSON(),
    sender: address,
    network: "testnet",
  });
}

// Injected at document_start, and announced for late listeners:
window.addEventListener("aegis#initialized", (e) => {
  console.log("AEGIS ready", e.detail); // { name, rdns, version }
});`;

const SSE_CONTRACT = `POST http://localhost:3001/analyze-stream
Content-Type: application/json

{ "rawPtb": "<tx.toJSON() string>", "walletAddress": "0x…" }

--- response: text/event-stream ---
data: {"type":"tool_start","tool":"parse_ptb","label":"Decoding PTB"}
data: {"type":"tool_end","tool":"parse_ptb","summary":"4 commands, 2 packages"}
data: {"type":"thought","text":"Checking the target against …","source":"gemini"}
data: {"type":"result","data":{ … AgentAnalysis … }}
data: {"type":"error","message":"…"}`;

const ANALYSIS_SHAPE = `interface AgentAnalysis {
  explanation: string;
  riskScore: number;                          // 0–100
  riskFlags: string[];
  recommendation: "approve" | "caution" | "reject";
  operations: string[];
  protocols: {
    packageId: string;
    name: string;
    category: string;
    audited: boolean;
    risk: string;
  }[];
  simulation: {
    status: string;                           // "simulated" | "estimated" | …
    balanceChanges: { coinType: string; amount: string }[];
    objectChanges: string[];
    gasUsed: { computationCost: string; storageCost: string };
    events: string[];
  } | null;
  similarPatterns?: {
    description: string;
    category: string;
    riskLevel: string;
    similarity: number;                       // 0–1
  }[];
}`;

const ARCHITECTURE = `your dApp                      window.aegis            inpage.js  (MAIN world)
    │  aegis.analyze(tx)              │
    ▼                                 ▼
content script  ──── long-lived Port ────▶  service worker      background.js
                                                  │
                                                  │ chrome.action.openPopup()   ← Chrome 127+
                                                  │ chrome.windows.create       ← fallback
                                                  ▼
                                       confirmation panel        popup/
                                       review → stream → verdict
                                                  │
                                                  ▼
                                          agent server :3001`;

const INSTALL_STEPS = [
  {
    title: "Download the extension",
    body: "Grab the archive and unzip it anywhere you like. Keep the folder — Chrome loads it from disk, so deleting it uninstalls the extension.",
  },
  {
    title: "Open chrome://extensions",
    body: "Paste it into the address bar. Chrome blocks links to internal pages, so it can't be a button here.",
  },
  {
    title: "Turn on Developer mode",
    body: "Toggle in the top-right corner of the extensions page.",
  },
  {
    title: 'Click "Load unpacked"',
    body: "Select the unzipped aegis-extension/ folder — the one containing manifest.json.",
  },
  {
    title: "Pin AEGIS to your toolbar",
    body: "Click the puzzle-piece icon in Chrome's toolbar, then the pin next to AEGIS. The confirmation is an anchored panel, so it opens under this icon — unpinned, it drops out of the overflow menu instead and is easy to miss.",
  },
  {
    title: "Reload your dApp tab",
    body: "Content scripts only inject on fresh page loads. After the reload, window.aegis is available.",
  },
];

const TROUBLESHOOTING = [
  {
    q: "analyze() returns not_installed even though I installed it",
    a: "Reload the dApp tab. Content scripts inject at document_start, so a tab opened before the extension was loaded has no provider. Also confirm the page origin matches the manifest's content_scripts.matches (localhost, 127.0.0.1, and https by default).",
  },
  {
    q: "The popup says \"Agent unreachable\"",
    a: "The extension calls the agent server directly, not through your app. Start it on http://localhost:3001, or click the AEGIS toolbar icon and point it elsewhere. Any host other than localhost:3001 also needs an entry in host_permissions in manifest.json.",
  },
  {
    q: "REQUEST_PENDING error",
    a: "One confirmation at a time, like a wallet. The open popup is focused instead of stacking a second one — finish it and call analyze() again.",
  },
  {
    q: "The panel vanishes when I click the page",
    a: "That's how Chrome's anchored panels work — they dismiss on focus loss. AEGIS reports it as cancelled so nothing hangs, and the whole review → analyze → confirm flow lives inside the panel, so you never need to click outside it. On Chrome below 127 there is no panel API and AEGIS opens a standalone window instead, which stays put.",
  },
  {
    q: "I don't see the panel when I click Analyze",
    a: "Pin AEGIS to the toolbar. The panel anchors to the extension icon; unpinned, it opens inside the puzzle-piece overflow menu and is easy to miss entirely.",
  },
  {
    q: "The promise never resolves",
    a: "It always resolves. Dismissing the panel without deciding comes back as cancelled, and a reloaded extension rejects in-flight requests with DISCONNECTED.",
  },
  {
    q: "\"This extension may have been corrupted\"",
    a: "Chrome says this when the folder moved or files changed on disk. Re-run Load unpacked against the current folder.",
  },
];

export default function DeveloperDocs() {
  const [active, setActive] = useState(SECTIONS[0].id);

  // Highlight the section currently nearest the top of the viewport.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-88px 0px -70% 0px" }
    );
    for (const s of SECTIONS) {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  function jump(e: React.MouseEvent<HTMLAnchorElement>, id: string) {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    history.replaceState(null, "", `#${id}`);
  }

  return (
    <div className="relative min-h-screen">
      {/* Own clipping layer: the spots hang past both edges, and putting
          overflow-hidden on an ancestor would kill the sticky sidebar. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="spot left-[-10%] top-[-10%] h-[460px] w-[460px] bg-sui/12" />
        <div className="spot bottom-[-10%] right-[-8%] h-[380px] w-[380px] bg-aqua/8" />
      </div>

      {/* ── Header ── */}
      <header className="sticky top-0 z-40 border-b border-line bg-ink/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-3">
            <AegisMark className="h-8 w-8" />
            <span className="font-display text-base font-semibold tracking-[0.12em]">AEGIS</span>
            <span className="hidden rounded-full border border-sui/40 bg-sui/10 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-aqua sm:block">
              Developers
            </span>
          </Link>
          <nav className="flex items-center gap-5">
            <Link
              href="/demo-light"
              className="font-mono text-xs uppercase tracking-[0.18em] text-mist transition-colors hover:text-aqua"
            >
              Live demo
            </Link>
            <a
              href="/aegis-extension.zip"
              download
              className="rounded-full border border-sui/50 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-white transition-all hover:border-aqua hover:shadow-[0_0_20px_rgba(77,162,255,0.3)]"
            >
              Download
            </a>
          </nav>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-12 px-6 py-14">
        {/* ── Sidebar ── */}
        <aside className="hidden w-56 shrink-0 lg:block">
          <nav className="sticky top-28 space-y-1">
            <p className="kicker mb-4">On this page</p>
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                onClick={(e) => jump(e, s.id)}
                className={`block border-l-2 py-1.5 pl-3 text-[13px] transition-colors ${
                  active === s.id
                    ? "border-sui text-aqua"
                    : "border-line text-mist hover:border-sui/50 hover:text-white"
                }`}
              >
                {s.label}
              </a>
            ))}
          </nav>
        </aside>

        {/* ── Content ── */}
        <main className="min-w-0 flex-1 space-y-20">
          {/* Getting started */}
          <section id="getting-started" className="scroll-mt-28">
            <p className="kicker">Getting started</p>
            <h1 className="mt-4 font-display text-3xl font-semibold leading-tight sm:text-4xl">
              Ship <span className="text-gradient-blue">pre-execution security</span> in
              one function call.
            </h1>
            <p className="mt-5 max-w-[65ch] text-base leading-relaxed text-mist">
              AEGIS is a browser extension that simulates and risk-scores a Sui
              transaction before your user&apos;s wallet ever opens. Your dApp hands
              it a PTB and gets back a decision — the extension renders the review,
              the agent does the analysis, and you never build verdict UI or
              maintain risk rules.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {[
                { n: "01", t: "Install", d: "Load the extension once, in Chrome 116+." },
                { n: "02", t: "Integrate", d: "One import, one await, one status check." },
                { n: "03", t: "Ship", d: "Every transaction reviewed before signature." },
              ].map((s) => (
                <div key={s.n} className="glass rounded-xl p-5">
                  <span className="font-mono text-[11px] tracking-[0.2em] text-sui">{s.n}</span>
                  <h3 className="mt-2 font-grotesk text-lg font-semibold text-white">{s.t}</h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-mist">{s.d}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 rounded-xl border border-sui/30 bg-sui/[0.06] p-5">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-aqua">
                Prerequisites
              </p>
              <ul className="mt-3 space-y-1.5 text-[13.5px] leading-relaxed text-mist">
                <li>• Chrome 116+ (the extension uses MAIN-world content scripts)</li>
                <li>• A Sui dApp that builds Programmable Transaction Blocks</li>
                <li>
                  • An AEGIS agent server running on{" "}
                  <code className="rounded bg-ink/60 px-1.5 py-0.5 font-mono text-[12px] text-aqua">
                    http://localhost:3001
                  </code>
                </li>
              </ul>
            </div>
          </section>

          {/* Install */}
          <section id="install" className="scroll-mt-28">
            <p className="kicker">Installation</p>
            <h2 className="mt-3 font-display text-2xl font-semibold sm:text-3xl">
              Install the extension
            </h2>
            <p className="mt-4 max-w-[65ch] text-base leading-relaxed text-mist">
              AEGIS isn&apos;t on the Chrome Web Store yet, so it installs unpacked.
              That takes about thirty seconds and gives you a normal browser
              extension — toolbar icon, popup windows, the lot.
            </p>

            <a
              href="/aegis-extension.zip"
              download
              className="group mt-7 flex items-center justify-between gap-4 rounded-xl border border-sui/50 bg-sui/[0.08] px-6 py-5 transition-all hover:border-aqua hover:bg-sui/[0.14] hover:shadow-[0_0_30px_rgba(77,162,255,0.25)]"
            >
              <span className="flex items-center gap-4">
                <AegisMark className="h-10 w-10" />
                <span>
                  <span className="block font-grotesk text-base font-semibold text-white">
                    Download aegis-extension.zip
                  </span>
                  <span className="mt-0.5 block font-mono text-[11px] uppercase tracking-[0.16em] text-mist">
                    Chrome MV3 · unpacked · ~22 KB
                  </span>
                </span>
              </span>
              <span className="font-mono text-xs uppercase tracking-[0.18em] text-aqua transition-transform group-hover:translate-x-1">
                Download ↓
              </span>
            </a>

            <ol className="mt-8 space-y-4">
              {INSTALL_STEPS.map((step, i) => (
                <li key={step.title} className="flex gap-4">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-sui/40 bg-sui/10 font-mono text-[11px] font-semibold text-aqua">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="font-grotesk text-[15px] font-semibold text-white">
                      {step.title}
                    </p>
                    <p className="mt-1 text-[13.5px] leading-relaxed text-mist">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>

            <p className="mt-6 text-[13px] leading-relaxed text-mist/80">
              Click the AEGIS toolbar icon at any point to check whether the agent
              server is reachable, or to point the extension at a different one.
            </p>
          </section>

          {/* Quick start */}
          <section id="quick-start" className="scroll-mt-28">
            <p className="kicker">Quick start</p>
            <h2 className="mt-3 font-display text-2xl font-semibold sm:text-3xl">
              Add it to your dApp
            </h2>
            <p className="mt-4 max-w-[65ch] text-base leading-relaxed text-mist">
              The SDK is a single dependency-free TypeScript file. Copy{" "}
              <code className="rounded bg-ink/60 px-1.5 py-0.5 font-mono text-[12.5px] text-aqua">
                src/lib/aegis-sdk.ts
              </code>{" "}
              into your project — it talks to the injected provider and nothing else.
            </p>

            <div className="mt-6">
              <CodeBlock code={QUICK_START} filename="the entire integration" />
            </div>

            <p className="mt-8 max-w-[65ch] text-base leading-relaxed text-mist">
              In context, with{" "}
              <code className="rounded bg-ink/60 px-1.5 py-0.5 font-mono text-[12.5px] text-aqua">
                @mysten/dapp-kit-react
              </code>
              :
            </p>
            <div className="mt-4">
              <CodeBlock code={FULL_EXAMPLE} filename="SendButton.tsx" />
            </div>

            <div className="mt-6 rounded-xl border border-aqua/30 bg-aqua/[0.05] p-5">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-aqua">
                Sign what was analyzed
              </p>
              <p className="mt-2 text-[13.5px] leading-relaxed text-mist">
                Pass the same serialized payload to both{" "}
                <code className="font-mono text-[12.5px] text-aqua">analyze()</code> and{" "}
                <code className="font-mono text-[12.5px] text-aqua">Transaction.from()</code>.
                Rebuilding the transaction after approval means the user signs
                something AEGIS never saw — which defeats the point.
              </p>
            </div>
          </section>

          {/* Statuses */}
          <section id="statuses" className="scroll-mt-28">
            <p className="kicker">Result handling</p>
            <h2 className="mt-3 font-display text-2xl font-semibold sm:text-3xl">
              Handling every status
            </h2>
            <p className="mt-4 max-w-[65ch] text-base leading-relaxed text-mist">
              <code className="rounded bg-ink/60 px-1.5 py-0.5 font-mono text-[12.5px] text-aqua">
                analyze()
              </code>{" "}
              never throws. Every outcome — including a missing extension — comes
              back as a status, so there is no try/catch to forget.
            </p>

            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-left text-[13.5px]">
                <thead>
                  <tr className="border-b border-line">
                    <th className="py-3 pr-4 font-mono text-[10px] uppercase tracking-[0.18em] text-sui">
                      Status
                    </th>
                    <th className="py-3 pr-4 font-mono text-[10px] uppercase tracking-[0.18em] text-sui">
                      Meaning
                    </th>
                    <th className="py-3 font-mono text-[10px] uppercase tracking-[0.18em] text-sui">
                      What to do
                    </th>
                  </tr>
                </thead>
                <tbody className="text-mist">
                  {[
                    ["approved", "User confirmed in the popup.", "Proceed to signing."],
                    ["rejected", "User explicitly rejected.", "Stop. Optionally explain why."],
                    ["cancelled", "Popup closed without a decision.", "Treat as a no-op."],
                    ["not_installed", "No AEGIS provider in this browser.", "Show an install prompt."],
                    ["error", "Extension reached but failed.", "Surface result.error.message."],
                  ].map(([status, meaning, action]) => (
                    <tr key={status} className="border-b border-line/60">
                      <td className="py-3 pr-4 align-top">
                        <code className="font-mono text-[12.5px] text-aqua">{status}</code>
                      </td>
                      <td className="py-3 pr-4 align-top">{meaning}</td>
                      <td className="py-3 align-top">{action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6">
              <CodeBlock code={STATUS_EXAMPLE} filename="all five branches" />
            </div>
          </section>

          {/* API */}
          <section id="api" className="scroll-mt-28">
            <p className="kicker">API reference</p>
            <h2 className="mt-3 font-display text-2xl font-semibold sm:text-3xl">
              The SDK surface
            </h2>

            <div className="mt-6 space-y-6">
              <div className="glass rounded-xl p-5">
                <code className="font-mono text-sm font-semibold text-aqua">
                  aegis.analyze(params): Promise&lt;AegisResult&gt;
                </code>
                <p className="mt-3 text-[13.5px] leading-relaxed text-mist">
                  Opens the confirmation popup and resolves once the user decides.
                </p>
                <div className="mt-4 space-y-2 border-t border-line pt-4 text-[13px]">
                  {[
                    ["transaction", "string", "Required. The JSON from tx.toJSON()."],
                    ["sender", "string", "Required. The signing address; also the simulation sender."],
                    ["network", "string", 'Optional, defaults to "testnet".'],
                    ["label", "string", "Optional. Human label shown in the popup."],
                  ].map(([name, type, desc]) => (
                    <div key={name} className="flex flex-wrap gap-x-3 gap-y-1">
                      <code className="font-mono text-[12.5px] text-white">{name}</code>
                      <code className="font-mono text-[12px] text-sui">{type}</code>
                      <span className="w-full text-mist sm:w-auto sm:flex-1">{desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="glass rounded-xl p-5">
                <code className="font-mono text-sm font-semibold text-aqua">
                  aegis.detect(timeoutMs?): Promise&lt;AegisProvider | null&gt;
                </code>
                <p className="mt-3 text-[13.5px] leading-relaxed text-mist">
                  Resolves the injected provider, waiting up to{" "}
                  <code className="font-mono text-[12.5px] text-aqua">timeoutMs</code> (default
                  1000ms) for a cold extension start-up. Returns{" "}
                  <code className="font-mono text-[12.5px] text-aqua">null</code>{" "}
                  if AEGIS isn&apos;t installed.
                </p>
              </div>

              <div className="glass rounded-xl p-5">
                <code className="font-mono text-sm font-semibold text-aqua">
                  aegis.isInstalled(): boolean
                </code>
                <p className="mt-3 text-[13.5px] leading-relaxed text-mist">
                  Synchronous check with no waiting. Prefer{" "}
                  <code className="font-mono text-[12.5px] text-aqua">detect()</code> on first
                  render — this can report false before injection completes.
                </p>
              </div>

              <div className="glass rounded-xl p-5">
                <code className="font-mono text-sm font-semibold text-aqua">
                  aegis.version: string | null
                </code>
                <p className="mt-3 text-[13.5px] leading-relaxed text-mist">
                  The installed extension&apos;s version, or null.
                </p>
              </div>
            </div>

            <h3 className="mt-10 font-grotesk text-lg font-semibold text-white">
              AgentAnalysis
            </h3>
            <p className="mt-2 max-w-[65ch] text-[14px] leading-relaxed text-mist">
              Present on{" "}
              <code className="font-mono text-[12.5px] text-aqua">result.analysis</code> for
              approved and rejected outcomes, so you can log or display what the
              user was shown.
            </p>
            <div className="mt-4">
              <CodeBlock code={ANALYSIS_SHAPE} filename="AgentAnalysis" />
            </div>
          </section>

          {/* Detect */}
          <section id="detect" className="scroll-mt-28">
            <p className="kicker">Detection</p>
            <h2 className="mt-3 font-display text-2xl font-semibold sm:text-3xl">
              Detecting the extension
            </h2>
            <p className="mt-4 max-w-[65ch] text-base leading-relaxed text-mist">
              Show an install prompt before the user commits to a flow, rather
              than after. A small hook covers it:
            </p>
            <div className="mt-6">
              <CodeBlock code={DETECT_EXAMPLE} filename="useAegis.ts" />
            </div>

            <p className="mt-8 max-w-[65ch] text-base leading-relaxed text-mist">
              If you&apos;d rather not use the SDK, the provider is a plain object on{" "}
              <code className="rounded bg-ink/60 px-1.5 py-0.5 font-mono text-[12.5px] text-aqua">
                window.aegis
              </code>
              , injected at{" "}
              <code className="rounded bg-ink/60 px-1.5 py-0.5 font-mono text-[12.5px] text-aqua">
                document_start
              </code>
              :
            </p>
            <div className="mt-4">
              <CodeBlock code={RAW_PROVIDER} filename="raw provider" language="js" />
            </div>
          </section>

          {/* How it works */}
          <section id="how-it-works" className="scroll-mt-28">
            <p className="kicker">Architecture</p>
            <h2 className="mt-3 font-display text-2xl font-semibold sm:text-3xl">
              How it works
            </h2>
            <p className="mt-4 max-w-[65ch] text-base leading-relaxed text-mist">
              Your page never sees the verdict path. The popup fetches the agent
              itself, so a compromised dApp cannot fake, suppress, or rewrite the
              analysis the user reads.
            </p>

            <div className="mt-6 overflow-x-auto rounded-xl border border-line bg-[#040e1c] p-5">
              <pre className="font-mono text-[11.5px] leading-relaxed text-[#9fc4e8]">
                <code>{ARCHITECTURE}</code>
              </pre>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {[
                {
                  t: "Zero custody",
                  d: "AEGIS never holds keys. Approving returns a status to your dApp — your existing wallet still asks the user to sign.",
                },
                {
                  t: "Works on any dApp",
                  d: "The provider is injected on every matching origin, so the extension protects sites that never integrated it.",
                },
                {
                  t: "The popup owns the network call",
                  d: "The service worker only routes. The analysis dies with the panel if the user walks away.",
                },
                {
                  t: "No hanging promises",
                  d: "Clicking away dismisses the panel and resolves as cancelled; a reloaded extension rejects in-flight requests with DISCONNECTED.",
                },
              ].map((c) => (
                <div key={c.t} className="glass rounded-xl p-5">
                  <h3 className="font-grotesk text-base font-semibold text-white">{c.t}</h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-mist">{c.d}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Agent server */}
          <section id="agent-server" className="scroll-mt-28">
            <p className="kicker">Backend</p>
            <h2 className="mt-3 font-display text-2xl font-semibold sm:text-3xl">
              Agent server contract
            </h2>
            <p className="mt-4 max-w-[65ch] text-base leading-relaxed text-mist">
              The extension calls the agent directly. Point it anywhere from the
              toolbar popup — any host other than{" "}
              <code className="rounded bg-ink/60 px-1.5 py-0.5 font-mono text-[12.5px] text-aqua">
                localhost:3001
              </code>{" "}
              also needs an entry in{" "}
              <code className="rounded bg-ink/60 px-1.5 py-0.5 font-mono text-[12.5px] text-aqua">
                host_permissions
              </code>
              .
            </p>
            <div className="mt-6">
              <CodeBlock code={SSE_CONTRACT} filename="analyze-stream" language="http" />
            </div>
            <p className="mt-4 text-[13.5px] leading-relaxed text-mist">
              A plain JSON response of the same{" "}
              <code className="font-mono text-[12.5px] text-aqua">AgentAnalysis</code> shape
              also works, so a non-streaming agent needs no changes.
            </p>
          </section>

          {/* Troubleshooting */}
          <section id="troubleshooting" className="scroll-mt-28">
            <p className="kicker">Troubleshooting</p>
            <h2 className="mt-3 font-display text-2xl font-semibold sm:text-3xl">
              Common problems
            </h2>
            <div className="mt-6 space-y-3">
              {TROUBLESHOOTING.map((item) => (
                <details key={item.q} className="glass group rounded-xl px-5 py-4">
                  <summary className="cursor-pointer list-none font-grotesk text-[15px] font-medium text-white marker:content-none">
                    <span className="mr-2 text-sui">›</span>
                    {item.q}
                  </summary>
                  <p className="mt-3 border-t border-line pt-3 text-[13.5px] leading-relaxed text-mist">
                    {item.a}
                  </p>
                </details>
              ))}
            </div>

            <div className="mt-12 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-abyss/40 px-6 py-5">
              <p className="text-[14px] text-mist">
                Installed it? Try the flow end to end.
              </p>
              <Link
                href="/demo-light"
                className="rounded-full border border-sui/50 px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-white transition-all hover:border-aqua hover:shadow-[0_0_20px_rgba(77,162,255,0.3)]"
              >
                Open the live demo →
              </Link>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
