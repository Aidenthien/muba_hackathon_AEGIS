"use client";

import { useRef } from "react";
import { useReveal } from "@/lib/useReveal";
import BorderGlow from "@/components/BorderGlow";
import { IconClock, IconDatabase, IconKey } from "@/components/Icons";

const FAILURES = [
  {
    id: "F-01",
    title: "The Mempool Myth",
    body: "Sui has no waiting room. Owned-object transactions bypass consensus and finalize in ~400ms; even shared-object DeFi flows settle sub-second. An off-chain AI watching “the mempool” is racing a chain that already finished. The hack is over before the HTTP request routes.",
    tag: "ARCHITECTURE",
    Icon: IconClock,
  },
  {
    id: "F-02",
    title: "The God-Mode Key",
    body: "An AI that can pause contracts or move funds needs a privileged Admin Capability — a centralized kill switch wearing a security badge. One prompt-injection payload hidden in on-chain metadata, or one hallucinated “attack” on a high-volume day, and your guard becomes the exploit.",
    tag: "TRUST MODEL",
    Icon: IconKey,
  },
  {
    id: "F-03",
    title: "The Indexing Wall",
    body: "Every Sui asset is a distinct cryptographic object with its own lineage — not a row in a balances table. Real-time indexing of millions of dynamic objects into an LLM context window means runaway cloud spend and latency that kills the product before the market does.",
    tag: "INFRASTRUCTURE",
    Icon: IconDatabase,
  },
];

export default function Premortem() {
  const root = useRef<HTMLElement>(null);
  useReveal(root);

  return (
    <section id="premortem" ref={root} className="relative scroll-mt-24 py-24 sm:py-32">
      <div className="spot -left-40 top-20 h-[420px] w-[420px] bg-danger/10" />

      <div className="mx-auto max-w-7xl px-6">
        <div className="max-w-3xl">
          <p data-reveal className="kicker kicker-danger flex items-center gap-3">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping-soft absolute inline-flex h-full w-full rounded-full bg-danger" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-danger" />
            </span>
            <span data-scramble>01 — The Pre-Mortem</span>
          </p>
          <h2
            data-title
            className="mt-6 font-display text-2xl font-semibold leading-snug tracking-tight sm:text-4xl lg:text-5xl"
          >
            We killed the obvious version{" "}
            <span className="text-danger">before writing a line of code.</span>
          </h2>
          <p
            data-reveal
            className="mt-6 max-w-[62ch] text-base leading-relaxed text-pretty text-mist sm:text-lg sm:leading-8"
          >
            The pitch-deck version — an AI that watches the chain and
            autonomously pauses contracts — dies six months after launch.
            Here is the autopsy of why intervening AI cannot work on Sui,
            and why that failure is exactly our edge.
          </p>
        </div>

        <div className="mt-16 grid gap-6 lg:grid-cols-3">
          {FAILURES.map((f) => (
            <article
              key={f.id}
              data-reveal
              data-reveal-group="failures"
              className="group relative transition-transform duration-500 hover:-translate-y-1.5"
            >
              <BorderGlow
                className="h-full"
                glowColor="353 100% 68%"
                colors={["#ff5c6e", "#ff98a6", "#ffc861"]}
                backgroundColor="rgba(6, 20, 38, 0.75)"
              >
                <div className="p-8">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs tracking-[0.2em] text-danger">
                      {f.id} / FATAL
                    </span>
                    <span className="rounded-full border border-line px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-mist">
                      {f.tag}
                    </span>
                  </div>

                  <span className="mt-8 flex h-11 w-11 items-center justify-center rounded-xl border border-danger/30 bg-danger/10 text-danger transition-colors duration-500 group-hover:border-danger/60">
                    <f.Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-5 font-grotesk text-2xl font-semibold text-white">
                    {f.title}
                  </h3>
                  <p className="mt-4 text-[15px] leading-7 text-pretty text-mist">{f.body}</p>
                </div>

                <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-danger/60 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
              </BorderGlow>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
