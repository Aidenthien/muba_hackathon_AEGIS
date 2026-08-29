"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useReveal } from "@/lib/useReveal";
import BorderGlow from "@/components/BorderGlow";

gsap.registerPlugin(ScrollTrigger);

const METRICS = [
  { value: 3.8, suffix: "B", prefix: "$", decimals: 1, label: "Lost to Web3 exploits in 2025" },
  { value: 212, suffix: "ms", prefix: "", decimals: 0, label: "Median AEGIS verdict latency" },
  { value: 100, suffix: "%", prefix: "", decimals: 0, label: "Of attacks caught pre-signature" },
  { value: 0, suffix: "", prefix: "", decimals: 0, label: "Keys, funds or caps in custody" },
];

export default function CTA() {
  const root = useRef<HTMLElement>(null);
  useReveal(root);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>("[data-counter]").forEach((el) => {
        const value = parseFloat(el.dataset.value ?? "0");
        const decimals = parseInt(el.dataset.decimals ?? "0", 10);
        const prefix = el.dataset.prefix ?? "";
        const suffix = el.dataset.suffix ?? "";
        const state = { n: 0 };

        gsap.to(state, {
          n: value,
          duration: 2,
          ease: "power2.out",
          scrollTrigger: { trigger: el, start: "top 88%" },
          onUpdate: () => {
            el.textContent = `${prefix}${state.n.toFixed(decimals)}${suffix}`;
          },
        });
      });
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <section id="access" ref={root} className="relative scroll-mt-24 overflow-hidden py-24 sm:py-32">
      <div className="spot left-1/2 top-1/2 h-[600px] w-[900px] -translate-x-1/2 -translate-y-1/2 bg-sui/12" />

      <div className="relative mx-auto max-w-7xl px-6">
        {/* metrics */}
        <BorderGlow backgroundColor="#020710">
          <div className="grid gap-px overflow-hidden rounded-2xl bg-line sm:grid-cols-2 lg:grid-cols-4">
            {METRICS.map((m) => (
              <div key={m.label} data-reveal data-reveal-group="metrics" className="bg-ink/80 p-8">
                <div
                  data-counter
                  data-value={m.value}
                  data-decimals={m.decimals}
                  data-prefix={m.prefix}
                  data-suffix={m.suffix}
                  className="font-display text-3xl font-semibold text-gradient-blue"
                >
                  {m.prefix}0{m.suffix}
                </div>
                <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-mist">
                  {m.label}
                </div>
              </div>
            ))}
          </div>
        </BorderGlow>

      </div>
    </section>
  );
}
