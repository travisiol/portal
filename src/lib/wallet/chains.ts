import { defineChain, type Chain } from "viem";
import { arbitrum, base, mainnet, optimism, polygon } from "viem/chains";
import { CHAINS } from "@/config/chains";
import { MULTICALL3 } from "@/config/contracts";
import type { ChainConfig } from "@/types/chain";

const KNOWN: Record<number, Chain> = { 1: mainnet, 8453: base, 42161: arbitrum, 10: optimism, 137: polygon };

/** viem chain objects built from src/config/chains.ts — RPC and explorer come from the config. */
export const toViemChain = (c: ChainConfig): Chain => {
  const known = KNOWN[c.id];
  if (known) {
    return { ...known, rpcUrls: { default: { http: [c.rpcUrl] } }, blockExplorers: { default: { name: c.explorer.name, url: c.explorer.url } } };
  }
  return defineChain({
    id: c.id,
    name: c.name,
    nativeCurrency: { name: c.native.name, symbol: c.native.symbol, decimals: c.native.decimals },
    rpcUrls: { default: { http: [c.rpcUrl] } },
    blockExplorers: { default: { name: c.explorer.name, url: c.explorer.url } },
    contracts: { multicall3: { address: MULTICALL3 } },
  });
};

export const VIEM_CHAINS = CHAINS.map(toViemChain) as [Chain, ...Chain[]];
