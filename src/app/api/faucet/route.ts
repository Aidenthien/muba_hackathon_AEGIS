/**
 * Testnet/devnet faucet proxy. Runs server-side so the browser never calls the
 * Sui faucet directly (avoids CORS) and we can translate its rate-limit errors
 * into clean JSON. There is no faucet on mainnet — this only serves the two
 * networks the dApp is configured for (see src/lib/dapp-kit.ts).
 *
 * A faucet drip funds any Sui address the same way, so this works identically
 * for zkLogin (Enoki) wallets and browser-extension wallets.
 */
import {
  FaucetRateLimitError,
  getFaucetHost,
  requestSuiFromFaucetV2,
} from "@mysten/sui/faucet";
import { isValidSuiAddress } from "@mysten/sui/utils";

const FAUCET_NETWORKS = new Set(["testnet", "devnet", "localnet"]);

export async function POST(request: Request) {
  let body: { address?: string; network?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const address = body.address?.trim();
  if (!address || !isValidSuiAddress(address)) {
    return Response.json(
      { error: "invalid_address", message: "A valid Sui address is required." },
      { status: 400 }
    );
  }

  const network = body.network ?? "testnet";
  if (!FAUCET_NETWORKS.has(network)) {
    return Response.json(
      {
        error: "no_faucet",
        message: `No faucet exists for ${network}. Switch to testnet or devnet, or fund the wallet manually.`,
      },
      { status: 400 }
    );
  }

  try {
    await requestSuiFromFaucetV2({
      host: getFaucetHost(network as "testnet" | "devnet" | "localnet"),
      recipient: address,
    });
    return Response.json({ ok: true, network });
  } catch (e) {
    if (e instanceof FaucetRateLimitError) {
      return Response.json(
        {
          error: "rate_limited",
          message:
            "The faucet is rate-limiting this address or IP. Wait a minute and try again, or fund the wallet manually.",
        },
        { status: 429 }
      );
    }
    return Response.json(
      {
        error: "faucet_failed",
        message: e instanceof Error ? e.message : "The faucet request failed.",
      },
      { status: 502 }
    );
  }
}
