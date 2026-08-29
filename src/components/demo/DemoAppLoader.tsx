"use client";

import dynamic from "next/dynamic";

// dApp Kit reads browser-only APIs (window, wallet standard events) at module
// scope, so the whole demo tree must skip server rendering entirely.
const DemoApp = dynamic(() => import("./DemoApp"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-screen items-center justify-center">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-mist">
        Loading transaction lab…
      </p>
    </div>
  ),
});

export default function DemoAppLoader() {
  return <DemoApp />;
}
