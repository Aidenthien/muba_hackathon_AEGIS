"use client";

import Link from "next/link";
import { DAppKitProvider } from "@mysten/dapp-kit-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { dAppKit } from "@/lib/dapp-kit";
import TransactionLab from "./TransactionLab";

const queryClient = new QueryClient();

export default function DemoApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <DAppKitProvider dAppKit={dAppKit}>
        <div className="relative min-h-screen overflow-hidden">
          <div className="spot left-[-10%] top-[-10%] h-[420px] w-[420px] bg-sui/20" />
          <div className="spot bottom-[-15%] right-[-5%] h-[380px] w-[380px] bg-aqua/10" />

          <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
            <Link href="/" className="flex items-center gap-3">
              <span className="relative flex h-8 w-8 items-center justify-center">
                <span className="absolute inset-0 rounded-md border border-sui/60 rotate-45" />
                <span className="h-2 w-2 rounded-full bg-aqua shadow-[0_0_12px_#6ff7ff]" />
              </span>
              <span className="font-display text-base font-semibold tracking-[0.12em]">
                AEGIS
              </span>
              <span className="hidden font-mono text-[10px] uppercase tracking-[0.3em] text-mist sm:block">
                / Transaction Lab
              </span>
            </Link>
            <div className="flex items-center gap-4">
              <Link
                href="/demo-light"
                className="rounded-full border border-sui/40 bg-sui/10 px-3 py-1 font-mono text-xs font-medium text-aqua transition-colors hover:border-sui hover:bg-sui/20"
              >
                ☀️ Light Presentation Mode
              </Link>
              <Link
                href="/"
                className="font-mono text-xs uppercase tracking-[0.2em] text-mist transition-colors hover:text-aqua"
              >
                ← Back to site
              </Link>
            </div>
          </header>

          <main className="relative z-10 mx-auto max-w-6xl px-6 pb-24 pt-8">
            <div className="mb-12 text-center">
              <p className="kicker mb-4">Live demo</p>
              <h1 className="font-display text-3xl sm:text-4xl">
                <span className="text-gradient-blue">See it before you sign it</span>
              </h1>
              <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-mist">
                Every transaction below is parsed, simulated, and risk-scored by
                the AEGIS agent before your wallet ever opens. Approve, hesitate,
                or walk away — with the facts in front of you.
              </p>
            </div>

            <TransactionLab />
          </main>
        </div>
      </DAppKitProvider>
    </QueryClientProvider>
  );
}
