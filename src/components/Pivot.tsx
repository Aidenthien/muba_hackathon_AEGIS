"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useReveal } from "@/lib/useReveal";

gsap.registerPlugin(ScrollTrigger);

const TxSimScene = dynamic(() => import("./three/TxSimScene"), {
  ssr: false,
  loading: () => null,
});

const PHASES = [
  { text: "01 · Transaction submitted — PTB intercepted", dot: "bg-sui" },
  { text: "02 · AEGIS dry-run against live chain state", dot: "bg-aqua" },
  { text: "03 · Hidden drain revealed — assets rerouted", dot: "bg-danger" },
  { text: "04 · Verdict: abort — the signature never happens", dot: "bg-aqua" },
];

export default function Pivot() {
  const root = useRef<HTMLElement>(null);
  const [phase, setPhase] = useState(0);
  useReveal(root);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // each word brightens as it crosses the center of the viewport
      gsap.utils.toArray<HTMLElement>("[data-word]").forEach((word) => {
        gsap.fromTo(
          word,
          { opacity: 0.14 },
          {
            opacity: 1,
            ease: "none",
            scrollTrigger: {
              trigger: word,
              start: "top 78%",
              end: "top 45%",
              scrub: true,
            },
          }
        );
      });

      // the simulation drifts up slightly as the section scrolls in
      gsap.fromTo(
        "[data-sim]",
        { y: 80, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 1.4,
          ease: "power3.out",
          scrollTrigger: { trigger: "[data-sim]", start: "top 85%" },
        }
      );
    }, root);
    return () => ctx.revert();
  }, []);

  const statement =
    "So we don't intervene. We don't race consensus, and we never hold a key. We move the battlefield to the only place the attacker can't win — the moment before the signature.";

  return (
    <section id="pivot" ref={root} className="relative scroll-mt-24 overflow-hidden py-24 sm:py-36">
      <div className="spot right-0 top-1/3 h-[480px] w-[480px] bg-sui/12" />

      <div className="mx-auto grid max-w-7xl items-center gap-14 px-6 lg:grid-cols-[1.15fr_1fr] lg:gap-20">
        <div className="max-w-2xl">
          <p data-reveal className="kicker">
            <span data-scramble>02 — The Pivot</span>
          </p>
          <p className="mt-8 font-grotesk text-2xl font-medium leading-snug tracking-tight text-balance sm:text-3xl sm:leading-snug xl:text-4xl xl:leading-snug">
            {statement.split(" ").map((w, i) => (
              <span key={i} data-word className="inline-block">
                {w}&nbsp;
              </span>
            ))}
          </p>
          <p
            data-reveal
            className="mt-8 max-w-[60ch] text-base leading-relaxed text-pretty text-mist sm:text-lg sm:leading-8"
          >
            Move is deterministic. That means any Programmable Transaction Block
            can be perfectly simulated against live chain state — and its exact
            outcome known — before a single byte is committed. AEGIS turns that
            property into a security layer the chain itself cannot offer.
          </p>
        </div>

        {/* live pre-execution simulation: sender → contract → hidden drain → abort */}
        <div data-sim className="relative mx-auto aspect-square w-full max-w-[520px]">
          <div className="spot left-1/2 top-1/2 h-[70%] w-[70%] -translate-x-1/2 -translate-y-1/2 bg-sui/15" />
          <TxSimScene onPhase={setPhase} />
          <div className="pointer-events-none absolute bottom-2 left-1/2 w-max max-w-full -translate-x-1/2 rounded-full border border-line bg-ink/85 px-4 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-[#dbe7f4] backdrop-blur-sm">
            <span
              className={`mr-2 inline-block h-1.5 w-1.5 rounded-full align-middle transition-colors duration-500 ${PHASES[phase].dot}`}
            />
            {PHASES[phase].text}
          </div>
        </div>
      </div>
    </section>
  );
}
