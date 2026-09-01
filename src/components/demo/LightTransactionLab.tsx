"use client";

import { useEffect, useState } from "react";
import {
  useCurrentAccount,
  useCurrentClient,
  useCurrentNetwork,
  useDAppKit,
} from "@mysten/dapp-kit-react";
import { ConnectButton } from "@mysten/dapp-kit-react/ui";
import { Transaction } from "@mysten/sui/transactions";
import { isValidSuiAddress } from "@mysten/sui/utils";
import { zkLoginEnabled } from "@/lib/dapp-kit";
import { aegis, type AegisResult } from "@/lib/aegis-sdk";
import InstallPrompt from "@/components/aegis/InstallPrompt";
import { SponsorError, signAndExecuteSponsored } from "@/lib/sponsor";

import { MIST_PER_SUI, SCENARIOS, formatBalanceChange, shortAddress } from "./scenarios";

const EXTERNAL_TEST_WALLET =
  "0xcca26f7ae2e40604498294e95bacccc4652cc8cb2aa074d7ee608c7e7bdf0c29";

const VERDICT_STYLE = {
  approve: {
    bg: "bg-emerald-50",
    border: "border-emerald-300",
    badge: "bg-emerald-600 text-white",
    score: "bg-emerald-100 text-emerald-900 border-emerald-300",
    title: "SAFE TO SIGN",
  },
  caution: {
    bg: "bg-amber-50",
    border: "border-amber-300",
    badge: "bg-amber-500 text-white",
    score: "bg-amber-100 text-amber-900 border-amber-300",
    title: "PROCEED WITH CAUTION",
  },
  reject: {
    bg: "bg-red-50",
    border: "border-red-300",
    badge: "bg-red-600 text-white",
    score: "bg-red-100 text-red-900 border-red-300",
    title: "HIGH RISK — DO NOT SIGN",
  },
} as const;

const INTEGRATION_SNIPPET = `import { aegis } from "@aegis/sdk";

const { status } = await aegis.analyze({
  transaction: await tx.toJSON(),
  sender: account.address,
  network: "testnet",
});

if (status === "approved") {
  await signAndExecuteTransaction({ transaction: tx });
}`;

function describeSignError(err: unknown): string {
  if (err instanceof Error) {
    if (err.message.includes("User rejected")) {
      return "Transaction signing was canceled in your wallet.";
    }
    return err.message;
  }
  return "Failed to sign or execute the transaction.";
}

// Fixed to 4 decimals so the balance doesn't jump between "1" and "0.9977"
function formatSui(mist: bigint): string {
  return (Number(mist) / Number(MIST_PER_SUI)).toLocaleString(undefined, {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  });
}

/** What the page is doing right now. The verdict itself lives in the popup. */
type Phase = "idle" | "awaiting" | "signing" | "settled";

export default function LightTransactionLab() {
  const account = useCurrentAccount();
  const network = useCurrentNetwork();
  const client = useCurrentClient();
  const dAppKit = useDAppKit();

  const [selected, setSelected] = useState<string>(SCENARIOS[0].id);
  const [targetRecipient, setTargetRecipient] = useState("");
  const [transferAmount, setTransferAmount] = useState("0.05");

  const [phase, setPhase] = useState<Phase>("idle");
  const [outcome, setOutcome] = useState<AegisResult | null>(null);
  const [rawPtb, setRawPtb] = useState<string | null>(null);
  const [rawPtbSponsored, setRawPtbSponsored] = useState(false);
  const [buildError, setBuildError] = useState<string | null>(null);
  const [signError, setSignError] = useState<string | null>(null);
  const [digest, setDigest] = useState<string | null>(null);
  const [showInstall, setShowInstall] = useState(false);
  const [extensionVersion, setExtensionVersion] = useState<string | null>(null);
  const [extensionChecked, setExtensionChecked] = useState(false);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [sponsorAvailable, setSponsorAvailable] = useState(false);

  const scenario = SCENARIOS.find((s) => s.id === selected) ?? SCENARIOS[0];
  const isTransfer = selected === "safe-transfer";
  const isTargetValid = !targetRecipient.trim() || isValidSuiAddress(targetRecipient.trim());
  const isAmountValid = Number(transferAmount) > 0;
  const busy = phase === "awaiting" || phase === "signing";

  // Probe for the extension once so the UI can say whether it's armed before
  // the user commits to a run.
  useEffect(() => {
    let cancelled = false;
    aegis.detect().then((provider) => {
      if (cancelled) return;
      setExtensionVersion(provider?.version ?? null);
      setExtensionChecked(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/sponsor")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setSponsorAvailable(Boolean(data.enabled));
      })
      .catch(() => {}); // no sponsor endpoint = wallet pays its own gas
    return () => {
      cancelled = true;
    };
  }, []);

  async function refreshBalance(): Promise<void> {
    if (!account) return;
    try {
      const { balance: b } = await client.core.getBalance({ owner: account.address });
      setBalance(BigInt(b.balance));
    } catch {
      // non-fatal; the display just stays as it was
    }
  }

  // Read the balance on connect and on network change. The fetch lives inside
  // a nested async fn so the effect body itself never calls setState.
  useEffect(() => {
    if (!account) return;
    const owner = account.address;
    let cancelled = false;
    (async () => {
      try {
        const { balance: b } = await client.core.getBalance({ owner });
        if (!cancelled) setBalance(BigInt(b.balance));
      } catch {
        // non-fatal; the display just stays as it was
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.address, network]);

  function reset() {
    setOutcome(null);
    setRawPtb(null);
    setRawPtbSponsored(false);
    setBuildError(null);
    setSignError(null);
    setDigest(null);
    setPhase("idle");
  }

  function selectScenario(id: string) {
    setSelected(id);
    reset();
  }

  /** Signs the exact payload AEGIS analyzed, not a freshly rebuilt one. */
  async function execute(payload: string, sponsored: boolean) {
    if (!account) return;
    setPhase("signing");
    setSignError(null);
    try {
      const tx = Transaction.from(payload);
      // Sponsored runs go out through the server (gas comes from Enoki); the
      // wallet still signs the same commands either way.
      const txDigest = sponsored
        ? (
            await signAndExecuteSponsored({
              transaction: tx,
              sender: account.address,
              network,
            })
          ).digest
        : await (async () => {
            const result = await dAppKit.signAndExecuteTransaction({ transaction: tx });
            if (result.$kind === "FailedTransaction") {
              throw new Error(
                result.FailedTransaction.status.error?.message ?? "Transaction failed on-chain"
              );
            }
            return result.Transaction.digest;
          })();
      await client.core.waitForTransaction({ digest: txDigest });
      setDigest(txDigest);
      void refreshBalance(); // reflect the balance the transfer just changed
    } catch (e) {
      // Sponsor rejections already carry a precise, actionable message — don't
      // launder them through the wallet-error translator.
      setSignError(e instanceof SponsorError ? e.message : describeSignError(e));
    } finally {
      setPhase("settled");
    }
  }

  /**
   * The whole integration: build the PTB, hand it to the extension, and act on
   * the status it hands back. Everything the user reads happens in the popup.
   */
  async function runAegis() {
    if (!account) return;

    if (isTransfer && !isTargetValid) {
      setBuildError("That target recipient isn't a valid Sui address (must be 0x…).");
      return;
    }
    if (isTransfer && !isAmountValid) {
      setBuildError("Enter a SUI amount greater than 0.");
      return;
    }

    reset();

    // Captured once: the payload AEGIS analyzes has to be the one we execute,
    // so a late /api/sponsor probe must not change how it's submitted.
    const sponsoredRun = sponsorAvailable && scenario.sponsorable;

    let payload: string;
    try {
      const recipient = isTransfer
        ? targetRecipient.trim() || account.address
        : account.address;
      const amount = Number(transferAmount) > 0 ? Number(transferAmount) : 0.05;
      payload = await scenario
        .build(account.address, recipient, amount, { sponsored: sponsoredRun })
        .toJSON({ client });
    } catch (e) {
      setBuildError(e instanceof Error ? e.message : "Could not build the transaction.");
      return;
    }

    setRawPtb(payload);
    setRawPtbSponsored(sponsoredRun);
    setPhase("awaiting");

    const result = await aegis.analyze({
      transaction: payload,
      sender: account.address,
      network,
      label: scenario.label,
    });

    if (result.status === "not_installed") {
      setPhase("idle");
      setShowInstall(true);
      return;
    }

    setOutcome(result);

    if (result.status === "approved" && scenario.executable) {
      await execute(payload, sponsoredRun);
      return;
    }
    setPhase("settled");
  }

  // ── Step 1: connect ──────────────────────────────────────────────
  if (!account) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-lg">
        <span className="mb-4 inline-block rounded-full bg-blue-100 px-3 py-1 font-mono text-xs font-bold uppercase tracking-widest text-blue-800">
          Step 1 — Wallet Authentication
        </span>
        <h2 className="mb-4 font-display text-3xl font-bold text-slate-900">
          Connect your Sui Wallet or Sign in with Google
        </h2>
        <p className="mb-8 text-base leading-relaxed text-slate-600">
          AEGIS protects your transactions by analyzing Move call targets, balance
          changes, and exploit patterns before signing. Connect Slush, Sui Wallet
          {zkLoginEnabled ? ", or use Google zkLogin" : ""} on{" "}
          <strong className="text-blue-700">testnet</strong>.
        </p>
        <div className="flex scale-110 justify-center">
          <ConnectButton />
        </div>
      </div>
    );
  }

  const verdict =
    outcome?.analysis && VERDICT_STYLE[outcome.analysis.recommendation]
      ? VERDICT_STYLE[outcome.analysis.recommendation]
      : null;

  return (
    <>
      {showInstall && (
        <InstallPrompt
          theme="light"
          onClose={() => setShowInstall(false)}
          onRetry={async () => {
            setShowInstall(false);
            const provider = await aegis.detect(1500);
            setExtensionVersion(provider?.version ?? null);
            if (provider) void runAegis();
            else setShowInstall(true);
          }}
        />
      )}

      <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* ── Left: wallet + scenario ── */}
        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="mb-1 font-mono text-xs font-bold uppercase tracking-widest text-slate-500">
                  Connected Sender Wallet
                </p>
                <p className="font-mono text-base font-bold text-slate-900">
                  {shortAddress(account.address)}
                </p>
                <p className="mt-1 font-mono text-xs font-semibold uppercase tracking-wider text-blue-600">
                  Network: {network}
                </p>
              </div>
              <ConnectButton />
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <p className="font-mono text-xs font-bold uppercase tracking-widest text-slate-500">
                Balance
              </p>
              <p className="font-mono text-base font-bold text-slate-900">
                {balance === null ? "…" : `${formatSui(balance)} SUI`}
              </p>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <p className="font-mono text-xs font-bold uppercase tracking-widest text-slate-500">
                AEGIS Extension
              </p>
              {!extensionChecked ? (
                <span className="font-mono text-xs text-slate-400">checking…</span>
              ) : extensionVersion ? (
                <span className="flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 font-mono text-xs font-bold text-emerald-800">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Armed · v{extensionVersion}
                </span>
              ) : (
                <button
                  onClick={() => setShowInstall(true)}
                  className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 font-mono text-xs font-bold text-amber-800 hover:bg-amber-100"
                >
                  Not installed — install
                </button>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <span className="mb-4 inline-block rounded-full bg-blue-50 px-3 py-1 font-mono text-xs font-bold uppercase tracking-wider text-blue-700">
              Step 2 — Choose a Scenario
            </span>
            <h2 className="mb-4 font-display text-xl font-bold text-slate-900">
              Select a Transaction Payload
            </h2>

            <div className="space-y-3">
              {SCENARIOS.map((s) => {
                const active = selected === s.id;
                const badge =
                  s.expected === "approve"
                    ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                    : s.expected === "caution"
                      ? "bg-amber-100 text-amber-800 border-amber-300"
                      : "bg-red-100 text-red-800 border-red-300";

                return (
                  <button
                    key={s.id}
                    onClick={() => selectScenario(s.id)}
                    disabled={busy}
                    className={`w-full rounded-xl border p-4 text-left transition-all disabled:opacity-60 ${
                      active
                        ? "border-blue-600 bg-blue-50/70 shadow-md ring-2 ring-blue-500/20"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-base font-bold text-slate-900">{s.label}</span>
                      <span
                        className={`rounded border px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wider ${badge}`}
                      >
                        Expected: {s.expected}
                      </span>
                    </div>
                    <p className="text-sm leading-snug text-slate-600">{s.blurb}</p>
                  </button>
                );
              })}
            </div>

            {isTransfer && (
              <div className="mt-5 space-y-4 rounded-xl border border-blue-200 bg-blue-50/60 p-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="aegis-recipient"
                      className="font-mono text-xs font-bold uppercase tracking-wider text-blue-900"
                    >
                      🎯 Target Recipient Wallet Address
                    </label>
                    <span className="font-mono text-[11px] font-semibold text-blue-700">
                      (Agent inspects target history)
                    </span>
                  </div>
                  <input
                    id="aegis-recipient"
                    type="text"
                    value={targetRecipient}
                    onChange={(e) => setTargetRecipient(e.target.value)}
                    placeholder="0x... (leave empty to send to self)"
                    className={`w-full rounded-lg border bg-white px-3.5 py-2.5 font-mono text-xs text-slate-900 outline-none focus:ring-2 ${
                      isTargetValid
                        ? "border-slate-300 focus:ring-blue-500"
                        : "border-red-400 bg-red-50/50 focus:ring-red-400"
                    }`}
                  />
                  <div className="flex gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => setTargetRecipient(account.address)}
                      className="rounded border border-slate-300 bg-white px-2.5 py-1 font-mono text-[11px] font-bold text-slate-700 hover:bg-slate-100"
                    >
                      👤 Send to Self
                    </button>
                    <button
                      type="button"
                      onClick={() => setTargetRecipient(EXTERNAL_TEST_WALLET)}
                      className="rounded border border-slate-300 bg-white px-2.5 py-1 font-mono text-[11px] font-bold text-slate-700 hover:bg-slate-100"
                    >
                      🌐 External Target Address
                    </button>
                  </div>
                </div>

                <div className="space-y-2 border-t border-blue-200/60 pt-2">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="aegis-amount"
                      className="font-mono text-xs font-bold uppercase tracking-wider text-blue-900"
                    >
                      💰 Transfer Amount (SUI)
                    </label>
                    <span className="font-mono text-[11px] font-semibold text-blue-700">
                      (Custom SUI amount)
                    </span>
                  </div>
                  <input
                    id="aegis-amount"
                    type="number"
                    step="0.01"
                    min="0.001"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    placeholder="e.g. 0.05"
                    className={`w-full rounded-lg border bg-white px-3.5 py-2.5 font-mono text-xs text-slate-900 outline-none focus:ring-2 ${
                      isAmountValid
                        ? "border-slate-300 focus:ring-blue-500"
                        : "border-red-400 bg-red-50/50 focus:ring-red-400"
                    }`}
                  />
                  <div className="flex gap-2 pt-0.5">
                    {["0.05", "0.5", "1", "50"].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setTransferAmount(amt)}
                        className="rounded border border-slate-300 bg-white px-2.5 py-1 font-mono text-[11px] font-bold text-slate-700 hover:bg-slate-100"
                      >
                        {amt} SUI
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {sponsorAvailable && scenario.sponsorable && (
              <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4">
                <p className="font-mono text-xs font-bold uppercase tracking-wider text-blue-700">
                  ⛽ Gasless — Sponsored
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-700">
                  Enoki pays the gas from the app&apos;s sponsor pool. You still sign, and
                  AEGIS still analyzes the transaction first.
                </p>
              </div>
            )}

            <div className="mt-6 border-t border-slate-100 pt-4">
              <button
                onClick={runAegis}
                disabled={busy || (isTransfer && !isTargetValid)}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-base font-bold text-white shadow-md transition-all hover:bg-blue-700 disabled:opacity-50"
              >
                {phase === "awaiting" ? (
                  <>
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Waiting for AEGIS…
                  </>
                ) : phase === "signing" ? (
                  <>
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Signing in wallet…
                  </>
                ) : (
                  <>🔍 Analyze with AEGIS AI Agent</>
                )}
              </button>
              {buildError && (
                <p className="mt-3 text-sm font-semibold text-red-600">{buildError}</p>
              )}
            </div>
          </section>
        </div>

        {/* ── Right: integration story + outcome ── */}
        <div className="space-y-6">
          <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-slate-200">
                The entire integration
              </span>
              <span className="rounded border border-blue-800 bg-blue-950 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-blue-300">
                9 lines
              </span>
            </div>
            <pre className="overflow-x-auto px-5 py-4 font-mono text-[11.5px] leading-relaxed text-slate-300">
              <code>{INTEGRATION_SNIPPET}</code>
            </pre>
            <p className="border-t border-slate-800 px-5 py-3 text-xs leading-relaxed text-slate-400">
              No verdict UI to build, no risk rules to maintain. The extension
              renders the review, the user decides, your dApp reads one status —
              the same way a payment sheet hands back a result.
            </p>
          </section>

          {phase === "awaiting" && (
            <div className="rounded-2xl border-2 border-blue-300 bg-blue-50 p-8 text-center shadow-sm">
              <span className="mx-auto mb-3 block h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
              <h3 className="font-display text-xl font-bold text-slate-900">
                Review open in the AEGIS extension
              </h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-600">
                The popup shows what this transaction does, then streams the
                agent&apos;s simulation and verdict. Confirm or cancel there — this
                page is waiting on your decision.
              </p>
            </div>
          )}

          {phase === "idle" && !outcome && (
            <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">
              <span className="mb-3 block text-4xl">🛡️</span>
              <h3 className="mb-2 font-display text-xl font-bold text-slate-800">
                Ready for Agent Inspection
              </h3>
              <p className="mx-auto max-w-md text-base text-slate-600">
                Pick a scenario and hit{" "}
                <strong>&quot;Analyze with AEGIS AI Agent&quot;</strong>. The
                extension popup opens with the transaction details before anything
                is signed.
              </p>
            </div>
          )}

          {outcome && outcome.status === "error" && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-900 shadow-sm">
              <h3 className="mb-1 text-lg font-bold">Extension error</h3>
              <p className="text-sm">{outcome.error?.message}</p>
            </div>
          )}

          {outcome && outcome.status === "cancelled" && (
            <div className="rounded-2xl border border-slate-300 bg-white p-6 shadow-sm">
              <h3 className="mb-1 text-lg font-bold text-slate-800">Review cancelled</h3>
              <p className="text-sm text-slate-600">
                You closed the AEGIS popup before deciding. Nothing was signed.
              </p>
            </div>
          )}

          {outcome && outcome.analysis && verdict && (
            <div className={`rounded-2xl border p-6 shadow-md ${verdict.border} ${verdict.bg}`}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-full px-3 py-1 font-mono text-xs font-extrabold uppercase tracking-widest ${verdict.badge}`}
                  >
                    {verdict.title}
                  </span>
                  <span className="font-mono text-xs font-bold uppercase text-slate-500">
                    {outcome.status === "approved" ? "You confirmed" : "You rejected"}
                  </span>
                </div>
                <span
                  className={`rounded-lg border px-3 py-0.5 font-mono text-2xl font-black ${verdict.score}`}
                >
                  {outcome.analysis.riskScore} / 100
                </span>
              </div>

              <p className="text-base font-medium leading-relaxed text-slate-800">
                {outcome.analysis.explanation}
              </p>

              {outcome.analysis.riskFlags.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-black/10 pt-4">
                  {outcome.analysis.riskFlags.map((flag, i) => (
                    <span
                      key={i}
                      className="rounded-lg border border-red-200 bg-red-50 px-3 py-1 text-sm font-semibold text-red-800"
                    >
                      ⚠️ {flag}
                    </span>
                  ))}
                </div>
              )}

              {outcome.analysis.simulation?.balanceChanges?.length ? (
                <div className="mt-4 border-t border-black/10 pt-4">
                  <p className="mb-2 font-mono text-xs font-bold uppercase tracking-wider text-slate-500">
                    Balance impact
                  </p>
                  <div className="space-y-1 font-mono text-sm font-bold">
                    {outcome.analysis.simulation.balanceChanges.map((b, i) => (
                      <div
                        key={i}
                        className={Number(b.amount) >= 0 ? "text-emerald-700" : "text-red-600"}
                      >
                        {formatBalanceChange(b.amount, b.coinType)}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {outcome?.status === "approved" && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              {!scenario.executable ? (
                <p className="text-sm font-medium text-slate-500">
                  ℹ️ Approved — but this scenario uses synthetic package IDs for
                  agent risk evaluation, so there is nothing to execute on-chain.
                </p>
              ) : phase === "signing" ? (
                <p className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
                  Approved — waiting for your wallet signature…
                </p>
              ) : digest ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
                  <p className="mb-1 text-base font-bold">✅ Transaction executed</p>
                  <p className="mb-2 break-all font-mono text-xs text-slate-600">
                    Digest: {digest}
                  </p>
                  <a
                    href={`https://suiscan.xyz/${network}/tx/${digest}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block font-mono text-xs font-bold text-blue-700 underline hover:text-blue-900"
                  >
                    View on SuiScan Explorer →
                  </a>
                </div>
              ) : signError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                  <p className="mb-1 text-sm font-bold text-red-800">
                    Approved in AEGIS, but signing failed
                  </p>
                  <p className="text-sm text-red-700">{signError}</p>
                  <button
                    onClick={() => rawPtb && void execute(rawPtb, rawPtbSponsored)}
                    className="mt-3 rounded-lg bg-blue-600 px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-white hover:bg-blue-700"
                  >
                    Retry signing
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
