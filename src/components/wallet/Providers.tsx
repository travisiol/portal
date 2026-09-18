"use client";

import { darkTheme, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { HOME_CHAIN } from "@/config/chains";
import { useBridgeStore } from "@/lib/store/bridge";
import { usePortalStore } from "@/lib/store/portal";
import { useModeStore } from "@/lib/store/mode";
import { usePassportStore } from "@/lib/store/passport";
import { toViemChain } from "@/lib/wallet/chains";
import { wagmiConfig } from "@/lib/wallet/wagmi";

const theme = darkTheme({
  accentColor: "#70E7FF",
  accentColorForeground: "#04161A",
  borderRadius: "medium",
  fontStack: "system",
  overlayBlur: "none",
});
theme.colors.modalBackground = "#0A0C0F";
theme.colors.modalBorder = "#14171B";
theme.colors.profileForeground = "#0A0C0F";
theme.colors.connectButtonBackground = "#14171B";
theme.colors.closeButtonBackground = "#14171B";
theme.colors.actionButtonBorder = "#1C2025";
theme.colors.generalBorder = "#14171B";
theme.colors.modalText = "#F3F5F7";
theme.colors.modalTextSecondary = "#7B838D";
theme.fonts.body = "var(--font-geist-sans), system-ui, sans-serif";
theme.shadows.dialog = "0 32px 80px rgba(0,0,0,0.7)";

const home = toViemChain(HOME_CHAIN);

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 10_000, retry: 1, refetchOnWindowFocus: false } } }));

  // Persisted stores hydrate after mount so server and client markup match.
  useEffect(() => {
    void useModeStore.persist.rehydrate();
    void useBridgeStore.persist.rehydrate();
    void usePassportStore.persist.rehydrate();
    if (process.env.NODE_ENV !== "production") {
      // Dev-only handle for automated checks (scripts/capture.mjs, browser tooling).
      (window as unknown as { __portal?: unknown }).__portal = { portal: usePortalStore, bridge: useBridgeStore, mode: useModeStore, passport: usePassportStore };
    }
  }, []);

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={theme} initialChain={home} modalSize="compact" locale="en-US">
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
