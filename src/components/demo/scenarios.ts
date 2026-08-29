import { Transaction } from "@mysten/sui/transactions";

/**
 * Demo scenarios for the AEGIS transaction lab. The Cetus and drain
 * scenarios use the synthetic package IDs from the agent server's
 * data/protocols.json registry, so they exercise the protocol-lookup and
 * risk-scoring paths without needing real deployed contracts. Only the
 * plain transfer produces a transaction that can actually execute on-chain.
 */

const CETUS_PACKAGE =
  "0xa9556bc9000000000000000000000000000000000000000000000000000000a1";
const NAVI_PACKAGE =
  "0xc963eaed000000000000000000000000000000000000000000000000000000b2";
const BUCKET_PACKAGE =
  "0xe2f3a4b5000000000000000000000000000000000000000000000000000000d4";
const UNKNOWN_PACKAGE =
  "0xdeadbeef00000000000000000000000000000000000000000000000000000099";

export const MIST_PER_SUI = 1_000_000_000n;

export interface Scenario {
  id: string;
  label: string;
  blurb: string;
  /** false = multi-call or unverified scenario designed for agent risk scoring; true = baseline on-chain transfer */
  executable: boolean;
  expected: "approve" | "caution" | "reject";
  build: (sender: string, recipient?: string, amountSui?: number) => Transaction;
}

export function buildTransfer(
  sender: string,
  recipient: string,
  amountMist: bigint
): Transaction {
  const tx = new Transaction();
  tx.setSender(sender);
  const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(amountMist)]);
  tx.transferObjects([coin], tx.pure.address(recipient));
  return tx;
}

export const SCENARIOS: Scenario[] = [
  {
    id: "safe-transfer",
    label: "Custom SUI Transfer",
    blurb: "Specify target recipient address & SUI amount. Agent analyzes target wallet history and balance impact.",
    executable: true,
    expected: "approve",
    build: (sender, recipient, amountSui) => {
      const sui = amountSui && amountSui > 0 ? amountSui : 0.05;
      const amountMist = BigInt(Math.floor(sui * 1_000_000_000));
      return buildTransfer(sender, recipient || sender, amountMist);
    },
  },
  {
    id: "cetus-swap",
    label: "DeFi Swap · Cetus",
    blurb: "Swap SUI via Cetus router. Recognized audited protocol (Approve).",
    executable: false,
    expected: "approve",
    build: (sender) => {
      const tx = new Transaction();
      tx.setSender(sender);
      const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(MIST_PER_SUI)]);
      tx.moveCall({
        target: `${CETUS_PACKAGE}::router::swap_exact_input`,
        arguments: [coin],
      });
      return tx;
    },
  },
  {
    id: "multi-protocol",
    label: "Complex DeFi Chain",
    blurb: "Multi-step swap + lending + farming across Cetus, NAVI, and Bucket. Medium risk (Caution).",
    executable: false,
    expected: "caution",
    build: (sender) => {
      const tx = new Transaction();
      tx.setSender(sender);
      const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(10_000_000_000n)]);
      const [swapped] = tx.moveCall({
        target: `${CETUS_PACKAGE}::pool::swap_exact_input`,
        arguments: [coin],
      });
      tx.moveCall({
        target: `${NAVI_PACKAGE}::lending::deposit_collateral`,
        arguments: [swapped],
      });
      const [borrowed] = tx.moveCall({
        target: `${NAVI_PACKAGE}::lending::borrow`,
        arguments: [tx.pure.u64(3_000_000_000n)],
      });
      tx.moveCall({
        target: `${BUCKET_PACKAGE}::farm::stake`,
        arguments: [borrowed],
      });
      return tx;
    },
  },
  {
    id: "wallet-drain",
    label: "Suspicious Drain",
    blurb: "Unverified contract call + object transfer + cap deletion shape. High risk (Reject).",
    executable: false,
    expected: "reject",
    build: (sender) => {
      const tx = new Transaction();
      tx.setSender(sender);
      const [loot] = tx.splitCoins(tx.gas, [tx.pure.u64(60n * MIST_PER_SUI)]);
      tx.moveCall({
        target: `${UNKNOWN_PACKAGE}::rewards::claim_airdrop`,
        arguments: [],
      });
      tx.transferObjects(
        [loot],
        tx.pure.address(
          "0x6660000000000000000000000000000000000000000000000000000000000666"
        )
      );
      tx.moveCall({
        target: `${UNKNOWN_PACKAGE}::vault::delete_owner_cap`,
        arguments: [
          tx.object(
            "0xabc4560000000000000000000000000000000000000000000000000000000022"
          ),
        ],
      });
      return tx;
    },
  },
];

// The agent's response shape is owned by the SDK (it's the extension's
// contract, not the demo's). Re-exported here so existing imports keep working.
export type {
  AgentProtocol,
  AgentSimulation,
  SimilarPattern,
  AgentAnalysis,
} from "@/lib/aegis-sdk";

export function isSuiCoin(coinType: string): boolean {
  return /^0x0*2::sui::SUI$/i.test(coinType) || coinType === "SUI";
}

export function formatCoin(coinType: string): string {
  if (isSuiCoin(coinType)) return "SUI";
  const parts = coinType.split("::");
  return parts[parts.length - 1] ?? coinType;
}

export function formatBalanceChange(amount: string, coinType: string): string {
  const value = Number(amount);
  if (isSuiCoin(coinType)) {
    const sui = value / Number(MIST_PER_SUI);
    return `${sui > 0 ? "+" : ""}${sui.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })} SUI`;
  }
  return `${value > 0 ? "+" : ""}${value.toLocaleString()} ${formatCoin(coinType)}`;
}

export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

