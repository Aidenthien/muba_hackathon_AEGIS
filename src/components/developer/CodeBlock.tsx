"use client";

import { useState } from "react";
import { IconCheck, IconCopy } from "./DocIcons";

/**
 * Docs code sample with a copy button. Deliberately unhighlighted — the site
 * has no syntax-highlighting dependency and the samples are short enough that
 * monospace + the brand palette reads fine.
 *
 * The copy button swaps glyph and label together on success; the 1.8s window is
 * long enough to register without leaving the button in a lying state.
 */
export default function CodeBlock({
  code,
  filename,
  language = "ts",
}: {
  code: string;
  filename?: string;
  language?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked (insecure origin or permissions) — the code is on screen.
    }
  }

  return (
    <div className="doc-code group/code relative overflow-hidden rounded-xl border border-line bg-[#040e1c] transition-colors duration-500 hover:border-sui/40">
      {/* Hairline that lights up on hover — the whole block is one hover target. */}
      <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sui/70 to-transparent opacity-0 transition-opacity duration-500 group-hover/code:opacity-100" />

      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <span className="flex items-center gap-2.5 font-mono text-[10px] uppercase tracking-[0.18em] text-mist">
          <span className="flex gap-1.5">
            <span className="h-2 w-2 rounded-full bg-danger/50" />
            <span className="h-2 w-2 rounded-full bg-[#ffc861]/50" />
            <span className="h-2 w-2 rounded-full bg-aqua/50" />
          </span>
          {filename ?? language}
        </span>
        <button
          onClick={copy}
          aria-label={copied ? "Copied to clipboard" : "Copy code"}
          className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em] transition-all duration-300 ${
            copied
              ? "border-aqua/60 bg-aqua/10 text-aqua"
              : "border-line text-mist hover:border-sui/60 hover:text-aqua"
          }`}
        >
          {copied ? (
            <IconCheck className="h-3.5 w-3.5" />
          ) : (
            <IconCopy className="h-3.5 w-3.5" />
          )}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <pre className="overflow-x-auto px-4 py-4 font-mono text-[12.5px] leading-relaxed text-[#cfe2f5]">
        <code>{code}</code>
      </pre>
    </div>
  );
}
