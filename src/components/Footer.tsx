"use client";

import dynamic from "next/dynamic";
import ScrambledText from "@/components/ScrambledText";
import { SCRAMBLE_CHARS } from "@/lib/useReveal";

const Dither = dynamic(() => import("@/components/Dither"), {
  ssr: false,
  loading: () => null,
});

export default function Footer() {
  return (
    <footer className="relative flex min-h-[60vh] w-full flex-col justify-center overflow-hidden border-t border-line">
      {/* dithered waves in the brand blue, edge to edge */}
      <div className="absolute inset-0">
        <Dither waveColor={[0.302, 0.635, 1.0]} />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(2,7,16,0.15),rgba(2,7,16,0.8))]" />

      {/* product title, one end to the other */}
      <div className="pointer-events-none relative z-10 w-full px-4 sm:px-8">
        <ScrambledText
          className="pointer-events-auto w-full text-white [&_p]:flex [&_p]:justify-between"
          style={{
            margin: 0,
            maxWidth: "none",
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            fontSize: "clamp(4rem, 17vw, 18rem)",
            lineHeight: 1,
          }}
          scrambleChars={SCRAMBLE_CHARS}
        >
          AEGIS
        </ScrambledText>
      </div>

      <p className="pointer-events-none absolute inset-x-0 bottom-5 z-10 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-mist/70">
        © 2026 AEGIS Labs — Built on Sui · Simulate first. Sign second.
      </p>
    </footer>
  );
}
