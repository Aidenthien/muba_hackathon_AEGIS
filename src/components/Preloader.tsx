"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { markLoaded } from "@/lib/loader";
import AegisMark from "@/components/AegisMark";

const BOOT_LINES = [
  "Booting simulation engine…",
  "Linking Sui RPC endpoints…",
  "Indexing object lineage graph…",
  "Loading WebGL sentinel…",
  "Calibrating threat model…",
  "Arming pre-execution oracle…",
];

export default function Preloader() {
  const root = useRef<HTMLDivElement>(null);
  const pct = useRef<HTMLSpanElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const line = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    window.scrollTo(0, 0);

    const state = { n: 0 };
    let lineIdx = 0;
    let finished = false;

    const lineTimer = setInterval(() => {
      lineIdx = (lineIdx + 1) % BOOT_LINES.length;
      if (line.current) line.current.textContent = BOOT_LINES[lineIdx];
    }, 420);

    const render = () => {
      if (pct.current)
        pct.current.textContent = String(Math.round(state.n)).padStart(3, "0");
      if (bar.current) bar.current.style.transform = `scaleX(${state.n / 100})`;
    };

    // exit: snap to 100, hold a beat, slide the curtain up, release the page
    const finish = () => {
      if (finished) return;
      finished = true;
      gsap.to(state, {
        n: 100,
        duration: 0.45,
        ease: "power2.out",
        onUpdate: render,
        onComplete: () => {
          clearInterval(lineTimer);
          const tl = gsap.timeline({ delay: 0.35 });
          tl.to(root.current, {
            yPercent: -100,
            duration: 1,
            ease: "power4.inOut",
          });
          tl.add(() => markLoaded(), 0.45);
          tl.set(root.current, { display: "none" });
        },
      });
    };

    // crawl to 90% over ~2s, then wait for the real window load signal
    const crawl = gsap.to(state, {
      n: 90,
      duration: 2,
      ease: "power1.inOut",
      onUpdate: render,
      onComplete: () => {
        if (document.readyState === "complete") finish();
        else window.addEventListener("load", finish, { once: true });
      },
    });

    return () => {
      crawl.kill();
      clearInterval(lineTimer);
      window.removeEventListener("load", finish);
    };
  }, []);

  return (
    <div
      ref={root}
      className="fixed inset-0 z-[100] flex flex-col justify-between overflow-hidden bg-ink"
    >
      <div className="spot left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 bg-sui/12" />

      {/* centered mark */}
      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        <AegisMark animated className="h-24 w-24" />
        <span className="font-display text-lg font-semibold tracking-[0.16em]">
          AEGIS
        </span>
      </div>

      {/* bottom strip: boot log left, giant % right */}
      <div className="relative flex items-end justify-between px-6 pb-6 sm:px-10">
        <p
          ref={line}
          className="mb-4 font-mono text-[10px] uppercase tracking-[0.24em] text-mist"
        >
          {BOOT_LINES[0]}
        </p>
        <div className="flex items-baseline gap-1 font-display font-semibold leading-none">
          <span ref={pct} className="text-gradient-blue text-6xl tabular-nums sm:text-7xl">
            000
          </span>
          <span className="text-2xl text-mist">%</span>
        </div>
      </div>

      {/* progress bar */}
      <div className="h-px w-full bg-line">
        <div
          ref={bar}
          className="h-px w-full origin-left scale-x-0 bg-gradient-to-r from-sui to-aqua shadow-[0_0_16px_rgba(77,162,255,0.8)]"
        />
      </div>
    </div>
  );
}
