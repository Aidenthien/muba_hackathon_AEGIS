"use client";
import type { Transaction } from "@mysten/sui/transactions";
import { toBase64 } from "@mysten/sui/utils";
import { dAppKit } from "@/lib/dapp-kit";

/** Thrown for anything the sponsor endpoints reject, with their message intact. */
export class SponsorError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "SponsorError";
    this.code = code;
  }
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new SponsorError(
      data.error ?? "request_failed",
      data.message ?? `${url} returned ${res.status}`
    );
  }
  return data as T;
}

export interface SponsoredResult {
  /** On-chain digest of the executed transaction. */
  digest: string;
}

/**
 * Sponsors `transaction`, has the connected wallet sign it, and executes it.
 *
 * The transaction must not touch `tx.gas` — that coin belongs to the sponsor.
 * Source SUI with `coinWithBalance({ balance, useGasCoin: false })` instead.
 */
export async function signAndExecuteSponsored({
  transaction,
  sender,
  network,
}: {
  transaction: Transaction;
  sender: string;
  network: "testnet" | "devnet";
}): Promise<SponsoredResult> {
  // 1. Kind bytes: the commands with no gas data. `client` is needed so object
  //    references and coin selections resolve before serialization.
  const kindBytes = await transaction.build({
    client: dAppKit.getClient(network),
    onlyTransactionKind: true,
  });

  // 2. The sponsor attaches its own gas coin and returns the complete payload.
  const { bytes, digest } = await postJson<{ bytes: string; digest: string }>("/api/sponsor", {
    transactionKindBytes: toBase64(kindBytes),
    sender,
    network,
  });

  // 3. Sign the sponsored bytes *as a string*. Passing the base64 through
  //    untouched is what keeps the sponsor's gas data intact — rebuilding a
  //    Transaction here would let the wallet re-resolve gas and invalidate the
  //    reservation.
  const { signature } = await dAppKit.signTransaction({ transaction: bytes });

  // 4. Enoki co-signs as sponsor and submits.
  return await postJson<SponsoredResult>("/api/sponsor/execute", { digest, signature });
}
