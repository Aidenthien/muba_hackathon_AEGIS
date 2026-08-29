/**
 * Enoki sponsored transaction
 */
import { EnokiClientError } from "@mysten/enoki";
import { Transaction } from "@mysten/sui/transactions";
import { isValidSuiAddress } from "@mysten/sui/utils";
import { getEnokiServerClient, isSponsorNetwork } from "@/lib/enoki-server";

/**
 * A sponsored transaction is an open invitation to spend your gas, so cap the
 * shape of what we'll sign for. Comma-separated `pkg::module::function` entries
 * in ENOKI_SPONSOR_ALLOWED_TARGETS restrict Move calls; leaving it unset allows
 * any target, which is fine on testnet and reckless on mainnet.
 */
const ALLOWED_MOVE_CALL_TARGETS = (process.env.ENOKI_SPONSOR_ALLOWED_TARGETS ?? "")
  .split(",")
  .map((t) => t.trim())
  .filter(Boolean);

/** Comma-separated addresses the transaction may transfer to. Unset = any. */
const ALLOWED_ADDRESSES = (process.env.ENOKI_SPONSOR_ALLOWED_ADDRESSES ?? "")
  .split(",")
  .map((a) => a.trim())
  .filter(Boolean);

/** Enough for the demo's longest PTB; short enough to bound one sponsorship. */
const MAX_COMMANDS = 16;

/**
 * Rejects payloads Enoki would refuse anyway, but with an error that says why.
 * The big one is GasCoin: in a sponsored transaction the gas coin belongs to
 * the *sponsor*, so `tx.splitCoins(tx.gas, …)` silently spends our SUI instead
 * of the user's. Build with `coinWithBalance({ useGasCoin: false })` instead.
 */
function rejectionReason(kindBytes: string): string | null {
  let data: ReturnType<Transaction["getData"]>;
  try {
    data = Transaction.fromKind(kindBytes).getData();
  } catch {
    return "transactionKindBytes could not be decoded as a transaction kind.";
  }

  const commands = data.commands;
  if (commands.length === 0) return "The transaction has no commands.";
  if (commands.length > MAX_COMMANDS) {
    return `The transaction has ${commands.length} commands; the sponsor allows at most ${MAX_COMMANDS}.`;
  }

  for (const command of commands) {
    const args = Object.values(command).flatMap((v) =>
      v && typeof v === "object" ? Object.values(v).flat() : []
    );
    if (args.some((a) => a && typeof a === "object" && "$kind" in a && a.$kind === "GasCoin")) {
      return "The transaction uses the gas coin (tx.gas). In a sponsored transaction the gas coin is the sponsor's, so it can't be split or transferred — use coinWithBalance({ useGasCoin: false }) to source SUI from the sender's own coins.";
    }
    if (command.$kind === "MoveCall" && ALLOWED_MOVE_CALL_TARGETS.length > 0) {
      const { package: pkg, module, function: fn } = command.MoveCall;
      if (!ALLOWED_MOVE_CALL_TARGETS.includes(`${pkg}::${module}::${fn}`)) {
        return `Move call ${pkg}::${module}::${fn} is not in the sponsor's allowed targets.`;
      }
    }
  }
  return null;
}

/**
 * Lets the UI show a gasless toggle only when sponsorship is actually wired up,
 * instead of offering it and failing at sign time. Route handlers aren't cached
 * by default, so this reflects the running server's env on every call.
 */
export async function GET() {
  return Response.json({ enabled: getEnokiServerClient() !== null });
}

export async function POST(request: Request) {
  const enoki = getEnokiServerClient();
  if (!enoki) {
    return Response.json(
      {
        error: "sponsorship_disabled",
        message: "ENOKI_PRIVATE_KEY is not set, so transactions can't be sponsored.",
      },
      { status: 501 }
    );
  }

  let body: { transactionKindBytes?: string; sender?: string; network?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const sender = body.sender?.trim();
  if (!sender || !isValidSuiAddress(sender)) {
    return Response.json(
      { error: "invalid_sender", message: "A valid Sui sender address is required." },
      { status: 400 }
    );
  }

  const network = body.network ?? "testnet";
  if (!isSponsorNetwork(network)) {
    return Response.json(
      { error: "invalid_network", message: `Enoki cannot sponsor on ${network}.` },
      { status: 400 }
    );
  }

  const transactionKindBytes = body.transactionKindBytes;
  if (!transactionKindBytes) {
    return Response.json(
      {
        error: "missing_transaction",
        message:
          "transactionKindBytes is required — build it with tx.build({ client, onlyTransactionKind: true }).",
      },
      { status: 400 }
    );
  }

  const reason = rejectionReason(transactionKindBytes);
  if (reason) {
    return Response.json({ error: "transaction_rejected", message: reason }, { status: 400 });
  }

  try {
    const { bytes, digest } = await enoki.createSponsoredTransaction({
      network,
      transactionKindBytes,
      sender,
      ...(ALLOWED_MOVE_CALL_TARGETS.length > 0 && {
        allowedMoveCallTargets: ALLOWED_MOVE_CALL_TARGETS,
      }),
      ...(ALLOWED_ADDRESSES.length > 0 && { allowedAddresses: ALLOWED_ADDRESSES }),
    });
    return Response.json({ bytes, digest });
  } catch (e) {
    if (e instanceof EnokiClientError) {
      return Response.json(
        {
          error: "enoki_error",
          message: e.errors[0]?.message ?? e.message,
        },
        { status: e.status }
      );
    }
    return Response.json(
      {
        error: "sponsor_failed",
        message: e instanceof Error ? e.message : "Could not sponsor the transaction.",
      },
      { status: 502 }
    );
  }
}
