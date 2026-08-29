import { createDAppKit } from "@mysten/dapp-kit-react";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { enokiWalletsInitializer } from "@mysten/enoki";

const GRPC_URLS: Record<string, string> = {
  testnet: "https://fullnode.testnet.sui.io:443",
  devnet: "https://fullnode.devnet.sui.io:443",
};

// Enoki turns Google Sign-In into a zkLogin wallet that shows up alongside
// browser-extension wallets in the normal connect flow. Both keys are
// public/publishable by design (Enoki's docs call for exposing them
// client-side), so it's safe for them to be NEXT_PUBLIC_.
const ENOKI_API_KEY = process.env.NEXT_PUBLIC_ENOKI_API_KEY;
const ENOKI_GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_ENOKI_GOOGLE_CLIENT_ID;

export const zkLoginEnabled = Boolean(ENOKI_API_KEY && ENOKI_GOOGLE_CLIENT_ID);

export const dAppKit = createDAppKit({
  networks: ["testnet", "devnet"],
  defaultNetwork: "testnet",
  createClient: (network) =>
    new SuiGrpcClient({ network, baseUrl: GRPC_URLS[network] }),
  walletInitializers: zkLoginEnabled
    ? [
        enokiWalletsInitializer({
          apiKey: ENOKI_API_KEY!,
          providers: {
            google: { clientId: ENOKI_GOOGLE_CLIENT_ID! },
          },
        }),
      ]
    : [],
});

declare module "@mysten/dapp-kit-react" {
  interface Register {
    dAppKit: typeof dAppKit;
  }
}
