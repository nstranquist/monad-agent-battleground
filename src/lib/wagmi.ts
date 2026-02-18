import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import {
  phantomWallet,
  metaMaskWallet,
  coinbaseWallet,
  rainbowWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { http, fallback } from "viem";
import { monadTestnet, monadMainnet } from "./chains";

const drpcAuthUrl =
  "https://lb.drpc.live/monad-testnet/AmbwnCrPI0c2nb3_DZivVy6GqQ7XDGUR8bLFcs5opQTS";
const drpcPublicUrl = "https://monad-testnet.drpc.org";
const ankrUrl = "https://rpc.ankr.com/monad_testnet";

export const wagmiConfig = getDefaultConfig({
  appName: "Agent Battle Arena",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "demo",
  chains: [monadTestnet, monadMainnet],
  transports: {
    [monadTestnet.id]: fallback([
      http(drpcAuthUrl, { retryCount: 3, retryDelay: 500 }),
      http(drpcPublicUrl, { retryCount: 2, retryDelay: 500 }),
      http(ankrUrl, { retryCount: 2, retryDelay: 500 }),
    ]),
    [monadMainnet.id]: http("https://rpc.monad.xyz", {
      retryCount: 3,
      retryDelay: 500,
    }),
  },
  wallets: [
    {
      groupName: "Recommended",
      wallets: [phantomWallet, metaMaskWallet],
    },
    {
      groupName: "More",
      wallets: [coinbaseWallet, rainbowWallet],
    },
  ],
  ssr: true,
});
