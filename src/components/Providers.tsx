"use client";

import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { wagmiConfig } from "@/lib/wagmi";
import "@rainbow-me/rainbowkit/styles.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,          // treat data as fresh for 30s — prevents refetch spam
      refetchOnWindowFocus: false, // don't blast RPC on every tab switch
      refetchInterval: false,      // no background polling
      retry: 1,
    },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: "#836EF9",
            accentColorForeground: "white",
            borderRadius: "medium",
            fontStack: "system",
          })}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
