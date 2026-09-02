"use client";

import { useEffect, useState, useCallback } from "react";

export interface WalrusAuditItem {
  walletAddress: string;
  blobId: string;
  timestamp: string;
  operations: string[];
  protocols: string[];
  riskScore: number;
  recommendation: "approve" | "caution" | "reject";
  truthScore: number;
  summary: string;
  explorerUrl: string;
  aggregatorUrl: string;
}

interface WalrusAuditDashboardProps {
  walletAddress?: string | null;
  agentUrl?: string;
  latestBlobId?: string | null;
}

export default function WalrusAuditDashboard({
  walletAddress,
  agentUrl = process.env.NEXT_PUBLIC_AGENT_URL || "http://localhost:3001",
  latestBlobId,
}: WalrusAuditDashboardProps) {
  const [audits, setAudits] = useState<WalrusAuditItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedAudit, setSelectedAudit] = useState<WalrusAuditItem | null>(null);
  const [liveDossier, setLiveDossier] = useState<any>(null);
  const [loadingDossier, setLoadingDossier] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const activeAddress = walletAddress || "0xffae7e430e5cca75a00b23169f4a39cb43721fd1bad89fa3b3e1e01b12db2fe5";

  const fetchAudits = useCallback(async () => {
    if (!activeAddress) return;
    setLoading(true);
    try {
      const res = await fetch(`${agentUrl}/audits/${activeAddress}`);
      if (res.ok) {
        const data = await res.json();
        setAudits(data.audits || []);
      }
    } catch (err) {
      console.warn("Could not fetch audits from agent server:", err);
    } finally {
      setLoading(false);
    }
  }, [activeAddress, agentUrl]);

  useEffect(() => {
    fetchAudits();
  }, [fetchAudits, latestBlobId]);

  const inspectAudit = async (item: WalrusAuditItem) => {
    setSelectedAudit(item);
    setLoadingDossier(true);
    setLiveDossier(null);
    try {
      const res = await fetch(
        `https://aggregator.walrus-testnet.walrus.space/v1/blobs/${item.blobId}`
      );
      if (res.ok) {
        const json = await res.json();
        setLiveDossier(json);
      } else {
        setLiveDossier({ error: `Aggregator returned status ${res.status}` });
      }
    } catch (err: any) {
      setLiveDossier({ error: err.message });
    } finally {
      setLoadingDossier(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const formatShortBlob = (id: string) => {
    if (!id || id.length <= 16) return id;
    return `${id.slice(0, 8)}…${id.slice(-6)}`;
  };

  const formatTimeAgo = (iso: string) => {
    try {
      const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
      if (diff < 60) return "Just now";
      if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
      if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
      return `${Math.floor(diff / 86400)}d ago`;
    } catch {
      return "Recently";
    }
  };

  const approvedCount = audits.filter((a) => a.recommendation === "approve").length;
  const cautionCount = audits.filter((a) => a.recommendation === "caution").length;
  const rejectedCount = audits.filter((a) => a.recommendation === "reject").length;

  return (
    <div className="mt-8 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 text-slate-100 shadow-2xl">
      {/* ── Top Header ── */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-800 bg-slate-900/80 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-950/60 text-lg">
            🦭
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display text-base font-bold text-white">
                Walrus Decentralized Audit Trail
              </h3>
              <span className="rounded-full border border-cyan-400/30 bg-cyan-950/60 px-2 py-0.5 font-mono text-[10px] font-bold text-cyan-300">
                Sui Testnet
              </span>
            </div>
            <p className="font-mono text-xs text-slate-400">
              Wallet:{" "}
              <span className="text-cyan-300">
                {activeAddress.slice(0, 8)}…{activeAddress.slice(-6)}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2 sm:pt-0">
          <button
            type="button"
            onClick={fetchAudits}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 font-mono text-xs font-semibold text-slate-300 hover:border-slate-600 hover:bg-slate-700 disabled:opacity-50"
          >
            <span className={loading ? "animate-spin" : ""}>🔄</span>
            Refresh
          </button>
        </div>
      </div>

      {/* ── Summary Stats ── */}
      <div className="grid grid-cols-2 gap-4 border-b border-slate-800/80 bg-slate-900/30 px-6 py-4 md:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
          <span className="block font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Total Audits
          </span>
          <span className="font-mono text-2xl font-bold text-white">
            {audits.length}
          </span>
        </div>
        <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/20 p-3">
          <span className="block font-mono text-[11px] font-semibold uppercase tracking-wider text-emerald-400">
            Verified Safe
          </span>
          <span className="font-mono text-2xl font-bold text-emerald-300">
            {approvedCount}
          </span>
        </div>
        <div className="rounded-xl border border-amber-900/40 bg-amber-950/20 p-3">
          <span className="block font-mono text-[11px] font-semibold uppercase tracking-wider text-amber-400">
            Caution Advised
          </span>
          <span className="font-mono text-2xl font-bold text-amber-300">
            {cautionCount}
          </span>
        </div>
        <div className="rounded-xl border border-rose-900/40 bg-rose-950/20 p-3">
          <span className="block font-mono text-[11px] font-semibold uppercase tracking-wider text-rose-400">
            Threats Blocked
          </span>
          <span className="font-mono text-2xl font-bold text-rose-300">
            {rejectedCount}
          </span>
        </div>
      </div>

      {/* ── Table or Empty State ── */}
      <div className="p-6">
        {loading && audits.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-slate-400">
            <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
            Querying Walrus decentralized audit records...
          </div>
        ) : audits.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center text-slate-400">
            <p className="mb-1 text-sm font-medium">No Walrus audit records yet for this wallet.</p>
            <p className="text-xs text-slate-500">
              Run any transaction scenario in the lab above to generate an immutable Walrus dossier!
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 font-mono uppercase tracking-wider text-slate-400">
                  <th className="pb-3 pr-4">Time</th>
                  <th className="pb-3 pr-4">Scenario / Scope</th>
                  <th className="pb-3 pr-4">Verdict</th>
                  <th className="pb-3 pr-4">Gonka Truth</th>
                  <th className="pb-3 pr-4">Walrus Proof</th>
                  <th className="pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {audits.map((a, idx) => {
                  const badgeCls =
                    a.recommendation === "approve"
                      ? "border-emerald-500/30 bg-emerald-950/60 text-emerald-300"
                      : a.recommendation === "caution"
                      ? "border-amber-500/30 bg-amber-950/60 text-amber-300"
                      : "border-rose-500/30 bg-rose-950/60 text-rose-300";

                  return (
                    <tr key={idx} className="group hover:bg-slate-900/40">
                      <td className="py-3 pr-4 text-slate-400">
                        {formatTimeAgo(a.timestamp)}
                      </td>
                      <td className="py-3 pr-4">
                        <div className="font-sans font-medium text-white">
                          {a.protocols?.length > 0 ? a.protocols.join(" + ") : a.operations?.slice(0, 2).join(", ") || "Transfer"}
                        </div>
                        <div className="line-clamp-1 max-w-xs font-sans text-[11px] text-slate-500">
                          {a.summary}
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${badgeCls}`}
                        >
                          {a.recommendation}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <span className="font-bold text-cyan-300">
                          {a.truthScore}%
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <a
                          href={`https://aggregator.walrus-testnet.walrus.space/v1/blobs/${a.blobId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded border border-cyan-500/20 bg-cyan-950/40 px-2 py-0.5 text-[11px] text-cyan-300 hover:border-cyan-400 hover:bg-cyan-900/50"
                          title="View on Walrus Aggregator"
                        >
                          <span>{formatShortBlob(a.blobId)}</span>
                          <span className="text-[9px]">↗</span>
                        </a>
                      </td>
                      <td className="py-3 text-right">
                        <button
                          type="button"
                          onClick={() => inspectAudit(a)}
                          className="rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1 font-sans text-xs font-semibold text-slate-200 transition-colors hover:border-cyan-500 hover:bg-cyan-950 hover:text-cyan-200"
                        >
                          Inspect Dossier 🔍
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Slide-up Dossier Inspector Modal ── */}
      {selectedAudit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-6 py-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">🦭</span>
                <div>
                  <h4 className="font-display text-sm font-bold text-white">
                    Decentralized Audit Dossier
                  </h4>
                  <p className="font-mono text-[11px] text-cyan-400">
                    Blob: {selectedAudit.blobId}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAudit(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 space-y-4 overflow-y-auto p-6 font-sans text-sm">
              {loadingDossier ? (
                <div className="flex items-center justify-center py-12 text-slate-400">
                  <span className="mr-2 inline-block h-5 w-5 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
                  Fetching raw cryptographic blob from Walrus Testnet nodes...
                </div>
              ) : liveDossier ? (
                <>
                  {/* Consensus Summary */}
                  {liveDossier.gonkaVerification && (
                    <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/30 p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="font-mono text-xs font-bold uppercase tracking-wider text-cyan-300">
                          Gonka Multi-Model Consensus
                        </span>
                        <span className="rounded bg-cyan-500/20 px-2 py-0.5 font-mono text-xs font-bold text-cyan-200">
                          {liveDossier.gonkaVerification.consensusTruthScore}% Truth
                        </span>
                      </div>
                      <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-2">
                        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                          <span className="block font-mono text-[10px] text-slate-400">
                            Primary Model
                          </span>
                          <span className="font-semibold text-white">
                            {liveDossier.gonkaVerification.models?.primary?.model || "DeepSeek V4"}
                          </span>
                          <span className="block font-mono text-[10px] text-cyan-400">
                            ID: {liveDossier.gonkaVerification.models?.primary?.requestId?.slice(0, 15)}…
                          </span>
                        </div>
                        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                          <span className="block font-mono text-[10px] text-slate-400">
                            Secondary Model
                          </span>
                          <span className="font-semibold text-white">
                            {liveDossier.gonkaVerification.models?.secondary?.model || "MiniMax M2.7"}
                          </span>
                          <span className="block font-mono text-[10px] text-cyan-400">
                            ID: {liveDossier.gonkaVerification.models?.secondary?.requestId?.slice(0, 15)}…
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Explanation */}
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                    <h5 className="mb-1 font-mono text-xs font-bold uppercase tracking-wider text-slate-400">
                      Security Analysis Summary
                    </h5>
                    <p className="text-sm leading-relaxed text-slate-200">
                      {liveDossier.explanation}
                    </p>
                  </div>

                  {/* Raw JSON Accordion */}
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-mono text-xs font-bold uppercase tracking-wider text-slate-400">
                        Raw Walrus Decentralized Payload
                      </span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(JSON.stringify(liveDossier, null, 2), "raw")}
                        className="font-mono text-xs text-cyan-400 hover:underline"
                      >
                        {copiedId === "raw" ? "Copied! ✓" : "Copy JSON"}
                      </button>
                    </div>
                    <pre className="max-h-56 overflow-auto rounded-xl border border-slate-800 bg-black/60 p-3 font-mono text-[11px] leading-snug text-slate-300">
                      {JSON.stringify(liveDossier, null, 2)}
                    </pre>
                  </div>
                </>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-slate-800 bg-slate-950 px-6 py-3">
              <a
                href={`https://walruscan.com/testnet/blob/${selectedAudit.blobId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs text-slate-400 hover:text-white"
              >
                View Blockchain Certificate on Walruscan ↗
              </a>
              <a
                href={`https://aggregator.walrus-testnet.walrus.space/v1/blobs/${selectedAudit.blobId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-cyan-500/40 bg-cyan-950/60 px-3 py-1.5 font-mono text-xs font-bold text-cyan-300 hover:bg-cyan-900"
              >
                Open Raw Aggregator Feed ↗
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
