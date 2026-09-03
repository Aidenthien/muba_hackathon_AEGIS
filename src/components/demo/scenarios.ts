import { Transaction, coinWithBalance } from "@mysten/sui/transactions";

/**
 * Demo scenarios for the AEGIS transaction lab. The Cetus, Bucket Protocol,
 * and drain scenarios exercise protocol-lookup and risk-scoring paths on Sui Testnet.
 */

const CETUS_PACKAGE =
  "0x603912ab3714c5333b58f30523e379a87b95e975fae5e9a9c7565ed9c1b073d8";
const NAVI_PACKAGE =
  "0x603912ab3714c5333b58f30523e379a87b95e975fae5e9a9c7565ed9c1b073d8";
const BUCKET_PACKAGE =
  "0x603912ab3714c5333b58f30523e379a87b95e975fae5e9a9c7565ed9c1b073d8";
const UNKNOWN_PACKAGE =
  "0xdeadbeef00000000000000000000000000000000000000000000000000000099";

export const MIST_PER_SUI = 1_000_000_000n;
export const USDC_TESTNET_TYPE =
  "0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC";
export const BUCK_TESTNET_TYPE =
  "0xf3a4b5c6000000000000000000000000000000000000000000000000000000e5::buck::BUCK";

export interface Scenario {
  id: string;
  label: string;
  blurb: string;
  track?: string;
  /** false = multi-call or unverified scenario designed for agent risk scoring; true = baseline on-chain transfer */
  executable: boolean;
  /** Whether this scenario can run gasless (i.e. never touches `tx.gas`). */
  sponsorable: boolean;
  expected: "approve" | "caution" | "reject";
  build: (
    sender: string,
    recipient?: string,
    amountSui?: number,
    options?: { sponsored?: boolean; token?: "SUI" | "USDC" }
  ) => Transaction;
}

export function buildTransfer(
  sender: string,
  recipient: string,
  amountUnits: bigint,
  { sponsored = false, token = "SUI" }: { sponsored?: boolean; token?: "SUI" | "USDC" } = {}
): Transaction {
  const tx = new Transaction();
  tx.setSender(sender);
  const coin =
    token === "USDC"
      ? tx.add(coinWithBalance({ type: USDC_TESTNET_TYPE, balance: amountUnits, useGasCoin: false }))
      : sponsored
        ? tx.add(coinWithBalance({ balance: amountUnits, useGasCoin: false }))
        : tx.splitCoins(tx.gas, [tx.pure.u64(amountUnits)])[0];
  tx.transferObjects([coin], tx.pure.address(recipient));
  return tx;
}

export const SCENARIOS: Scenario[] = [
  {
    id: "safe-transfer",
    label: "Custom Transfer · SUI / USDC",
    blurb: "Specify target recipient & amount (SUI or USDC). Enoki pays gas; agent analyzes recipient reputation and balance impact.",
    track: "Stablecoin Payments",
    executable: true,
    sponsorable: true,
    expected: "approve",
    build: (sender, recipient, amount, options) => {
      const isUsdc = options?.token === "USDC";
      const val = amount && amount > 0 ? amount : isUsdc ? 25 : 0.05;
      const decimals = isUsdc ? 1_000_000n : 1_000_000_000n;
      const amountUnits = BigInt(Math.floor(val * Number(decimals)));
      return buildTransfer(sender, recipient || sender, amountUnits, options);
    },
  },
  {
    id: "cetus-swap",
    label: "DeFi Swap · SUI ⇄ USDC (Cetus)",
    blurb: "Swap SUI for USDC via Cetus CLMM DEX router on Sui Testnet. Recognized audited protocol (Approve).",
    track: "DEX & Stablecoins",
    executable: true,
    sponsorable: true,
    expected: "approve",
    build: (sender) => {
      const tx = new Transaction();
      tx.setSender(sender);
      const coin = tx.add(coinWithBalance({ balance: 50_000_000n, useGasCoin: false }));
      const [swapped] = tx.moveCall({
        target: `${CETUS_PACKAGE}::router::swap_exact_input`,
        arguments: [coin],
      });
      tx.transferObjects([swapped], tx.pure.address(sender));
      return tx;
    },
  },
  {
    id: "multi-protocol",
    label: "Bucket Protocol · BUCK Stablecoin Chain",
    blurb: "Multi-step CDP stablecoin minting ($BUCK) + NAVI lending + Bucket staking. Medium risk (Caution).",
    track: "CDP Stablecoins & Lending",
    executable: true,
    sponsorable: true,
    expected: "caution",
    build: (sender) => {
      const tx = new Transaction();
      tx.setSender(sender);
      const coin = tx.add(coinWithBalance({ balance: 50_000_000n, useGasCoin: false }));
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
        arguments: [tx.pure.u64(15_000_000n)],
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
    label: "Malicious Stablecoin Drain",
    blurb: "Phishing payload attempting to exfiltrate 5,000 USDC / BUCK and delete OwnerCap. High risk (Reject).",
    track: "Exploit Prevention",
    executable: false,
    sponsorable: false,
    expected: "reject",
    build: (sender) => {
      const tx = new Transaction();
      tx.setSender(sender);
      const [loot] = tx.splitCoins(tx.gas, [tx.pure.u64(50_000_000n)]);
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
  if (/usdc/i.test(coinType)) return "USDC";
  if (/buck/i.test(coinType)) return "BUCK";
  const parts = coinType.split("::");
  return parts[parts.length - 1] ?? coinType;
}

export function formatBalanceChange(amount: string, coinType: string): string {
  const value = Number(amount);
  if (isSuiCoin(coinType)) {
    const sui = value / Number(MIST_PER_SUI);
    return `${sui > 0 ? "+" : ""}${sui.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })} SUI`;
  }
  if (/usdc/i.test(coinType)) {
    const usdc = value / 1_000_000;
    return `${usdc > 0 ? "+" : ""}${usdc.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })} USDC`;
  }
  if (/buck/i.test(coinType)) {
    const buck = value / 1_000_000_000;
    return `${buck > 0 ? "+" : ""}${buck.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })} BUCK`;
  }
  return `${value > 0 ? "+" : ""}${value.toLocaleString()} ${formatCoin(coinType)}`;
}

export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

