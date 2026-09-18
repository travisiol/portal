import type { ChainConfig, ChainKey } from "@/types/chain";

/**
 * The only place a chain is described. Every value can be overridden from the
 * environment (RPC and explorer), nothing else in the app switches on a chain id.
 * NEXT_PUBLIC_* variables must be read statically so Next.js can inline them.
 */
const rpc = {
  ethereum: process.env.NEXT_PUBLIC_RPC_ETHEREUM ?? "https://ethereum-rpc.publicnode.com",
  base: process.env.NEXT_PUBLIC_RPC_BASE ?? "https://mainnet.base.org",
  arbitrum: process.env.NEXT_PUBLIC_RPC_ARBITRUM ?? "https://arb1.arbitrum.io/rpc",
  optimism: process.env.NEXT_PUBLIC_RPC_OPTIMISM ?? "https://mainnet.optimism.io",
  polygon: process.env.NEXT_PUBLIC_RPC_POLYGON ?? "https://polygon-bor-rpc.publicnode.com",
  robinhood: process.env.NEXT_PUBLIC_RPC_ROBINHOOD ?? "https://rpc.mainnet.chain.robinhood.com",
} satisfies Record<ChainKey, string>;

const robinhoodExplorer = (process.env.NEXT_PUBLIC_EXPLORER_ROBINHOOD ?? "https://robinhoodchain.blockscout.com").replace(/\/$/, "");

export const CHAINS: readonly ChainConfig[] = [
  {
    id: 4663,
    key: "robinhood",
    name: "Robinhood Chain",
    label: "ROBINHOOD",
    home: true,
    native: { symbol: "ETH", name: "Ether", decimals: 18 },
    rpcUrl: rpc.robinhood,
    explorer: { name: "Robinhood Chain Explorer", url: robinhoodExplorer },
    wrappedNative: "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73",
    providerKeys: { lifi: 4663, relay: 4663, across: 4663, layerzero: "robinhood" },
    hue: 190,
  },
  {
    id: 1,
    key: "ethereum",
    name: "Ethereum",
    label: "ETHEREUM",
    home: false,
    native: { symbol: "ETH", name: "Ether", decimals: 18 },
    rpcUrl: rpc.ethereum,
    explorer: { name: "Etherscan", url: "https://etherscan.io" },
    wrappedNative: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    providerKeys: { lifi: 1, relay: 1, across: 1, layerzero: "ethereum" },
    hue: 220,
  },
  {
    id: 8453,
    key: "base",
    name: "Base",
    label: "BASE",
    home: false,
    native: { symbol: "ETH", name: "Ether", decimals: 18 },
    rpcUrl: rpc.base,
    explorer: { name: "Basescan", url: "https://basescan.org" },
    wrappedNative: "0x4200000000000000000000000000000000000006",
    providerKeys: { lifi: 8453, relay: 8453, across: 8453, layerzero: "base" },
    hue: 230,
  },
  {
    id: 42161,
    key: "arbitrum",
    name: "Arbitrum",
    label: "ARBITRUM",
    home: false,
    native: { symbol: "ETH", name: "Ether", decimals: 18 },
    rpcUrl: rpc.arbitrum,
    explorer: { name: "Arbiscan", url: "https://arbiscan.io" },
    wrappedNative: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
    providerKeys: { lifi: 42161, relay: 42161, across: 42161, layerzero: "arbitrum" },
    hue: 205,
  },
  {
    id: 10,
    key: "optimism",
    name: "Optimism",
    label: "OPTIMISM",
    home: false,
    native: { symbol: "ETH", name: "Ether", decimals: 18 },
    rpcUrl: rpc.optimism,
    explorer: { name: "Optimistic Etherscan", url: "https://optimistic.etherscan.io" },
    wrappedNative: "0x4200000000000000000000000000000000000006",
    providerKeys: { lifi: 10, relay: 10, across: 10, layerzero: "optimism" },
    hue: 0,
  },
  {
    id: 137,
    key: "polygon",
    name: "Polygon",
    label: "POLYGON",
    home: false,
    native: { symbol: "POL", name: "Polygon Ecosystem Token", decimals: 18 },
    rpcUrl: rpc.polygon,
    explorer: { name: "Polygonscan", url: "https://polygonscan.com" },
    wrappedNative: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
    providerKeys: { lifi: 137, relay: 137, across: 137, layerzero: "polygon" },
    hue: 270,
  },
];

export const HOME_CHAIN = CHAINS.find((c) => c.home)!;

export const chainById = (id: number): ChainConfig | undefined => CHAINS.find((c) => c.id === id);
export const chainByKey = (key: string): ChainConfig | undefined => CHAINS.find((c) => c.key === key);
export const requireChain = (id: number): ChainConfig => {
  const chain = chainById(id);
  if (!chain) throw new Error(`Unsupported chain ${id}`);
  return chain;
};

/** Order of the engravings on the glyph rings (clockwise). */
export const RING_ORDER: readonly ChainKey[] = ["ethereum", "base", "arbitrum", "robinhood", "optimism", "polygon"];

export const explorerTx = (chain: ChainConfig, hash: string) => `${chain.explorer.url}/tx/${hash}`;
export const explorerAddress = (chain: ChainConfig, address: string) => `${chain.explorer.url}/address/${address}`;
