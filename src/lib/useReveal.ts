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
 */
export function useReveal(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!root.current) return;

    const ctx = gsap.context(() => {
      /* fade-slide groups */
      const groups = new Map<string, HTMLElement[]>();
      gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((el) => {
        const key = el.dataset.revealGroup ?? `solo-${Math.random()}`;
        groups.set(key, [...(groups.get(key) ?? []), el]);
      });

      groups.forEach((els) => {
        gsap.fromTo(
          els,
          { y: 48, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 1.1,
            ease: "power3.out",
            stagger: 0.12,
            scrollTrigger: {
              trigger: els[0],
              start: "top 85%",
            },
          }
        );
      });

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
    }, root);

    return () => ctx.revert();
  }, [root]);
}
