"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Shown when `aegis.analyze()` reports `not_installed`.
 *
 * Deliberately thin: the full setup walkthrough lives at /developer. Both links
 * open in a new tab so the user doesn't lose their wallet connection — coming
 * back and hitting Retry should just work.
 */
export default function InstallPrompt({
  theme = "dark",
  onRetry,
  onClose,
}: {
  theme?: "dark" | "light";
  onRetry: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const light = theme === "light";

  const s = {
    panel: light
      ? "border border-slate-200 bg-white text-slate-900 shadow-2xl"
      : "glass text-white shadow-2xl",
    kicker: light ? "text-blue-700" : "text-sui",
    title: light ? "text-slate-900" : "text-white",
    body: light ? "text-slate-600" : "text-mist",
    cta: light
      ? "border-blue-200 bg-blue-50 hover:border-blue-400 hover:bg-blue-100"
      : "border-sui/40 bg-sui/[0.08] hover:border-aqua hover:bg-sui/[0.16]",
    ctaTitle: light ? "text-slate-900" : "text-white",
    ctaSub: light ? "text-slate-500" : "text-mist",
    arrow: light ? "text-blue-700" : "text-aqua",
    primary: light
      ? "bg-blue-600 text-white hover:bg-blue-700"
      : "border border-aqua/60 text-white hover:shadow-[0_0_24px_rgba(111,247,255,0.3)]",
    ghost: light
      ? "border border-slate-300 text-slate-700 hover:bg-slate-100"
      : "border border-line text-mist hover:border-sui/60 hover:text-white",
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Install the AEGIS extension"
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-md rounded-2xl p-7 ${s.panel}`}
      >
        <p className={`font-mono text-[11px] uppercase tracking-[0.28em] ${s.kicker}`}>
          Extension required
        </p>
        <h2 className={`mt-3 font-display text-xl font-semibold ${s.title}`}>
          AEGIS isn&apos;t installed in this browser
        </h2>
        <p className={`mt-3 text-sm leading-relaxed ${s.body}`}>
          This dApp asks AEGIS to simulate and risk-score every transaction before
          your wallet opens. Setup takes about thirty seconds — install it once and
          the review popup appears automatically from then on.
        </p>

        <Link
          href="/developer#install"
          target="_blank"
          className={`group mt-6 flex items-center justify-between gap-4 rounded-xl border px-4 py-4 transition-all ${s.cta}`}
        >
          <span>
            <span className={`block font-grotesk text-[15px] font-semibold ${s.ctaTitle}`}>
              Open the developer guide
            </span>
            <span className={`mt-0.5 block text-xs leading-relaxed ${s.ctaSub}`}>
              Download, install, and integrate — step by step
            </span>
          </span>
          <span
            className={`shrink-0 font-mono text-xs uppercase tracking-[0.16em] transition-transform group-hover:translate-x-1 ${s.arrow}`}
          >
            →
          </span>
        </Link>

        <a
          href="/aegis-extension.zip"
          download
          className={`mt-3 block text-center font-mono text-[11px] uppercase tracking-[0.18em] underline decoration-dotted underline-offset-4 transition-colors ${s.ctaSub} ${
            light ? "hover:text-blue-700" : "hover:text-aqua"
          }`}
        >
          Or download the extension directly ↓
        </a>

        <div className="mt-7 flex gap-3">
          <button
            onClick={onClose}
            className={`flex-1 rounded-full px-5 py-3 font-mono text-xs uppercase tracking-[0.2em] transition-all ${s.ghost}`}
          >
            Not now
          </button>
          <button
            onClick={onRetry}
            className={`flex-1 rounded-full px-5 py-3 font-mono text-xs font-semibold uppercase tracking-[0.2em] transition-all ${s.primary}`}
          >
            Retry
          </button>
        </div>

        <p className={`mt-4 text-center text-[11px] leading-relaxed ${s.ctaSub}`}>
          Already installed? Reload this page first — content scripts only inject
          on a fresh load.
        </p>
      </div>
    </div>
  );
}
