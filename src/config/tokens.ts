import { zeroAddress, type Address } from "viem";
import type { ChainConfig } from "@/types/chain";
import type { TokenConfig, TokenRef } from "@/types/token";

export const TOKENS: readonly TokenConfig[] = [
  {
    symbol: "ETH",
    name: "Ether",
    decimals: 18,
    kind: "native",
    glyph: "eth",
    addresses: {
      ethereum: zeroAddress,
      base: zeroAddress,
      arbitrum: zeroAddress,
      optimism: zeroAddress,
      robinhood: zeroAddress,
    },
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    kind: "erc20",
    glyph: "usdc",
    addresses: {
      ethereum: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      base: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      arbitrum: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
      optimism: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
      polygon: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    },
  },
  {
    symbol: "USDG",
    name: "Global Dollar",
    decimals: 6,
    kind: "erc20",
    glyph: "usdg",
    addresses: {
      ethereum: "0xe343167631d89B6Ffc58B88d6b7fB0228795491D",
      robinhood: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168",
    },
  },
  {
    symbol: "POL",
    name: "Polygon Ecosystem Token",
    decimals: 18,
    kind: "native",
    glyph: "pol",
    addresses: {
      polygon: zeroAddress,
    },
  },
];

export const tokenBySymbol = (symbol: string): TokenConfig | undefined => TOKENS.find((t) => t.symbol === symbol);

export const tokensOn = (chain: ChainConfig): TokenConfig[] => TOKENS.filter((t) => t.addresses[chain.key] !== undefined);

export const tokenAddressOn = (token: TokenConfig, chain: ChainConfig): Address | undefined => token.addresses[chain.key];

export const isAvailableOn = (token: TokenConfig, chain: ChainConfig): boolean => token.addresses[chain.key] !== undefined;

export const toTokenRef = (token: TokenConfig, chain: ChainConfig): TokenRef => {
  const address = tokenAddressOn(token, chain);
  if (address === undefined) throw new Error(`${token.symbol} is not available on ${chain.name}`);
  return { chainId: chain.id, address, symbol: token.symbol, decimals: token.decimals };
};

/**
 * The token the destination side defaults to when the pair changes: the same
 * asset when it exists there, otherwise the destination's stable, otherwise
 * its native asset.
 */
export const defaultDestinationToken = (source: TokenConfig, destination: ChainConfig): TokenConfig => {
  if (isAvailableOn(source, destination)) return source;
  const stable = tokensOn(destination).find((t) => t.glyph === "usdg" || t.glyph === "usdc");
  if (source.kind === "erc20" && stable) return stable;
  return tokensOn(destination).find((t) => t.kind === "native") ?? tokensOn(destination)[0];
};

export const nativeTokenOf = (chain: ChainConfig): TokenConfig => TOKENS.find((t) => t.kind === "native" && t.symbol === chain.native.symbol)!;
