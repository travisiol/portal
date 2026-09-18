import type { ProviderId } from "@/types/route";

export class ProviderError extends Error {
  readonly provider: ProviderId;
  constructor(provider: ProviderId, message: string) {
    super(message);
    this.name = "ProviderError";
    this.provider = provider;
  }
}

/** The provider exists but cannot execute here (missing key, address or endpoint). */
export class ProviderNotConfiguredError extends ProviderError {
  constructor(provider: ProviderId, message: string) {
    super(provider, message);
    this.name = "ProviderNotConfiguredError";
  }
}

export type BridgeErrorCode = "NO_ROUTE" | "INSUFFICIENT_GAS" | "INSUFFICIENT_BALANCE" | "ROUTE_CHANGED" | "QUOTE_EXPIRED" | "PROVIDER_ERROR" | "USER_REJECTED" | "WRONG_NETWORK";

export interface BridgeError {
  code: BridgeErrorCode;
  title: string;
  message: string;
  action?: "refresh" | "review" | "retry";
}

export const bridgeError = (code: BridgeErrorCode, extra?: Partial<BridgeError>): BridgeError => {
  const base: Record<BridgeErrorCode, BridgeError> = {
    NO_ROUTE: { code, title: "NO ROUTE AVAILABLE", message: "This asset cannot currently travel between these networks.", action: "refresh" },
    INSUFFICIENT_GAS: { code, title: "INSUFFICIENT GAS", message: "You need the native asset on the source network to begin this route." },
    INSUFFICIENT_BALANCE: { code, title: "INSUFFICIENT BALANCE", message: "The amount exceeds your balance on the source network." },
    ROUTE_CHANGED: { code, title: "ROUTE CHANGED", message: "The quote has changed. Review the new amount before continuing.", action: "review" },
    QUOTE_EXPIRED: { code, title: "QUOTE EXPIRED", message: "Refresh the route to get a current quote.", action: "refresh" },
    PROVIDER_ERROR: { code, title: "PROVIDER UNAVAILABLE", message: "A route provider did not answer. Other routes are still shown.", action: "retry" },
    USER_REJECTED: { code, title: "CONFIRMATION DECLINED", message: "The wallet request was rejected. Nothing was sent.", action: "retry" },
    WRONG_NETWORK: { code, title: "WRONG NETWORK", message: "Switch your wallet to the source network to continue.", action: "retry" },
  };
  return { ...base[code], ...extra };
};

export const isUserRejection = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  return /user rejected|user denied|rejected the request|ACTION_REJECTED|4001/i.test(message);
};

export const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown error");
