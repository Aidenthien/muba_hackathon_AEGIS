"use client";

import dynamic from "next/dynamic";

const LightDemoApp = dynamic(() => import("@/components/demo/LightDemoApp"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <p className="font-mono text-sm uppercase tracking-[0.3em] text-slate-500">
        Loading presentation lab…
      </p>
    </div>
  ),
});

export default function LightDemoAppLoader() {
  return <LightDemoApp />;
}

