import type { Address } from "viem";
import type { ChainKey } from "./chain";

export type TokenGlyph = "eth" | "usdc" | "usdg" | "pol" | "portal";

export interface TokenConfig {
  symbol: string;
  name: string;
  decimals: number;
  kind: "native" | "erc20";
  glyph: TokenGlyph;
  /** Address per chain; the zero address for the native asset. Missing = not available there. */
  addresses: Partial<Record<ChainKey, Address>>;
}

/** A token pinned to one chain — what a quote and a transaction actually reference. */
export interface TokenRef {
  chainId: number;
  address: Address;
  symbol: string;
  decimals: number;
}
