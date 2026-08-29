"use client";

import { useRef } from "react";
import { useReveal } from "@/lib/useReveal";
import BorderGlow from "@/components/BorderGlow";

const FEATURES = [
  {
    title: "Zero Custody, Zero God-Mode",
    body: "AEGIS never holds funds, private keys, or Admin Capabilities. There is nothing to steal, nothing to inject into, and no kill switch to abuse.",
    icon: "◈",
  },
  {
    title: "Deterministic Move Simulation",
    body: "Dry-runs compute the exact post-state of any PTB against live chain data. Verdicts are grounded in execution results — not guesses about intent.",
    icon: "≡",
  },
  {
    title: "Object-Lineage Threat Graph",
    body: "A purpose-built indexer that speaks Sui's object model natively: ownership flips, capability leaks, and dynamic-field traps mapped in real time.",
    icon: "◎",
  },
  {
    title: "Wallet-Native SDK",
    body: "One integration for wallet teams: intercept, simulate, render verdict. Plain-language warnings your grandmother could act on.",
    icon: "▣",
  },
  {
    title: "Hallucination-Proof by Design",
    body: "A false positive is a dismissible warning — not a frozen protocol. The failure mode of AEGIS is friction; the failure mode of intervening AI is catastrophe.",
    icon: "✕",
  },
  {
    title: "Compliance-Grade Audit Trail",
    body: "Every simulation is logged and attestable. Institutions get the risk reporting layer regulators are already asking for.",
    icon: "§",
  },
];

export default function Moat() {
  const root = useRef<HTMLElement>(null);
  useReveal(root);

  return (
    <section id="moat" ref={root} className="relative scroll-mt-24 py-24 sm:py-32">
      <div className="spot left-1/3 top-0 h-[420px] w-[420px] bg-aqua/8" />

      <div className="mx-auto max-w-7xl px-6">
        <div className="max-w-3xl">
          <p data-reveal className="kicker">
            <span data-scramble>04 — The Moat</span>
          </p>
          <h2
            data-title
            className="mt-6 font-display text-2xl font-semibold leading-snug tracking-tight sm:text-4xl lg:text-5xl"
          >
            Security that scales with the chain,{" "}
            <span className="text-gradient-blue">not against it.</span>
          </h2>
        </div>

        <BorderGlow className="mt-16" backgroundColor="#020710">
          <div className="grid gap-px overflow-hidden rounded-2xl bg-line sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <article
                key={f.title}
                data-reveal
                data-reveal-group="moat"
                className="group bg-ink p-8 transition-colors duration-500 hover:bg-panel/60"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-line font-display text-lg text-sui transition-all duration-500 group-hover:border-sui/60 group-hover:text-aqua group-hover:shadow-[0_0_20px_rgba(77,162,255,0.3)]">
                  {f.icon}
                </span>
                <h3 className="mt-6 font-grotesk text-xl font-semibold text-white">
                  {f.title}
                </h3>
                <p className="mt-3 text-[15px] leading-7 text-pretty text-mist">{f.body}</p>
              </article>
            ))}
          </div>
        </BorderGlow>
      </div>
    </section>
  );
}
