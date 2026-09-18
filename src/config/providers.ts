import type { ProviderId } from "@/types/route";
import type { ProviderStatus } from "@/types/provider";

/**
 * Static facts about each provider, used by the route explorer and the
 * network map before any quote is requested. The adapters in src/lib/routes
 * are the executable counterpart; `status` is the honest state of each one.
 */
export interface ProviderMeta {
  id: ProviderId;
  name: string;
  status: ProviderStatus;
  description: string;
  website: string;
  /** Chains the provider can quote for, verified against its public chain list. */
  chains: number[];
  /** Typical crossing time in seconds, shown before a quote exists. */
  typicalDuration: number;
}

export const PROVIDERS: readonly ProviderMeta[] = [
  {
    id: "lifi",
    name: "LI.FI",
    status: "live",
    description: "Aggregator. Quotes, transaction data and status from the public li.quest API — no key required.",
    website: "https://li.fi",
    chains: [1, 8453, 42161, 10, 137, 4663],
    typicalDuration: 30,
  },
  {
    id: "across",
    name: "Across",
    status: "live",
    description: "Intent-based bridge. Fees from the public Across API, deposit encoded locally against the SpokePool.",
    website: "https://across.to",
    chains: [1, 8453, 42161, 10, 137, 4663],
    typicalDuration: 20,
  },
  {
    id: "relay",
    name: "Relay",
    status: "needs-key",
    description: "Solver network. Live pricing without a key; executing a route needs RELAY_API_KEY on the server.",
    website: "https://relay.link",
    chains: [1, 8453, 42161, 10, 137, 4663],
    typicalDuration: 14,
  },
  {
    id: "stargate",
    name: "Stargate",
    status: "experimental",
    description: "LayerZero transfer API adapter. Not yet verified for Robinhood Chain pairs; reports unavailable when the API has no route.",
    website: "https://stargate.finance",
    chains: [1, 8453, 42161, 10, 137, 4663],
    typicalDuration: 45,
  },
  {
    id: "ccip",
    name: "CCIP",
    status: "demo-only",
    description: "Chainlink CCIP has no public quote API for token transfers. Interface only; demo data.",
    website: "https://chain.link/cross-chain",
    chains: [1, 8453, 42161, 10, 137],
    typicalDuration: 1200,
  },
  {
    id: "canonical",
    name: "Canonical bridge",
    status: "demo-only",
    description: "Arbitrum Orbit bridge for Robinhood Chain. Deposits take minutes, withdrawals days. Inbox address not configured.",
    website: "https://bridge.arbitrum.io",
    chains: [42161, 4663],
    typicalDuration: 480,
  },
];

export const providerMeta = (id: ProviderId): ProviderMeta | undefined => PROVIDERS.find((p) => p.id === id);

/** Providers that can, in principle, quote a pair (both chains supported). */
export const providersForPair = (sourceChainId: number, destinationChainId: number): ProviderMeta[] =>
  PROVIDERS.filter((p) => p.chains.includes(sourceChainId) && p.chains.includes(destinationChainId));
