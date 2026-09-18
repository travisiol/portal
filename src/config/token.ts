import type { Address } from "viem";
import type { ChainKey } from "@/types/chain";

/**
 * $PORTAL — configurable utility system. Nothing here is claimed active
 * unless its `active` flag is true, and the flags only turn true when the
 * feature is actually implemented and the token address is configured.
 */
export const PORTAL_TOKEN = {
  symbol: "PORTAL",
  name: "Portal",
  decimals: 18,
  addresses: {
    robinhood: (process.env.NEXT_PUBLIC_PORTAL_TOKEN_ROBINHOOD as Address | undefined) || undefined,
    ethereum: (process.env.NEXT_PUBLIC_PORTAL_TOKEN_ETHEREUM as Address | undefined) || undefined,
    base: (process.env.NEXT_PUBLIC_PORTAL_TOKEN_BASE as Address | undefined) || undefined,
  } as Partial<Record<ChainKey, Address | undefined>>,
} as const;

export const isPortalTokenConfigured = () => Object.values(PORTAL_TOKEN.addresses).some(Boolean);

/**
 * PORTAL's own frontend routing fee, in basis points of the amount routed.
 * 0 today: PORTAL takes no fee, so the tier discounts have nothing to apply
 * to and are shown as INACTIVE. The provider's own fees are never discounted.
 */
export const ROUTING_FEE_BPS = 0;

export interface FeeTier {
  name: string;
  threshold: bigint; // whole PORTAL tokens
  discountPct: number;
}

export const FEE_TIERS: readonly FeeTier[] = [
  { name: "Standard", threshold: 0n, discountPct: 0 },
  { name: "Tier I", threshold: 10_000n, discountPct: 25 },
  { name: "Tier II", threshold: 50_000n, discountPct: 50 },
  { name: "Tier III", threshold: 100_000n, discountPct: 100 },
];

export const feeTierFor = (balance: bigint): FeeTier => {
  let tier = FEE_TIERS[0];
  for (const t of FEE_TIERS) if (balance >= t.threshold * 10n ** BigInt(PORTAL_TOKEN.decimals)) tier = t;
  return tier;
};

export interface AdvancedFeature {
  id: string;
  name: string;
  description: string;
  requiredTier: number; // index in FEE_TIERS
  implemented: boolean;
}

/** Only `implemented: true` features are shown as available; the others are listed as planned. */
export const ADVANCED_FEATURES: readonly AdvancedFeature[] = [
  { id: "presets", name: "Route preference presets", description: "Best value, fastest or lowest fees as a saved default.", requiredTier: 0, implemented: true },
  { id: "saved", name: "Saved routes", description: "Pin a pair and asset to your passport.", requiredTier: 0, implemented: true },
  { id: "analytics", name: "Advanced analytics", description: "Provider reliability and cost history per route.", requiredTier: 1, implemented: false },
  { id: "split", name: "Smart route splitting", description: "Split one transfer across providers.", requiredTier: 2, implemented: false },
  { id: "priority", name: "Priority route simulation", description: "Simulate a route against a fresh state before sending.", requiredTier: 2, implemented: false },
];

export const TOKEN_UTILITY_ACTIVE = {
  feeDiscounts: ROUTING_FEE_BPS > 0 && isPortalTokenConfigured(),
  advancedRouting: isPortalTokenConfigured(),
  treasury: false,
};
