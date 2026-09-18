import type { Hex } from "viem";
import type { DataSource, ProviderId, RouteStatusState } from "./route";

export interface Journey {
  id: string;
  mode: DataSource;
  provider: ProviderId;
  providerName: string;
  sourceChain: number;
  destinationChain: number;
  tokenSymbol: string;
  /** Decimal strings, already formatted for display. */
  amountIn: string;
  amountOut: string;
  usd?: number;
  sourceTxHash?: Hex;
  destinationTxHash?: Hex;
  startedAt: number;
  completedAt?: number;
  state: RouteStatusState;
}

export interface SavedRoute {
  id: string;
  sourceChain: number;
  destinationChain: number;
  tokenSymbol: string;
}

export type PassportLevel = "Explorer" | "Navigator" | "Gatekeeper";
