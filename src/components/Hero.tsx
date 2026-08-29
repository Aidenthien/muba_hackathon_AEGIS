"use client";

import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import gsap from "gsap";
import { SplitText } from "gsap/SplitText";
import { ScrambleTextPlugin } from "gsap/ScrambleTextPlugin";
import { onLoaded } from "@/lib/loader";
import { SCRAMBLE_CHARS } from "@/lib/useReveal";
import BorderGlow from "@/components/BorderGlow";

gsap.registerPlugin(SplitText, ScrambleTextPlugin);

const HeroScene = dynamic(() => import("./three/HeroScene"), {
  ssr: false,
  loading: () => null,
});

const STATS = [
  { value: "~400ms", label: "Sui finality we respect" },
  { value: "<250ms", label: "AI verdict latency" },
  { value: "0", label: "Admin keys held" },
  { value: "100%", label: "Checked pre-signature" },
];

export default function Hero() {
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        defaults: { ease: "power3.out" },
        paused: true,
      });
      onLoaded(() => tl.play());

      const chars = SplitText.create("[data-hero-chars]", { type: "chars" });
      const kickerText =
        root.current?.querySelector("[data-hero-kicker-text]")?.textContent ?? "";

      tl.from("[data-hero-kicker]", { opacity: 0, duration: 0.5 })
        .to(
          "[data-hero-kicker-text]",
          {
            duration: 1.3,
            ease: "none",
            scrambleText: { text: kickerText, chars: SCRAMBLE_CHARS, speed: 0.5 },
          },
          "<"
        )
        // line 1: character cascade
        .from(
          chars.chars,
          {
            yPercent: 130,
            rotateX: -60,
            opacity: 0,
            duration: 0.9,
            stagger: 0.03,
            transformOrigin: "50% 100%",
          },
          "-=1.0"
        )
        // line 2: masked slide, keeps the gradient intact
        .from(
          "[data-hero-line2]",
          { yPercent: 115, duration: 1.1, ease: "power4.out" },
          "-=0.6"
        )
        .from("[data-hero-sub]", { y: 30, opacity: 0, duration: 1 }, "-=0.6")
        .from(
          "[data-hero-stat]",
          { y: 20, opacity: 0, duration: 0.7, stagger: 0.08 },
          "-=0.4"
        );

      // gentle parallax: scene sinks and content drifts as you scroll away
      gsap.to("[data-hero-canvas]", {
        yPercent: 18,
        opacity: 0.35,
        ease: "none",
        scrollTrigger: {
          trigger: root.current,
          start: "top top",
          end: "bottom top",
          scrub: true,
        },
      });
      gsap.to("[data-hero-content]", {
        yPercent: -12,
        opacity: 0,
        ease: "none",
        scrollTrigger: {
          trigger: root.current,
          start: "20% top",
          end: "bottom top",
          scrub: true,
        },
      });
    }, root);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={root} className="relative flex min-h-screen flex-col overflow-hidden">
      {/* 3D scene */}
      <div data-hero-canvas className="absolute inset-0">
        <HeroScene />
      </div>

      {/* atmosphere */}
      <div className="spot left-1/2 top-1/3 h-[540px] w-[540px] -translate-x-1/2 bg-sui/15" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,#020710_82%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-ink to-transparent" />

      {/* content */}
      <div
        data-hero-content
        className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-6 pb-10 pt-32 text-center sm:pt-36"
      >
        <p data-hero-kicker className="kicker mb-7 flex flex-wrap items-center justify-center gap-3">
          <span className="inline-block h-1.5 w-1.5 rotate-45 bg-aqua" />
          <span data-hero-kicker-text>AI Risk &amp; Compliance Oracle — Built on Sui</span>
          <span className="inline-block h-1.5 w-1.5 rotate-45 bg-aqua" />
        </p>

        <h1 className="font-display text-3xl font-semibold leading-[1.14] tracking-tight text-balance sm:text-5xl lg:text-6xl xl:text-7xl">
          <span data-hero-chars className="block perspective-[600px]">
            Stop the exploit
          </span>
          <span className="block overflow-hidden pb-[0.12em]">
            <span data-hero-line2 className="block">
              <span className="text-gradient-blue text-glow">before</span> the
              signature.
            </span>
          </span>
        </h1>

        <p
          data-hero-sub
          className="mx-auto mt-8 max-w-[58ch] text-base leading-relaxed text-pretty text-[#dbe7f4] [text-shadow:0_2px_18px_rgba(2,7,16,0.95),0_0_2px_rgba(2,7,16,0.9)] sm:text-lg sm:leading-8"
        >
          AEGIS is a pre-execution simulation oracle for Sui. Every transaction
          is dry-run against live chain state and verified by AI in
          milliseconds — inside the wallet, before your users ever sign.
          No custody. No admin keys. No postmortems.
        </p>

        {/* scroll cue — in flow, so it never collides with the stat bar */}
        <div className="pointer-events-none mt-14 hidden lg:block">
          <div className="mx-auto flex h-10 w-6 items-start justify-center rounded-full border border-line pt-2">
            <span className="animate-cue h-2 w-0.5 rounded bg-aqua" />
          </div>
        </div>
      </div>

      {/* stat bar */}
      <div className="relative z-10 w-full px-6 pb-10">
        <BorderGlow className="mx-auto w-full max-w-5xl" backgroundColor="rgba(2, 7, 16, 0.7)">
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-line md:grid-cols-4">
            {STATS.map((s) => (
              <div
                key={s.label}
                data-hero-stat
                className="bg-ink/70 px-6 py-5 text-center backdrop-blur-sm md:text-left"
              >
                <div className="font-display text-xl font-semibold text-white">
                  {s.value}
                </div>
                <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-mist">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </BorderGlow>
      </div>
    </section>
  );
}
