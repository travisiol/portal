import { ORBIT_INBOX } from "@/config/contracts";
import { providerMeta } from "@/config/providers";
import { ProviderNotConfiguredError } from "@/lib/errors";
import type { RouteProvider } from "@/types/provider";

/**
 * Canonical Arbitrum Orbit bridge for Robinhood Chain. A deposit is a call to
 * the chain's Inbox on its parent chain; withdrawals go through ArbSys and
 * wait for the challenge period. Nothing here is wired until
 * NEXT_PUBLIC_ORBIT_INBOX (and the parent-chain gateway for ERC-20s) is
 * configured, so in LIVE mode the adapter reports "not configured" instead of
 * guessing an address.
 */
export const canonicalProvider: RouteProvider = {
  id: "canonical",
  name: "Canonical bridge",
  kind: "live",
  status: "demo-only",
  description: providerMeta("canonical")!.description,
  supports: () => ORBIT_INBOX !== undefined,
  async getQuote() {
    return null;
  },
  async buildTransaction() {
    throw new ProviderNotConfiguredError("canonical", "The canonical bridge Inbox is not configured (NEXT_PUBLIC_ORBIT_INBOX).");
  },
  async getStatus() {
    return { state: "unknown", updatedAt: Date.now(), message: "Canonical bridge tracking is not configured." };
  },
};
