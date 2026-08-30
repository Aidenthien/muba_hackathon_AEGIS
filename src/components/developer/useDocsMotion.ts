"use client";

import { RefObject, useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * All scroll and pointer motion for the docs page, in one GSAP context.
 *
 * Deliberately one system: ScrollTrigger owns the reading progress AND the
 * active-section tracking, so both share a single refresh model and can't
 * disagree about where the reader is. (An IntersectionObserver did the second
 * job before, which meant two independent notions of "current section".)
 *
 * Everything decorative sits behind `prefers-reduced-motion: no-preference`,
 * so a reader who asked for less motion gets a plain, fully-visible page —
 * entrance animations are never the reason content is missing.
 *
 * Uses gsap.context() + ctx.revert() rather than useGSAP() because @gsap/react
 * isn't a dependency here and the rest of the site already uses this pattern.
 */
export function useDocsMotion({
  root,
  progress,
  sectionIds,
  onActiveChange,
}: {
  root: RefObject<HTMLElement | null>;
  progress: RefObject<HTMLElement | null>;
  /** Stable module-level array — a fresh one each render would re-run this. */
  sectionIds: readonly string[];
  /** Stable setter (useState dispatch). */
  onActiveChange: (id: string) => void;
}) {
  useEffect(() => {
    if (!root.current) return;

    const ctx = gsap.context(() => {
      // ── Reading progress: scrubbed to document scroll, transform only. ──
      if (progress.current) {
        gsap.fromTo(
          progress.current,
          { scaleX: 0 },
          {
            scaleX: 1,
            ease: "none",
            scrollTrigger: {
              trigger: document.documentElement,
              start: "top top",
              end: "bottom bottom",
              // A small numeric scrub smooths the bar without lagging the read.
              scrub: 0.3,
            },
          }
        );
      }

      // ── Active section for the sidebar and the mobile rail. ──
      // The band sits high in the viewport so the highlight matches whatever
      // heading the reader is actually looking at, not what's centred.
      for (const id of sectionIds) {
        const el = document.getElementById(id);
        if (!el) continue;
        ScrollTrigger.create({
          trigger: el,
          start: "top 30%",
          end: "bottom 30%",
          onToggle: (self) => {
            if (self.isActive) onActiveChange(id);
          },
        });
      }
    }, root);

    // ── Decorative motion, gated on the reader's motion preference. ──
    const mm = gsap.matchMedia();

    mm.add(
      "(prefers-reduced-motion: no-preference)",
      () => {
        const cards = gsap.utils.toArray<HTMLElement>("[data-doc-card]");
        if (cards.length === 0) return;

        // Hidden from JS, never from CSS: if this file never runs, every card
        // is still on screen and readable.
        gsap.set(cards, { opacity: 0, y: 24 });

        // batch() collects everything entering within one frame into a single
        // staggered tween — cheaper than one ScrollTrigger animation per card.
        ScrollTrigger.batch(cards, {
          start: "top 88%",
          // once: cards stay put after their entrance, so jumping back up a
          // long docs page never re-animates text the reader already read.
          once: true,
          onEnter: (batch) =>
            gsap.to(batch, {
              opacity: 1,
              y: 0,
              duration: 0.7,
              ease: "power3.out",
              stagger: 0.08,
              overwrite: true,
            }),
        });
      },
      root.current
    );

    // ── Magnetic pull on the download CTAs. Pointer-only: a touch device has
    //    no hover to express it, and coarse pointers make it feel broken. ──
    mm.add(
      "(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)",
      () => {
        const targets = gsap.utils.toArray<HTMLElement>("[data-doc-magnetic]");
        const teardowns = targets.map((el) => {
          // quickTo reuses one tween per property instead of allocating a new
          // tween on every pointermove.
          const xTo = gsap.quickTo(el, "x", { duration: 0.5, ease: "power3" });
          const yTo = gsap.quickTo(el, "y", { duration: 0.5, ease: "power3" });

          const onMove = (e: PointerEvent) => {
            const r = el.getBoundingClientRect();
            xTo((e.clientX - (r.left + r.width / 2)) * 0.15);
            yTo((e.clientY - (r.top + r.height / 2)) * 0.28);
          };
          const onLeave = () => {
            xTo(0);
            yTo(0);
          };

          el.addEventListener("pointermove", onMove);
          el.addEventListener("pointerleave", onLeave);
          // Listeners aren't part of the GSAP context, so they're removed here.
          return () => {
            el.removeEventListener("pointermove", onMove);
            el.removeEventListener("pointerleave", onLeave);
          };
        });

        return () => teardowns.forEach((fn) => fn());
      },
      root.current
    );

    return () => {
      mm.revert();
      ctx.revert();
    };
  }, [root, progress, sectionIds, onActiveChange]);
}
