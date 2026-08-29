"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SCRAMBLE_CHARS, useReveal } from "@/lib/useReveal";
import { ScrambleTextPlugin } from "gsap/ScrambleTextPlugin";
import BorderGlow from "@/components/BorderGlow";

gsap.registerPlugin(ScrollTrigger, ScrambleTextPlugin);

/** One terminal line = segments; `hl: true` marks the token the section's copy is about. */
type TermSeg = { t: string; hl?: boolean };
type TermLine = TermSeg[];

const STEPS: {
  n: string;
  title: string;
  body: string;
  code: TermLine[] | null;
}[] = [
  {
    n: "01",
    title: "Intercept",
    body: "The AEGIS SDK sits inside the wallet. The instant a user clicks “Swap,” the pending Programmable Transaction Block is intercepted — before any signature exists.",
    code: [
      [{ t: "> " }, { t: "ptb.captured", hl: true }],
      [{ t: "  sender: 0x7af3…c21e" }],
      [{ t: "  commands: 4" }],
      [{ t: "  gas_budget: 0.05 SUI" }],
      [{ t: "  status: " }, { t: "UNSIGNED", hl: true }],
    ],
  },
  {
    n: "02",
    title: "Simulate",
    body: "Because Move is fully deterministic, we dry-run the PTB against current chain state in a sandboxed executor. The exact post-state is computed — not predicted.",
    code: [
      [{ t: "> " }, { t: "aegis.dry_run(ptb)", hl: true }],
      [{ t: "  objects_read: 17" }],
      [{ t: "  objects_mutated: 5" }],
      [{ t: "  objects_transferred: 3" }],
      [{ t: "  determinism: " }, { t: "EXACT", hl: true }],
    ],
  },
  {
    n: "03",
    title: "Analyze",
    body: "A Move-specialized AI walks the object delta graph: ownership flips, hidden drains, capability leaks, malicious dynamic fields. Milliseconds, not minutes.",
    code: [
      [{ t: "> " }, { t: "model.inspect(delta)", hl: true }],
      [{ t: "  pattern: " }, { t: "OWNERSHIP_FLIP", hl: true }],
      [{ t: "  target: Kiosk<0x94aa…>" }],
      [{ t: "  drain_vector: " }, { t: "DETECTED", hl: true }],
      [{ t: "  confidence: " }, { t: "0.997", hl: true }],
    ],
  },
  {
    n: "04",
    title: "Verdict",
    body: "The wallet renders the outcome in plain language before the user signs. No custody, no admin keys, no race against consensus — the attack simply never happens.",
    code: null,
  },
];

export default function Pipeline() {
  const root = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  useReveal(root);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const el = track.current!;
      const getDistance = () => el.scrollWidth - window.innerWidth;

      const tween = gsap.to(el, {
        x: () => -getDistance(),
        ease: "none",
        scrollTrigger: {
          trigger: root.current,
          start: "top top",
          end: () => `+=${getDistance()}`,
          scrub: 1,
          pin: true,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        },
      });

      // progress bar tied to the same scroll
      gsap.to("[data-pipeline-progress]", {
        scaleX: 1,
        ease: "none",
        scrollTrigger: {
          trigger: root.current,
          start: "top top",
          end: () => `+=${getDistance()}`,
          scrub: true,
        },
      });

      // panels drift in slightly as they enter
      gsap.utils.toArray<HTMLElement>("[data-panel]").forEach((panel) => {
        gsap.from(panel.querySelectorAll("[data-panel-item]"), {
          y: 60,
          opacity: 0,
          duration: 0.9,
          ease: "power3.out",
          stagger: 0.1,
          scrollTrigger: {
            trigger: panel,
            containerAnimation: tween,
            start: "left 70%",
          },
        });

        // terminal: lines decode in one by one, then the tokens this
        // section is explaining light up
        const lines = Array.from(
          panel.querySelectorAll<HTMLElement>("[data-term-line]")
        );
        if (!lines.length) return;

        const cursor = panel.querySelector<HTMLElement>("[data-term-cursor]");
        gsap.set(lines, { autoAlpha: 0 });
        if (cursor) gsap.set(cursor, { autoAlpha: 0 });

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: panel,
            containerAnimation: tween,
            start: "left 60%",
          },
        });

        if (cursor) tl.set(cursor, { autoAlpha: 1 });

        lines.forEach((line) => {
          tl.set(line, { autoAlpha: 1 });
          line
            .querySelectorAll<HTMLElement>("[data-term-seg]")
            .forEach((seg) => {
              const text = seg.textContent ?? "";
              tl.to(seg, {
                duration: Math.max(0.25, text.length * 0.035),
                ease: "none",
                scrambleText: {
                  text,
                  chars: SCRAMBLE_CHARS,
                  speed: 0.5,
                },
              });
            });
        });

        const hls = panel.querySelectorAll<HTMLElement>("[data-term-hl]");
        if (hls.length) {
          tl.fromTo(
            hls,
            {
              backgroundColor: "rgba(77,162,255,0)",
              textShadow: "0 0 0 rgba(111,247,255,0)",
            },
            {
              backgroundColor: "rgba(77,162,255,0.18)",
              textShadow: "0 0 14px rgba(111,247,255,0.6)",
              duration: 0.45,
              ease: "power2.out",
              stagger: 0.18,
            },
            "+=0.15"
          );
        }
      });
    }, root);

    return () => ctx.revert();
  }, []);

  return (
    <section id="pipeline" ref={root} className="relative overflow-hidden bg-abyss/30">
      {/* header overlay */}
      <div className="pointer-events-none absolute left-0 right-0 top-0 z-20 mx-auto max-w-7xl px-6 pt-10 sm:pt-14">
        <div className="flex items-end justify-between gap-6">
          <div>
            <p className="kicker">
              <span data-scramble>03 — The Pipeline</span>
            </p>
            <h2 className="mt-3 font-display text-xl font-semibold leading-snug tracking-tight sm:text-3xl lg:text-4xl" data-title>
              Milliseconds before the signature.
            </h2>
          </div>
          <p className="hidden shrink-0 pb-1 font-mono text-[10px] uppercase tracking-[0.3em] text-mist md:block">
            Scroll to advance ↓
          </p>
        </div>
        <div className="mt-6 h-px w-full bg-line sm:mt-8">
          <div
            data-pipeline-progress
            className="h-px w-full origin-left scale-x-0 bg-gradient-to-r from-sui to-aqua shadow-[0_0_12px_rgba(77,162,255,0.8)]"
          />
        </div>
      </div>

      {/* horizontal track — top padding clears the pinned header at all sizes */}
      <div ref={track} className="flex h-screen w-max items-center pt-36 sm:pt-40">
        {STEPS.map((step) => (
          <div
            key={step.n}
            data-panel
            className="flex h-full w-screen shrink-0 items-center px-6 md:px-20"
          >
            <div className="mx-auto grid w-full max-w-6xl items-center gap-8 md:grid-cols-2 md:gap-14">
              <div>
                <div
                  data-panel-item
                  className="font-display text-[4.5rem] font-semibold leading-none text-transparent sm:text-[7rem] lg:text-[8.5rem]"
                  style={{ WebkitTextStroke: "1px rgba(77,162,255,0.45)" }}
                >
                  {step.n}
                </div>
                <h3
                  data-panel-item
                  className="mt-2 font-display text-2xl font-semibold text-white sm:text-3xl lg:text-4xl"
                >
                  {step.title}
                </h3>
                <p
                  data-panel-item
                  className="mt-5 max-w-[48ch] text-[15px] leading-7 text-pretty text-mist sm:mt-6 sm:text-base sm:leading-8"
                >
                  {step.body}
                </p>
              </div>

              {step.code ? (
                <div data-panel-item className="w-full max-w-md md:justify-self-end">
                  <BorderGlow backgroundColor="rgba(6, 20, 38, 0.75)">
                    <div className="p-5 font-mono text-xs leading-6 text-sui/90 sm:p-6 sm:text-sm sm:leading-7">
                      <div className="mb-4 flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-danger/70" />
                        <span className="h-2.5 w-2.5 rounded-full bg-[#ffc861]/70" />
                        <span className="h-2.5 w-2.5 rounded-full bg-aqua/70" />
                        <span className="ml-3 text-[10px] uppercase tracking-[0.24em] text-mist">
                          aegis://simulation
                        </span>
                      </div>
                      <pre className="whitespace-pre-wrap">
                        {step.code.map((line, i) => (
                          <span key={i} data-term-line className="block">
                            {line.map((seg, j) =>
                              seg.hl ? (
                                <span
                                  key={j}
                                  data-term-seg
                                  data-term-hl
                                  className="rounded px-1 font-semibold text-aqua"
                                >
                                  {seg.t}
                                </span>
                              ) : (
                                <span key={j} data-term-seg>
                                  {seg.t}
                                </span>
                              )
                            )}
                          </span>
                        ))}
                        <span
                          data-term-cursor
                          className="animate-blink mt-1 inline-block h-[1.1em] w-[0.55em] translate-y-[0.2em] bg-aqua/80"
                        />
                      </pre>
                    </div>
                  </BorderGlow>
                </div>
              ) : (
                <WalletVerdictCard data-panel-item />
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function WalletVerdictCard(props: Record<string, unknown>) {
  return (
    <div {...props} className="relative mx-auto w-full max-w-sm">
      <BorderGlow
        borderRadius={24}
        glowColor="353 100% 68%"
        colors={["#ff5c6e", "#ff98a6", "#ffc861"]}
        backgroundColor="rgba(6, 20, 38, 0.8)"
      >
        <div className="p-6">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-mist">
              Sui Wallet — Sign Request
            </span>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping-soft absolute inline-flex h-full w-full rounded-full bg-danger" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-danger" />
            </span>
          </div>

          <div className="mt-6 rounded-2xl border border-danger/40 bg-danger/10 p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-danger/20 font-display text-lg text-danger">
                !
              </span>
              <div>
                <p className="font-display text-sm font-semibold text-danger">
                  AEGIS SECURITY ALERT
                </p>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-danger/80">
                  Verdict in 212ms
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-white/90">
              This transaction will transfer{" "}
              <span className="font-semibold text-danger">3 objects</span> you own —
              including your Kiosk — to an unverified address. Simulated outcome:
              wallet drained.
            </p>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <button className="rounded-xl bg-danger py-3 font-mono text-xs font-semibold uppercase tracking-[0.18em] text-white">
              Abort
            </button>
            <button className="rounded-xl border border-line py-3 font-mono text-xs uppercase tracking-[0.18em] text-mist">
              Sign anyway
            </button>
          </div>
        </div>
      </BorderGlow>
    </div>
  );
}
