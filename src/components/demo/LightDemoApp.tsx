"use client";

import Link from "next/link";
import { DAppKitProvider } from "@mysten/dapp-kit-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { dAppKit } from "@/lib/dapp-kit";
import LightTransactionLab from "@/components/demo/LightTransactionLab";

const queryClient = new QueryClient();

export default function LightDemoApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <DAppKitProvider dAppKit={dAppKit}>
        <div className="relative min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-blue-200">
          {/* Subtle background glow elements for light mode */}
          <div className="pointer-events-none absolute left-1/4 top-0 h-96 w-96 rounded-full bg-blue-100/60 blur-3xl" />
          <div className="pointer-events-none absolute right-1/4 top-40 h-96 w-96 rounded-full bg-indigo-100/50 blur-3xl" />

          {/* Header */}
          <header className="relative z-10 border-b border-slate-200 bg-white/80 backdrop-blur-md">
            <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
              <Link href="/" className="flex items-center gap-3">
                <span className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-blue-600/30 bg-blue-50 text-blue-600 shadow-sm">
                  <span className="h-3 w-3 rounded-full bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.4)]" />
                </span>
                <div>
                  <span className="font-display text-lg font-bold tracking-tight text-slate-900">
                    AEGIS
                  </span>
                  <span className="ml-2 rounded bg-blue-100 px-2 py-0.5 font-mono text-[11px] font-semibold tracking-wider text-blue-800">
                    PRESENTATION DEMO
                  </span>
                </div>
              </Link>

              <div className="flex items-center gap-4">
                <Link
                  href="/demo"
                  className="rounded-full border border-slate-300 bg-white px-4 py-1.5 font-mono text-xs font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-100 hover:text-slate-900"
                >
                  🌙 Switch to Dark Theme
                </Link>
                <Link
                  href="/"
                  className="font-mono text-xs font-semibold tracking-wider text-slate-600 transition-colors hover:text-blue-600"
                >
                  ← Back to site
                </Link>
              </div>
            </div>
          </header>

          {/* Main content */}
          <main className="relative z-10 mx-auto max-w-7xl px-6 pb-24 pt-10">
            <div className="mb-10 text-center">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 font-mono text-xs font-bold text-blue-700">
                <span className="h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
                AEGIS REAL-TIME AGENT LAB
              </div>
              <h1 className="font-display text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
                See it before you sign it
              </h1>
              <p className="mx-auto mt-4 max-w-3xl text-lg font-normal leading-relaxed text-slate-600">
                Every Sui transaction is parsed, simulated, and risk-scored in real-time by the AEGIS agent server before your wallet opens.
              </p>
            </div>

            <LightTransactionLab />
          </main>
        </div>
      </DAppKitProvider>
    </QueryClientProvider>
  );
}
