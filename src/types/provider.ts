import type { Address } from "viem";
import type { ChainConfig } from "./chain";
import type { TokenConfig } from "./token";
import type { BuiltRoute, ProviderId, RouteQuote, RouteStatus, TrackingRef } from "./route";

export interface QuoteParams {
  sourceChain: ChainConfig;
  destinationChain: ChainConfig;
  sourceToken: TokenConfig;
  destinationToken: TokenConfig;
  amountIn: bigint;
  /** Undefined = indicative quote built for a placeholder address. */
  sender?: Address;
  recipient?: Address;
  slippageBps: number;
  signal?: AbortSignal;
}

export interface PairParams {
  sourceChain: ChainConfig;
  destinationChain: ChainConfig;
  token: TokenConfig;
}

export type ProviderStatus = "live" | "needs-key" | "experimental" | "demo-only";

export interface RouteProvider {
  id: ProviderId;
  name: string;
  kind: "live" | "demo";
  status: ProviderStatus;
  /** One line shown in the route explorer. */
  description: string;
  supports(pair: PairParams): boolean;
  /** null = no route for this pair; throws ProviderError on transport failure. */
  getQuote(params: QuoteParams): Promise<RouteQuote | null>;
  buildTransaction(quote: RouteQuote, params: QuoteParams & { sender: Address }): Promise<BuiltRoute>;
  getStatus(tracking: TrackingRef): Promise<RouteStatus>;
}
