/**
 * AEGIS client SDK — the dApp-facing half of the browser extension.
 *
 * Integration is deliberately Stripe-shaped: import one object, call one
 * method, branch on the result.
 *
 *   const result = await aegis.analyze({ transaction, sender, network });
 *   if (result.status === "not_installed") return showInstallPrompt();
 *   if (result.status === "approved") await wallet.signAndExecute(tx);
 *
 * `analyze()` never throws — every outcome, including "the extension isn't
 * installed" and "the extension errored", comes back as a status.
 */

// ── Agent response shapes (the AEGIS agent server's contract) ────────

export interface AgentProtocol {
  packageId: string;
  name: string;
  category: string;
  audited: boolean;
  risk: string;
}

export interface AgentSimulation {
  status: string;
  balanceChanges: { coinType: string; amount: string }[];
  objectChanges: string[];
  gasUsed: { computationCost: string; storageCost: string };
  events: string[];
}

export interface SimilarPattern {
  description: string;
  category: string;
  riskLevel: string;
  similarity: number;
}

export interface AgentAnalysis {
  explanation: string;
  riskScore: number;
  riskFlags: string[];
  recommendation: "approve" | "caution" | "reject";
  operations: string[];
  protocols: AgentProtocol[];
  simulation: AgentSimulation | null;
  plannedSteps?: string[];
  planReasoning?: string;
  planSource?: string;
  similarPatterns?: SimilarPattern[];
  gonkaVerification?: any;
  walrusBlobId?: string;
  walrusUrl?: string;
}

// ── SDK surface ──────────────────────────────────────────────────────

export type AegisStatus =
  /** User confirmed in the extension — the dApp may proceed to signing. */
  | "approved"
  /** User explicitly rejected the transaction. */
  | "rejected"
  /** User closed the popup without deciding. */
  | "cancelled"
  /** No AEGIS extension detected in this browser. */
  | "not_installed"
  /** The extension was reached but could not complete the request. */
  | "error";

export interface AegisAnalyzeParams {
  /** The JSON string from `tx.toJSON()`. */
  transaction: string;
  /** Sui address that will sign, used as the simulation's sender. */
  sender: string;
  /** Defaults to "testnet". */
  network?: string;
  /** Optional human label shown in the popup, e.g. "Swap 1 SUI on Cetus". */
  label?: string;
}

export interface AegisResult {
  status: AegisStatus;
  analysis: AgentAnalysis | null;
  requestId?: string;
  error?: { code: string; message: string };
}

interface AegisProvider {
  isAegis: true;
  version: string;
  rdns: string;
  analyze(params: AegisAnalyzeParams): Promise<{
    status: "approved" | "rejected" | "cancelled";
    analysis: AgentAnalysis | null;
    requestId: string;
  }>;
  ping(): Promise<{ ok: boolean; version: string }>;
}

declare global {
  interface Window {
    aegis?: AegisProvider;
  }
}

/** How long to wait for the content script to inject the provider. */
const DETECT_TIMEOUT_MS = 1000;

function currentProvider(): AegisProvider | null {
  if (typeof window === "undefined") return null;
  return window.aegis?.isAegis ? window.aegis : null;
}

/**
 * Resolves the injected provider, waiting briefly for it. The content script
 * runs at document_start so it is normally present already, but a cold
 * extension start-up can land just after the app hydrates.
 */
export function detectAegis(timeoutMs = DETECT_TIMEOUT_MS): Promise<AegisProvider | null> {
  const existing = currentProvider();
  if (existing) return Promise.resolve(existing);
  if (typeof window === "undefined") return Promise.resolve(null);

  return new Promise((resolve) => {
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      window.removeEventListener("aegis#initialized", finish);
      clearTimeout(timer);
      resolve(currentProvider());
    };

    const timer = setTimeout(finish, timeoutMs);
    window.addEventListener("aegis#initialized", finish, { once: true });
  });
}

/** Synchronous check — use `detectAegis()` before the first render instead. */
export function isAegisInstalled(): boolean {
  return currentProvider() !== null;
}

async function analyze(params: AegisAnalyzeParams): Promise<AegisResult> {
  const provider = await detectAegis();
  if (!provider) {
    return { status: "not_installed", analysis: null };
  }

  try {
    const result = await provider.analyze(params);
    return {
      status: result.status,
      analysis: result.analysis,
      requestId: result.requestId,
    };
  } catch (e) {
    const err = e as { code?: string; message?: string };
    return {
      status: "error",
      analysis: null,
      error: {
        code: err?.code ?? "UNKNOWN",
        message: err?.message ?? "The AEGIS extension could not complete the request.",
      },
    };
  }
}

export const aegis = {
  analyze,
  detect: detectAegis,
  isInstalled: isAegisInstalled,
  get version(): string | null {
    return currentProvider()?.version ?? null;
  },
};
