"use client";

import { RefObject, useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { ScrambleTextPlugin } from "gsap/ScrambleTextPlugin";

gsap.registerPlugin(ScrollTrigger, SplitText, ScrambleTextPlugin);

export const SCRAMBLE_CHARS = "01<>/#░▒▓ØΞ×";

/**
 * Scroll-triggered text/element animations inside `root`:
 *
 *  [data-reveal]    — fade-slide up (same data-reveal-group staggers together)
 *  [data-title]     — SplitText masked line reveal for headings
 *  [data-scramble]  — matrix-style decode of the element's text
 *
 * All of it sits behind `prefers-reduced-motion: no-preference`. Every one of
 * these effects starts from opacity 0, so for a reader who asked for less
 * motion the honest behaviour isn't a faster animation — it's no animation and
 * a page that is simply already there. Nothing hides content in CSS, so if this
 * hook never runs the section still reads.
 */
export function useReveal(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!root.current) return;

    const mm = gsap.matchMedia();

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      /* fade-slide groups.

         Grouped members are batched: ScrollTrigger.batch collects everything
         crossing the line within one frame into a single staggered tween, so a
         six-card grid costs one tween rather than six. It also staggers by what
         actually entered, which is what makes a partially-scrolled grid look
         right instead of replaying from the first card. */
      const grouped = new Map<string, HTMLElement[]>();
      const solo: HTMLElement[] = [];

      for (const el of gsap.utils.toArray<HTMLElement>("[data-reveal]")) {
        const key = el.dataset.revealGroup;
        if (key) grouped.set(key, [...(grouped.get(key) ?? []), el]);
        else solo.push(el);
      }

      const enter = (els: Element[]) =>
        gsap.to(els, {
          y: 0,
          opacity: 1,
          duration: 1.1,
          ease: "power3.out",
          stagger: 0.12,
          overwrite: true,
        });

      for (const els of [...grouped.values(), ...(solo.length ? [solo] : [])]) {
        gsap.set(els, { y: 48, opacity: 0 });
        ScrollTrigger.batch(els, {
          start: "top 85%",
          // once: a long page shouldn't re-animate copy the reader already read
          // on the way back up.
          once: true,
          onEnter: enter,
        });
      }

      /* masked line reveals for big headings */
      gsap.utils.toArray<HTMLElement>("[data-title]").forEach((el) => {
        SplitText.create(el, {
          type: "lines",
          mask: "lines",
          autoSplit: true,
          onSplit: (self) =>
            gsap.from(self.lines, {
              yPercent: 115,
              rotate: 2,
              duration: 1.2,
              ease: "power4.out",
              stagger: 0.12,
              scrollTrigger: {
                trigger: el,
                start: "top 85%",
              },
            }),
        });
      });

      /* matrix decode for kicker labels */
      gsap.utils.toArray<HTMLElement>("[data-scramble]").forEach((el) => {
        const text = el.textContent ?? "";
        gsap.to(el, {
          duration: 1.4,
          ease: "none",
          scrambleText: {
            text,
            chars: SCRAMBLE_CHARS,
            speed: 0.4,
          },
          scrollTrigger: {
            trigger: el,
            start: "top 90%",
          },
        });
      });
    }, root.current);

    return () => mm.revert();
  }, [root]);
}
