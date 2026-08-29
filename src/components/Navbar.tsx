"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { onLoaded } from "@/lib/loader";
import AegisMark from "@/components/AegisMark";

gsap.registerPlugin(ScrollTrigger);

const LINKS = [
  { label: "Pre-Mortem", href: "#premortem" },
  { label: "The Pivot", href: "#pivot" },
  { label: "Pipeline", href: "#pipeline" },
  { label: "Moat", href: "#moat" },
  { label: "Live Demo", href: "/demo" },
];

export default function Navbar() {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const intro = gsap.from(ref.current, {
        y: -64,
        opacity: 0,
        duration: 1,
        ease: "power3.out",
        paused: true,
      });
      onLoaded(() => intro.play());

      // solidify the bar once the user leaves the hero
      ScrollTrigger.create({
        start: "top -80",
        onUpdate: (self) => {
          ref.current?.classList.toggle("nav-solid", self.progress > 0 || self.scroll() > 80);
        },
      });
    });
    return () => ctx.revert();
  }, []);

  return (
    <header
      ref={ref}
      className="fixed inset-x-0 top-0 z-50 transition-colors duration-500 [&.nav-solid]:bg-ink/80 [&.nav-solid]:backdrop-blur-md [&.nav-solid]:border-b [&.nav-solid]:border-line"
    >
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <a href="#" className="flex items-center gap-3">
          <AegisMark className="h-8 w-8" />
          <span className="font-display text-base font-semibold tracking-[0.12em]">
            AEGIS
          </span>
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.3em] text-mist sm:block">
            / Sui Oracle
          </span>
        </a>

        <ul className="hidden items-center gap-8 md:flex">
          {LINKS.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                className="font-mono text-xs uppercase tracking-[0.2em] text-mist transition-colors hover:text-aqua"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <a
          href="#access"
          className="group relative overflow-hidden rounded-full border border-sui/50 px-5 py-2 font-mono text-xs uppercase tracking-[0.2em] text-white transition-all hover:border-aqua hover:shadow-[0_0_24px_rgba(77,162,255,0.35)]"
        >
          <span className="relative z-10">Request Access</span>
          <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-sui/30 to-aqua/20 transition-transform duration-500 group-hover:translate-x-0" />
        </a>
      </nav>
    </header>
  );
}
