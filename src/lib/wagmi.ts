import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import {
  phantomWallet,
  metaMaskWallet,
  coinbaseWallet,
  rainbowWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { monadTestnet, monadMainnet } from "./chains";

export const wagmiConfig = getDefaultConfig({
  appName: "Agent Battle Arena",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "demo",
  chains: [monadTestnet, monadMainnet],
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
