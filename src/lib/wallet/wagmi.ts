import { connectorsForWallets, getDefaultConfig } from "@rainbow-me/rainbowkit";
import { injectedWallet } from "@rainbow-me/rainbowkit/wallets";
import { createConfig, http, type Config } from "wagmi";
import { site } from "@/config/site";
import { WALLETCONNECT_PROJECT_ID } from "@/lib/env";
import { VIEM_CHAINS } from "./chains";

const transports = Object.fromEntries(VIEM_CHAINS.map((c) => [c.id, http(c.rpcUrls.default.http[0])]));

/**
 * With a WalletConnect project id: RainbowKit's full wallet list. Without one:
 * injected wallets only, so PORTAL works out of the box instead of throwing.
 */
export const wagmiConfig: Config = WALLETCONNECT_PROJECT_ID
  ? getDefaultConfig({
      appName: site.name,
      appDescription: site.description,
      appUrl: site.url,
      projectId: WALLETCONNECT_PROJECT_ID,
      chains: VIEM_CHAINS,
      transports,
      ssr: true,
    })
  : createConfig({
      chains: VIEM_CHAINS,
      connectors: connectorsForWallets([{ groupName: "Browser wallets", wallets: [injectedWallet] }], { appName: site.name, projectId: "injected-only" }),
      transports,
      ssr: true,
    });

export const hasWalletConnect = Boolean(WALLETCONNECT_PROJECT_ID);
