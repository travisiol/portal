import type { Address } from "viem";

/**
 * Third-party contracts PORTAL talks to directly. Provider APIs return the
 * router addresses for LI.FI and Relay with each quote; only Across needs a
 * static SpokePool table because its transaction is encoded locally.
 * Source: https://docs.across.to/reference/contract-addresses (verified against
 * the suggested-fees API response for chain 1 on 2026-09-18).
 */
export const ACROSS_SPOKE_POOL: Partial<Record<number, Address>> = {
  1: "0x5c7BCd6E7De5423a257D81B442095A1a6ced35C5",
  10: "0x6f26Bf09B1C792e3228e5467807a900A503c0281",
  137: "0x9295ee1d8C5b022Be115A2AD3c30C72E34e7F096",
  8453: "0x09aea4b2242abC8bb4BB78D537A67a245A7bEC64",
  42161: "0xe35e9842fceaCA96570B734083f4a58e8F7C5f2A",
  4663: "0xD29C85F15DF544bA632C9E25829fd29d767d7978",
};

/** Arbitrum Orbit canonical bridge for Robinhood Chain — not configured. */
export const ORBIT_INBOX: Address | undefined = (process.env.NEXT_PUBLIC_ORBIT_INBOX as Address | undefined) || undefined;

export const MULTICALL3: Address = "0xcA11bde05977b3631167028862bE2a173976CA11";
