import type { Address, Hex } from "viem";
import type { TokenRef } from "./token";

export type ProviderId = "relay" | "across" | "lifi" | "stargate" | "ccip" | "canonical" | "demo";

/** Where a quote comes from. This single field drives every DEMO DATA tag in the UI. */
export type DataSource = "live" | "demo";

export interface Fee {
  label: string;
  amount: bigint;
  token: TokenRef;
  usd?: number;
}

export type RouteStepKind = "approve" | "swap" | "bridge" | "receive";

export interface RouteStep {
  kind: RouteStepKind;
  chainId: number;
  /** Uppercase label shown in the path: "RELAY", "USDC → ETH", "ROBINHOOD". */
  label: string;
  detail?: string;
  tokenIn?: TokenRef;
  tokenOut?: TokenRef;
}

export interface RouteQuote {
  id: string;
  provider: ProviderId;
  providerName: string;
  source: DataSource;
  sourceChain: number;
  destinationChain: number;
  sourceToken: TokenRef;
  destinationToken: TokenRef;
  amountIn: bigint;
  estimatedAmountOut: bigint;
  minimumAmountOut?: bigint;
  providerFees: Fee[];
  estimatedGas: { amount: bigint; token: TokenRef; usd?: number };
  /** Seconds. */
  estimatedDuration: number;
  transactionSteps: RouteStep[];
  /** Epoch milliseconds. */
  quoteExpiration: number;
  amountInUsd?: number;
  amountOutUsd?: number;
  /** false = shown for comparison only (provider needs configuration to execute). */
  executable: boolean;
  notes?: string[];
  /** Provider payload reused by buildTransaction. Never rendered. */
  raw?: unknown;
}

export interface TransactionRequestData {
  chainId: number;
  to: Address;
  data: Hex;
  value: bigint;
  gas?: bigint;
}

export interface Approval {
  chainId: number;
  token: TokenRef;
  spender: Address;
  amount: bigint;
}

export interface TrackingRef {
  provider: ProviderId;
  sourceChain: number;
  destinationChain: number;
  txHash?: Hex;
  requestId?: string;
  /** Provider-specific bridge/tool identifier (LI.FI needs it for status). */
  bridge?: string;
}

export interface BuiltRoute {
  approvals: Approval[];
  transaction: TransactionRequestData;
  tracking: TrackingRef;
}

export type RouteStatusState = "pending" | "source_confirmed" | "in_transit" | "arrived" | "failed" | "refunded" | "unknown";

export interface RouteStatus {
  state: RouteStatusState;
  sourceTxHash?: Hex;
  destinationTxHash?: Hex;
  message?: string;
  updatedAt: number;
}

export type Preference = "value" | "fastest" | "fees";

export interface ScoredRoute {
  quote: RouteQuote;
  /** 0–100, higher is better for the active preference. */
  score: number;
  rank: number;
  netValueUsd?: number;
  totalCostUsd?: number;
  feesUsd?: number;
}

export interface RouteRanking {
  preference: Preference;
  ranked: ScoredRoute[];
  /** Only defined when at least one executable quote was actually scored. */
  best?: ScoredRoute;
  winners: Partial<Record<Preference, string>>;
}
