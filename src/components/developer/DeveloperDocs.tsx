"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import gsap from "gsap";
import AegisMark from "@/components/AegisMark";
import CodeBlock from "./CodeBlock";
import {
  IconArrowRight,
  IconChevron,
  IconDownload,
  IconMoon,
  IconShield,
  IconSun,
  SECTION_ICONS,
} from "./DocIcons";
import { useDocsMotion } from "./useDocsMotion";

const SECTIONS = [
  { id: "getting-started", label: "Getting started" },
  { id: "install", label: "Install the extension" },
  { id: "quick-start", label: "Quick start" },
  { id: "statuses", label: "Handling every status" },
  { id: "api", label: "API reference" },
  { id: "detect", label: "Detecting the extension" },
  { id: "agent-server", label: "Agent server" },
  { id: "troubleshooting", label: "Troubleshooting" },
];

/** Stable identity: passing a fresh array would re-run the motion effect. */
const SECTION_IDS = SECTIONS.map((s) => s.id);

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

/* ── Theme preference ──────────────────────────────────────────────
   localStorage is an external store, so it's read through
   useSyncExternalStore rather than an effect: no setState-in-effect
   cascade, correct SSR snapshot, and it syncs across tabs for free. */

const THEME_KEY = "aegis-docs-theme";
type DocTheme = "dark" | "light";

const themeListeners = new Set<() => void>();

function subscribeTheme(onChange: () => void) {
  themeListeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    themeListeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readTheme(): DocTheme {
  try {
    return localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark"; // private mode or blocked storage
  }
}

/** The server has no preference to read, so it always renders the dark skin. */
function readThemeOnServer(): DocTheme {
  return "dark";
}

function writeTheme(next: DocTheme) {
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {
    // Storage blocked — the toggle below still works for this session.
  }
  for (const listener of themeListeners) listener();
}

/**
 * Section kicker with its glyph. Reading the icon off SECTION_ICONS by id keeps
 * the heading and the sidebar entry from ever drifting apart.
 */
function SectionLabel({ id, children }: { id: string; children: React.ReactNode }) {
  const Icon = SECTION_ICONS[id];
  return (
    <p className="kicker flex items-center gap-2.5">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-sui/30 bg-sui/10 text-sui">
        <Icon className="h-4 w-4" />
      </span>
      {children}
    </p>
  );
}

/**
 * Accordion row. Animating grid-template-rows between 0fr and 1fr is the one
 * height transition that works without measuring the content, so answers of any
 * length open at the same speed.
 */
function Faq({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className={`glass overflow-hidden rounded-xl transition-colors duration-300 ${
        open ? "border-sui/40" : "hover:border-sui/25"
      }`}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-5 py-4 text-left"
      >
        <IconChevron
          className={`h-4 w-4 shrink-0 text-sui transition-transform duration-300 ${
            open ? "rotate-180" : ""
          }`}
        />
        <span className="font-grotesk text-[15px] font-medium text-white">{q}</span>
      </button>
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <p className="mx-5 border-t border-line pb-4 pt-3 text-[13.5px] leading-relaxed text-mist">
            {a}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function DeveloperDocs() {
  const [active, setActive] = useState(SECTIONS[0].id);
  const progressRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const theme = useSyncExternalStore(subscribeTheme, readTheme, readThemeOnServer);

  function toggleTheme() {
    writeTheme(theme === "dark" ? "light" : "dark");
  }

  useDocsMotion({
    root: rootRef,
    progress: progressRef,
    sectionIds: SECTION_IDS,
    onActiveChange: setActive,
  });

  // One reusable tween for the sidebar highlight. quickTo re-targets the same
  // tween on every section change; building a context per change would revert
  // the previous position and make the pill jump back to 0 before each move.
  const pillTo = useRef<((value: number) => void) | null>(null);

  useEffect(() => {
    const pill = pillRef.current;
    if (!pill) return;
    pillTo.current = gsap.quickTo(pill, "y", { duration: 0.45, ease: "power3" });
    return () => {
      gsap.killTweensOf(pill);
      pillTo.current = null;
    };
  }, []);

  // Slide the highlight to the active entry. Transform only — the entries are
  // a uniform height, so height is set rather than animated.
  useEffect(() => {
    const nav = navRef.current;
    const pill = pillRef.current;
    if (!nav || !pill) return;
    const target = nav.querySelector<HTMLElement>(`[data-nav-id="${active}"]`);
    if (!target) return;
    // autoAlpha also flips visibility, so the pill can't be read by assistive
    // tech or catch a click before it has ever been positioned.
    gsap.set(pill, { height: target.offsetHeight, autoAlpha: 1 });
    pillTo.current?.(target.offsetTop);
  }, [active]);

  function jump(e: React.MouseEvent<HTMLAnchorElement>, id: string) {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    history.replaceState(null, "", `#${id}`);
  }

  return (
    <div ref={rootRef} data-doc-theme={theme} className="relative min-h-screen bg-ink">
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
          <nav className="flex items-center gap-4">
            <button
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
              title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-mist transition-all duration-300 hover:border-sui/60 hover:text-aqua"
            >
              {theme === "dark" ? (
                <IconSun className="h-4 w-4" />
              ) : (
                <IconMoon className="h-4 w-4" />
              )}
            </button>
            <Link
              href="/demo-light"
              className="font-mono text-xs uppercase tracking-[0.18em] text-mist transition-colors hover:text-aqua"
            >
              Live demo
            </Link>
            <a
              href="/aegis-extension.zip"
              download
              data-doc-magnetic
              className="group flex items-center gap-2 rounded-full border border-sui/50 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-white transition-colors hover:border-aqua hover:shadow-[0_0_20px_rgba(77,162,255,0.3)]"
            >
              <IconDownload className="h-3.5 w-3.5 text-aqua transition-transform duration-300 group-hover:translate-y-0.5" />
              Download
            </a>
          </nav>
        </div>

        {/* Mobile section rail — the sidebar is desktop-only, so without this
            there is no way to move between sections on a phone. */}
        <div className="overflow-x-auto border-t border-line/60 lg:hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex w-max gap-2 px-6 py-2.5">
            {SECTIONS.map((sec) => {
              const Icon = SECTION_ICONS[sec.id];
              return (
                <a
                  key={sec.id}
                  href={`#${sec.id}`}
                  onClick={(e) => jump(e, sec.id)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors ${
                    active === sec.id
                      ? "border-sui/60 bg-sui/10 text-aqua"
                      : "border-line text-mist"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {sec.label}
                </a>
              );
            })}
          </div>
        </div>

        {/* Reading progress */}
        <div
          ref={progressRef}
          className="h-px origin-left scale-x-0 bg-gradient-to-r from-sui to-aqua shadow-[0_0_10px_rgba(77,162,255,0.7)]"
        />
      </header>

      <div className="mx-auto flex max-w-7xl gap-12 px-6 py-14">
        {/* ── Sidebar ── */}
        <aside className="hidden w-56 shrink-0 lg:block">
          <nav ref={navRef} className="sticky top-28">
            <p className="kicker mb-4">On this page</p>
            {/* flex + gap rather than space-y: space-y margins every child after
                the first, which would hand the first link a 4px offset it
                didn't have. Absolutely positioned children aren't flex items,
                so the pill costs the layout nothing. */}
            <div className="relative flex flex-col gap-1">
              {/* Must live inside this positioned wrapper, not the <nav>: the
                  pill is placed with the links' offsetTop, so it has to share
                  their offsetParent or it lands short by the kicker's height. */}
              <span
                ref={pillRef}
                aria-hidden="true"
                className="pointer-events-none invisible absolute left-0 top-0 w-full rounded-r-md bg-sui/[0.09] opacity-0"
              />
            {SECTIONS.map((sec) => {
              const Icon = SECTION_ICONS[sec.id];
              const isActive = active === sec.id;
              return (
                <a
                  key={sec.id}
                  href={`#${sec.id}`}
                  onClick={(e) => jump(e, sec.id)}
                  data-nav-id={sec.id}
                  className={`group relative flex items-center gap-2.5 border-l-2 py-2 pl-3 text-[13px] transition-all duration-300 ${
                    isActive
                      ? "border-sui text-aqua"
                      : "border-line text-mist hover:border-sui/50 hover:pl-4 hover:text-white"
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 shrink-0 transition-colors ${
                      isActive ? "text-aqua" : "text-mist/60 group-hover:text-sui"
                    }`}
                  />
                  {sec.label}
                </a>
              );
            })}
            </div>
          </nav>
        </aside>

        {/* ── Content ── */}
        <main className="min-w-0 flex-1 space-y-20">
          {/* Getting started */}
          <section id="getting-started" className="scroll-mt-28">
            <SectionLabel id="getting-started">Getting started</SectionLabel>
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
                {
                  n: "01",
                  t: "Install",
                  d: "Load the extension once, in Chrome 116+.",
                  i: SECTION_ICONS.install,
                },
                {
                  n: "02",
                  t: "Integrate",
                  d: "One import, one await, one status check.",
                  i: SECTION_ICONS["quick-start"],
                },
                { n: "03", t: "Ship", d: "Every transaction reviewed before signature.", i: IconShield },
              ].map((s) => (
                <div
                  key={s.n}
                  data-doc-card
                  className="glass group rounded-xl p-5 transition-colors duration-500 hover:border-sui/40"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-sui/25 bg-sui/10 text-sui transition-colors duration-500 group-hover:border-sui/60 group-hover:text-aqua">
                    <s.i className="h-4.5 w-4.5" />
                  </span>
                  <span className="mt-3 block font-mono text-[11px] tracking-[0.2em] text-sui">
                    {s.n}
                  </span>
                  <h3 className="mt-1 font-grotesk text-lg font-semibold text-white">{s.t}</h3>
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
            <SectionLabel id="install">Installation</SectionLabel>
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
              data-doc-magnetic
              className="group mt-7 flex items-center justify-between gap-4 rounded-xl border border-sui/50 bg-sui/[0.08] px-6 py-5 transition-colors hover:border-aqua hover:bg-sui/[0.14] hover:shadow-[0_0_30px_rgba(77,162,255,0.25)]"
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
                <li key={step.title} data-doc-card className="flex gap-4">
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
            <SectionLabel id="quick-start">Quick start</SectionLabel>
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
            <SectionLabel id="statuses">Result handling</SectionLabel>
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
            <SectionLabel id="api">API reference</SectionLabel>
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
            <SectionLabel id="detect">Detection</SectionLabel>
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

          {/* Agent server */}
          <section id="agent-server" className="scroll-mt-28">
            <SectionLabel id="agent-server">Backend</SectionLabel>
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
            <SectionLabel id="troubleshooting">Troubleshooting</SectionLabel>
            <h2 className="mt-3 font-display text-2xl font-semibold sm:text-3xl">
              Common problems
            </h2>
            <div className="mt-6 space-y-3">
              {TROUBLESHOOTING.map((item) => (
                <Faq key={item.q} q={item.q} a={item.a} />
              ))}
            </div>

            <div className="mt-12 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-abyss/40 px-6 py-5">
              <p className="text-[14px] text-mist">
                Installed it? Try the flow end to end.
              </p>
              <Link
                href="/demo-light"
                className="group/cta rounded-full border border-sui/50 px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-white transition-all hover:border-aqua hover:shadow-[0_0_20px_rgba(77,162,255,0.3)]"
              >
                <span className="flex items-center gap-2">
                  Open the live demo
                  <IconArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover/cta:translate-x-1" />
                </span>
              </Link>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
