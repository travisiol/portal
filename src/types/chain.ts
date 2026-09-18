import type { Address } from "viem";

export type ChainKey = "ethereum" | "base" | "arbitrum" | "optimism" | "polygon" | "robinhood";

export interface ChainConfig {
  id: number;
  key: ChainKey;
  name: string;
  /** Short engraving used on the portal ring and in tight layouts. */
  label: string;
  /** Robinhood Chain: the chain PORTAL is built around. */
  home: boolean;
  native: { symbol: "ETH" | "POL"; name: string; decimals: 18 };
  rpcUrl: string;
  explorer: { name: string; url: string };
  /** Wrapped native token, required by providers that only move ERC-20s (Across). */
  wrappedNative?: Address;
  providerKeys: {
    lifi?: number;
    relay?: number;
    across?: number;
    layerzero?: string;
  };
  /** Monochrome tint (hue in degrees) for the chain glyph. Cyan is reserved for energy. */
  hue: number;
}
