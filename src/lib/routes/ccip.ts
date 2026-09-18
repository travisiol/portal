import { providerMeta } from "@/config/providers";
import { ProviderNotConfiguredError } from "@/lib/errors";
import type { RouteProvider } from "@/types/provider";

/**
 * Chainlink CCIP. Token transfers go through per-lane router contracts and
 * there is no public REST endpoint that quotes an arbitrary transfer, so this
 * adapter is the interface only: it never quotes in LIVE mode. The demo
 * adapter carries the "ccip" profile so the UI can show what a CCIP route
 * would look like.
 */
export const ccipProvider: RouteProvider = {
  id: "ccip",
  name: "CCIP",
  kind: "live",
  status: "demo-only",
  description: providerMeta("ccip")!.description,
  supports: () => false,
  async getQuote() {
    return null;
  },
  async buildTransaction() {
    throw new ProviderNotConfiguredError("ccip", "CCIP is not configured. Router addresses and a fee oracle are required.");
  },
  async getStatus() {
    return { state: "unknown", updatedAt: Date.now(), message: "CCIP tracking is not configured." };
  },
};
