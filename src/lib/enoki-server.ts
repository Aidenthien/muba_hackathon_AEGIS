import { EnokiClient } from "@mysten/enoki";

/** Networks Enoki can sponsor on. Must also be enabled in the Enoki Portal. */
export const SPONSOR_NETWORKS = ["testnet", "devnet", "mainnet"] as const;
export type SponsorNetwork = (typeof SPONSOR_NETWORKS)[number];

export function isSponsorNetwork(value: unknown): value is SponsorNetwork {
  return SPONSOR_NETWORKS.includes(value as SponsorNetwork);
}

let cached: EnokiClient | null = null;

/**
 * Returns null when the private key isn't configured, so routes can answer with
 * a clean "sponsorship is off" instead of throwing at import time and taking
 * the whole route down.
 */
export function getEnokiServerClient(): EnokiClient | null {
  const apiKey = process.env.ENOKI_PRIVATE_KEY;
  if (!apiKey) return null;
  cached ??= new EnokiClient({ apiKey });
  return cached;
}
