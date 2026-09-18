/**
 * Across SpokePool — depositV3 (selector 0x7b939232), verified present on the
 * Ethereum SpokePool implementation 0x456ac26e…8e84 on 2026-09-18
 * (scripts/checks/across-selectors.mjs).
 */
export const acrossSpokePoolAbi = [
  {
    type: "function",
    name: "depositV3",
    stateMutability: "payable",
    inputs: [
      { name: "depositor", type: "address" },
      { name: "recipient", type: "address" },
      { name: "inputToken", type: "address" },
      { name: "outputToken", type: "address" },
      { name: "inputAmount", type: "uint256" },
      { name: "outputAmount", type: "uint256" },
      { name: "destinationChainId", type: "uint256" },
      { name: "exclusiveRelayer", type: "address" },
      { name: "quoteTimestamp", type: "uint32" },
      { name: "fillDeadline", type: "uint32" },
      { name: "exclusivityDeadline", type: "uint32" },
      { name: "message", type: "bytes" },
    ],
    outputs: [],
  },
] as const;

/** Gas a depositV3 call typically uses; only for the estimate shown before signing. */
export const ACROSS_DEPOSIT_GAS = 140_000n;
