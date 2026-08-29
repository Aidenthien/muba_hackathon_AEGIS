"use client";

import { useEffect, useRef, useState } from "react";
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
import { SponsorError, signAndExecuteSponsored } from "@/lib/sponsor";
import { aegis, type AegisResult } from "@/lib/aegis-sdk";
import InstallPrompt from "@/components/aegis/InstallPrompt";
import { MIST_PER_SUI, SCENARIOS, formatBalanceChange, shortAddress } from "./scenarios";

/**
 * Wallet extensions (Slush included) often throw errors with an empty or
 * useless message ("[object Error]") when the popup is rejected or closed,
 * so translate those into something actionable.
 */
function describeSignError(e: unknown): string {
  const msg = (e instanceof Error ? e.message : String(e)).trim();
  if (!msg || /^\[object (Error|Object)\]$/.test(msg)) {
    return "The wallet returned no details — the request was likely rejected or the popup was closed. Make sure your wallet is on testnet, then try again and approve the popup.";
  }
  if (/reject|denied|dismiss|cancel/i.test(msg)) {
    return "Request rejected in the wallet. Try again and approve the popup to execute the transaction.";
  }
  return msg;
}

const VERDICT_STYLE = {
  approve: { badge: "border-aqua/50 text-aqua", bar: "from-sui to-aqua", label: "Approve" },
  caution: {
    badge: "border-yellow-400/50 text-yellow-300",
    bar: "from-yellow-500 to-yellow-300",
    label: "Caution",
  },
  reject: { badge: "border-danger/60 text-danger", bar: "from-danger to-red-400", label: "Reject" },
} as const;

/** Below this a wallet can't cover a demo transfer + gas, so we top it up. */
const FUND_THRESHOLD_MIST = 100_000_000n; // 0.1 SUI

/**
 * Always renders 4 decimals so the balance doesn't jump between "1" and
 * "0.9977" as gas is spent — a fixed width reads as a number you can compare
 * against the previous one.
 */
function formatSui(mist: bigint): string {
  return (Number(mist) / Number(MIST_PER_SUI)).toLocaleString(undefined, {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  });
}

/** What the page is doing. The verdict itself is rendered by the extension. */
type Phase = "idle" | "awaiting" | "signing" | "settled";

export default function TransactionLab() {
  const account = useCurrentAccount();
  const client = useCurrentClient();
  const network = useCurrentNetwork();
  const dAppKit = useDAppKit();

  const [selected, setSelected] = useState<string>(SCENARIOS[0].id);
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("0.05");
  // Every transaction goes through the Enoki sponsor (src/lib/sponsor.ts) so
  // the user never pays gas. Falls back to wallet-paid gas only when the
  // server has no sponsor key, which keeps the demo working unconfigured.
  const [sponsorAvailable, setSponsorAvailable] = useState(false);

  const [phase, setPhase] = useState<Phase>("idle");
  const [outcome, setOutcome] = useState<AegisResult | null>(null);
  const [rawPtb, setRawPtb] = useState<string | null>(null);
  // How rawPtb was built — a sponsored payload has to be retried through the
  // sponsor, not the wallet's own gas.
  const [rawPtbSponsored, setRawPtbSponsored] = useState(false);
  const [buildError, setBuildError] = useState<string | null>(null);
  const [signError, setSignError] = useState<string | null>(null);
  const [digest, setDigest] = useState<string | null>(null);
  const [showInstall, setShowInstall] = useState(false);
  const [extensionVersion, setExtensionVersion] = useState<string | null>(null);
  const [extensionChecked, setExtensionChecked] = useState(false);

  // ── Balance + faucet top-up ──────────────────────────────────────
  // Top-ups are a silent background convenience with no button behind them, so
  // failures (rate limits especially) never surface in the UI — the balance
  // display is the whole story the user needs.
  const [balance, setBalance] = useState<bigint | null>(null);
  const [funding, setFunding] = useState(false);
  const [fundNotice, setFundNotice] = useState<string | null>(null);
  // Addresses we've already auto-funded this session, so a low balance
  // (e.g. faucet still settling) doesn't trigger repeated auto-requests.
  const autoFundedRef = useRef<Set<string>>(new Set());

  // Testnet/devnet have faucets; mainnet doesn't. zkLogin vs extension makes no
  // difference — both are plain Sui addresses the faucet funds identically.
  const faucetAvailable = network === "testnet" || network === "devnet";

  const scenario = SCENARIOS.find((s) => s.id === selected) ?? SCENARIOS[0];
  const isTransfer = selected === "safe-transfer";
  const busy = phase === "awaiting" || phase === "signing";

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
      .catch(() => {}); // no sponsor endpoint = wallet pays its own gas, nothing to say
    return () => {
      cancelled = true;
    };
  }, []);

  async function refreshBalance(): Promise<bigint | null> {
    if (!account) return null;
    try {
      const { balance: b } = await client.core.getBalance({ owner: account.address });
      const mist = BigInt(b.balance);
      setBalance(mist);
      return mist;
    } catch {
      return null; // non-fatal; leave the balance display as "unknown"
    }
  }

  async function fund() {
    if (!account || funding) return;
    setFunding(true);
    setFundNotice(null);
    try {
      const res = await fetch("/api/faucet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: account.address, network }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message ?? data.error ?? `Faucet returned ${res.status}`);
      }
      setFundNotice("Requested testnet SUI — balance will update in a few seconds.");
      // The drip settles asynchronously; poll a few times so the UI catches up.
      for (let i = 0; i < 5; i++) {
        await new Promise((r) => setTimeout(r, 1500));
        const mist = await refreshBalance();
        if (mist !== null && mist >= FUND_THRESHOLD_MIST) break;
      }
    } catch {
      // Swallowed on purpose. A rate limit or a dead faucet is not the user's
      // problem here — they can still analyze, and can fund the wallet
      // themselves if a signable scenario later runs out of gas.
    } finally {
      setFunding(false);
    }
  }

  // On connect (and network change) read the balance, and auto-top-up once if
  // it's too low to cover a demo transfer + gas.
  useEffect(() => {
    if (!account) return;
    const addr = account.address;
    let cancelled = false;
    (async () => {
      setFundNotice(null);
      const mist = await refreshBalance();
      if (cancelled || mist === null) return;
      if (mist < FUND_THRESHOLD_MIST && faucetAvailable && !autoFundedRef.current.has(addr)) {
        autoFundedRef.current.add(addr);
        void fund();
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
              sender: account!.address,
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
      // Sponsor rejections already carry a precise, actionable message —
      // don't launder them through the wallet-error translator.
      setSignError(e instanceof SponsorError ? e.message : describeSignError(e));
    } finally {
      setPhase("settled");
    }
  }

  /** The whole integration: build the PTB, hand it to AEGIS, act on the status. */
  async function runAegis() {
    if (!account) return;
    reset();

    // Captured once: the payload AEGIS analyzes has to be the one we execute,
    // so a late /api/sponsor probe must not change how it's submitted.
    const sponsoredRun = sponsorAvailable && scenario.sponsorable;

    let payload: string;
    try {
      if (isTransfer) {
        const to = recipient.trim();
        if (to && !isValidSuiAddress(to)) {
          throw new Error("Enter a valid Sui recipient address (0x…, 64 hex chars).");
        }
        const sui = Number(amount);
        if (!Number.isFinite(sui) || sui <= 0) {
          throw new Error("Enter a positive SUI amount.");
        }
        payload = await scenario
          .build(account.address, to || account.address, sui, { sponsored: sponsoredRun })
          .toJSON();
      } else {
        payload = await scenario.build(account.address).toJSON();
      }
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

  // ── Step 1: connect ────────────────────────────────────────────
  if (!account) {
    return (
      <div className="glass mx-auto max-w-xl rounded-2xl p-10 text-center">
        <p className="kicker mb-4">Step 1 — Connect</p>
        <h2 className="mb-3 font-display text-2xl">Connect a Sui wallet</h2>
        <p className="mb-8 text-sm leading-relaxed text-mist">
          AEGIS analyzes transactions before you sign them. Connect Slush (or any
          Sui wallet){zkLoginEnabled ? ", or sign in with Google," : ""} on{" "}
          <span className="text-aqua">testnet</span> to try it live.
        </p>
        <div className="flex justify-center">
          <ConnectButton />
        </div>
      </div>
    );
  }

  const analysis = outcome?.analysis ?? null;
  const verdict = analysis ? VERDICT_STYLE[analysis.recommendation] : null;

  return (
    <>
      {showInstall && (
        <InstallPrompt
          theme="dark"
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

      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* ── Left column: wallet + scenario picker ── */}
        <div className="space-y-6">
          {/* relative z-30: .glass uses backdrop-filter, so each panel is its own
              stacking context. Without this, the ConnectButton's "Connected
              accounts" dropdown is painted over by the later Step 2 panel. */}
          <section className="glass relative z-30 rounded-2xl p-6">
            <p className="kicker mb-3">Wallet</p>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-mono text-sm text-white">{shortAddress(account.address)}</p>
                <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.2em] text-mist">
                  {network}
                </p>
              </div>
              <ConnectButton />
            </div>

            {/* Top-ups happen automatically on connect when the balance is too
                low to cover a demo transfer + gas — there's no manual button. */}
            <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-mist">
                Balance
              </p>
              <p className="font-mono text-sm text-white">
                {funding
                  ? "funding…"
                  : balance === null
                    ? "…"
                    : `${formatSui(balance)} SUI`}
              </p>
            </div>
            {fundNotice && (
              <p className="mt-3 font-mono text-[11px] leading-relaxed text-aqua">{fundNotice}</p>
            )}

            <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-mist">
                AEGIS extension
              </p>
              {!extensionChecked ? (
                <span className="font-mono text-[11px] text-mist">checking…</span>
              ) : extensionVersion ? (
                <span className="flex items-center gap-2 rounded-full border border-aqua/40 bg-sui/10 px-3 py-1 font-mono text-[11px] text-aqua">
                  <span className="h-1.5 w-1.5 rounded-full bg-aqua" />
                  Armed · v{extensionVersion}
                </span>
              ) : (
                <button
                  onClick={() => setShowInstall(true)}
                  className="rounded-full border border-danger/50 px-3 py-1 font-mono text-[11px] text-danger transition-colors hover:border-danger hover:text-white"
                >
                  Not installed — install
                </button>
              )}
            </div>
          </section>

          <section className="glass rounded-2xl p-6">
            <p className="kicker mb-4">Step 2 — Pick a transaction</p>
            <div className="space-y-3">
              {SCENARIOS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => selectScenario(s.id)}
                  disabled={busy}
                  className={`block w-full rounded-xl border px-4 py-3 text-left transition-colors disabled:opacity-60 ${
                    selected === s.id
                      ? "border-sui/70 bg-sui/10"
                      : "border-line hover:border-sui/40"
                  }`}
                >
                  <span className="flex items-center justify-between">
                    <span className="font-grotesk text-sm font-medium text-white">{s.label}</span>
                    <span
                      className={`font-mono text-[10px] uppercase tracking-[0.2em] ${
                        s.expected === "reject" ? "text-danger" : "text-mist"
                      }`}
                    >
                      {s.executable ? "signable" : "analysis only"}
                    </span>
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-mist">{s.blurb}</span>
                </button>
              ))}

              {isTransfer && (
                <div className="space-y-3 rounded-xl border border-line p-4">
                  <label className="block">
                    <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-mist">
                      Recipient
                    </span>
                    <input
                      value={recipient}
                      onChange={(e) => setRecipient(e.target.value)}
                      placeholder="0x… (leave empty to send to self)"
                      className="mt-1 w-full rounded-lg border border-line bg-ink/60 px-3 py-2 font-mono text-xs text-white outline-none focus:border-sui/60"
                    />
                  </label>
                  <label className="block">
                    <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-mist">
                      Amount (SUI)
                    </span>
                    <input
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      inputMode="decimal"
                      className="mt-1 w-full rounded-lg border border-line bg-ink/60 px-3 py-2 font-mono text-xs text-white outline-none focus:border-sui/60"
                    />
                  </label>
                </div>
              )}

              {/* Not a choice — sponsorship is always on when the server holds a
                  key and the scenario avoids tx.gas (see Scenario.sponsorable).
                  Stated rather than offered, so the missing gas cost isn't a
                  surprise when the balance barely moves. */}
              {sponsorAvailable && scenario.sponsorable && (
                <p className="rounded-xl border border-sui/30 bg-sui/5 p-4 text-[11px] leading-relaxed text-mist">
                  <span className="font-mono uppercase tracking-[0.2em] text-aqua">Gasless</span>
                  {" — Enoki pays the gas from the app's sponsor pool. You still sign, and"}
                  {" AEGIS still analyzes the transaction first."}
                </p>
              )}
            </div>

            <button
              onClick={runAegis}
              disabled={busy}
              className="mt-5 w-full rounded-full border border-sui/50 px-5 py-3 font-mono text-xs uppercase tracking-[0.25em] text-white transition-all hover:border-aqua hover:shadow-[0_0_24px_rgba(77,162,255,0.35)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {phase === "awaiting"
                ? "Waiting for AEGIS…"
                : phase === "signing"
                  ? "Waiting for wallet…"
                  : "Analyze with AEGIS"}
            </button>
            {buildError && (
              <p className="mt-3 text-xs leading-relaxed text-danger">{buildError}</p>
            )}
          </section>
        </div>

        {/* ── Right column: what the extension handed back ── */}
        <section className="glass rounded-2xl p-6">
          <p className="kicker mb-4">Step 3 — The verdict</p>

          {phase === "idle" && !outcome && (
            <div className="flex h-64 items-center justify-center text-center">
              <p className="max-w-xs text-sm leading-relaxed text-mist">
                Pick a transaction and run the analysis. The AEGIS extension opens
                a review popup, parses the PTB, simulates it, and scores the risk —
                before anything touches the chain.
              </p>
            </div>
          )}

          {phase === "awaiting" && (
            <div className="flex h-64 flex-col items-center justify-center gap-4 text-center">
              <span className="h-2 w-2 animate-ping-soft rounded-full bg-aqua" />
              <p className="font-mono text-xs uppercase tracking-[0.25em] text-mist">
                review open in the extension
              </p>
              <p className="max-w-xs text-xs leading-relaxed text-mist/80">
                Confirm or cancel in the AEGIS popup. This page is waiting on your
                decision.
              </p>
            </div>
          )}

          {outcome?.status === "error" && (
            <div className="rounded-xl border border-danger/40 bg-danger/10 p-4">
              <p className="kicker kicker-danger mb-2">Extension error</p>
              <p className="text-sm leading-relaxed text-white/90">{outcome.error?.message}</p>
            </div>
          )}

          {outcome?.status === "cancelled" && (
            <div className="rounded-xl border border-line bg-ink/40 p-4">
              <p className="kicker mb-2">Review cancelled</p>
              <p className="text-sm leading-relaxed text-mist">
                You closed the AEGIS popup before deciding. Nothing was signed.
              </p>
            </div>
          )}

          {analysis && verdict && (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="mb-2 flex items-baseline justify-between">
                    <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-mist">
                      Risk score
                    </span>
                    <span className="font-display text-2xl text-white">
                      {analysis.riskScore}
                      <span className="text-sm text-mist">/100</span>
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-panel">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${verdict.bar} transition-all duration-700`}
                      style={{ width: `${Math.max(analysis.riskScore, 3)}%` }}
                    />
                  </div>
                </div>
                <span
                  className={`rounded-full border px-4 py-2 font-mono text-xs uppercase tracking-[0.25em] ${verdict.badge}`}
                >
                  {verdict.label}
                </span>
              </div>

              <div className="rounded-xl border border-line bg-ink/40 p-4">
                <p className="kicker mb-2">
                  {outcome?.status === "approved" ? "You confirmed" : "You rejected"}
                </p>
                <p className="text-sm leading-relaxed text-white/90">{analysis.explanation}</p>
              </div>

              {analysis.riskFlags.length > 0 && (
                <div>
                  <p className="kicker kicker-danger mb-2">Risk flags</p>
                  <ul className="space-y-1.5">
                    {analysis.riskFlags.map((flag) => (
                      <li key={flag} className="flex items-start gap-2 text-xs text-mist">
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-danger" />
                        {flag}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {analysis.simulation && analysis.simulation.balanceChanges.length > 0 && (
                <div>
                  <p className="kicker mb-2">
                    {analysis.simulation.status === "estimated"
                      ? "Estimated balance changes"
                      : "Simulated balance changes"}
                  </p>
                  <ul className="space-y-1">
                    {analysis.simulation.balanceChanges.map((b, i) => (
                      <li
                        key={`${b.coinType}-${i}`}
                        className={`font-mono text-xs ${
                          Number(b.amount) < 0 ? "text-danger" : "text-aqua"
                        }`}
                      >
                        {formatBalanceChange(b.amount, b.coinType)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {outcome?.status === "approved" && (
                <div className="border-t border-line pt-5">
                  <p className="kicker mb-3">Step 4 — Execution</p>
                  {!scenario.executable ? (
                    <p className="text-[11px] leading-relaxed text-mist">
                      Approved — but this scenario uses a synthetic package ID so
                      the agent&apos;s registry lookup can be demonstrated. There is
                      nothing to execute on a real network.
                    </p>
                  ) : phase === "signing" ? (
                    <p className="font-mono text-xs uppercase tracking-[0.2em] text-aqua">
                      Waiting for wallet signature…
                    </p>
                  ) : digest ? (
                    <div className="rounded-xl border border-aqua/40 bg-sui/10 p-4">
                      <p className="mb-1 font-mono text-xs uppercase tracking-[0.2em] text-aqua">
                        Executed on {network}
                      </p>
                      <a
                        href={`https://suiscan.xyz/${network}/tx/${digest}`}
                        target="_blank"
                        rel="noreferrer"
                        className="break-all font-mono text-xs text-white underline decoration-sui/50 hover:text-aqua"
                      >
                        {digest}
                      </a>
                    </div>
                  ) : signError ? (
                    <>
                      <p className="text-xs leading-relaxed text-danger">{signError}</p>
                      <button
                        onClick={() => rawPtb && void execute(rawPtb, rawPtbSponsored)}
                        className="mt-3 rounded-full border border-sui/50 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-white transition-colors hover:border-aqua"
                      >
                        Retry signing
                      </button>
                    </>
                  ) : null}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
