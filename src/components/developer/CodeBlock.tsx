"use client";

import { useState } from "react";

/**
 * Docs code sample with a copy button. Deliberately unhighlighted — the site
 * has no syntax-highlighting dependency and the samples are short enough that
 * monospace + the brand palette reads fine.
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
    <div className="overflow-hidden rounded-xl border border-line bg-[#040e1c]">
      <div className="flex items-center justify-between border-b border-line px-4 py-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-mist">
          {filename ?? language}
        </span>
        <button
          onClick={copy}
          className="rounded border border-line px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-mist transition-colors hover:border-sui/60 hover:text-aqua"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto px-4 py-4 font-mono text-[12.5px] leading-relaxed text-[#cfe2f5]">
        <code>{code}</code>
      </pre>
    </div>
  );
}
