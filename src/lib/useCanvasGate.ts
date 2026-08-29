"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Pauses an R3F canvas when it scrolls out of view.
 *
 * Attach `ref` to a wrapper div around the <Canvas> and feed `frameloop`
 * to the Canvas. The rootMargin resumes rendering slightly before the
 * canvas re-enters the viewport so the pause is never visible.
 */
export function useCanvasGate() {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { rootMargin: "160px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return { ref, frameloop: (inView ? "always" : "never") as "always" | "never" };
}
