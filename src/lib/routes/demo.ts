import type { Address } from "viem";
import { providerMeta, PROVIDERS } from "@/config/providers";
import { toTokenRef } from "@/config/tokens";
import { ProviderNotConfiguredError } from "@/lib/errors";
import { DEMO_PRICES } from "@/lib/prices";
import type { QuoteParams, RouteProvider } from "@/types/provider";
import type { ProviderId, RouteQuote, RouteStatus, RouteStep, TrackingRef } from "@/types/route";
import { nativeRef, quoteId, usdOf } from "./shared";

/**
 * DEMO adapter. Deterministic, clearly labeled quotes shaped like the real
 * providers' answers so the whole interface can be exercised without any
 * network. Every quote it returns carries `source: "demo"`; it can never
 * build a transaction.
 */
interface DemoProfile {
  id: ProviderId;
  /** Fee as a fraction of the amount, calibrated on real quotes observed on 2026-09-18. */
  feePct: number;
  /** Fixed fee in USD (relayer gas on the destination). */
  fixedUsd: number;
  duration: (params: QuoteParams) => number;
  sameAssetOnly: boolean;
  swaps: boolean;
}

const PROFILES: DemoProfile[] = [
  { id: "relay", feePct: 0.0006, fixedUsd: 0.05, duration: () => 14, sameAssetOnly: false, swaps: true },
  { id: "across", feePct: 0.00008, fixedUsd: 0.03, duration: () => 20, sameAssetOnly: true, swaps: false },
  { id: "lifi", feePct: 0.0001, fixedUsd: 0.08, duration: (p) => (p.sourceToken.symbol === p.destinationToken.symbol ? 28 : 40), sameAssetOnly: false, swaps: true },
  { id: "stargate", feePct: 0.0005, fixedUsd: 0.12, duration: () => 45, sameAssetOnly: true, swaps: false },
  { id: "canonical", feePct: 0, fixedUsd: 0, duration: (p) => (p.destinationChain.home ? 480 : 7 * 86_400), sameAssetOnly: true, swaps: false },
  { id: "ccip", feePct: 0.0012, fixedUsd: 0.4, duration: () => 1200, sameAssetOnly: true, swaps: false },
];

/** Tiny deterministic jitter so two providers never tie exactly; stable across refreshes. */
const jitter = (seed: string): number => {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return ((h >>> 0) % 1000) / 1000 - 0.5; // -0.5 … 0.5
};

const demoGas = (chainId: number, nativeSymbol: string): { amount: bigint; usd: number } => {
  const price = DEMO_PRICES[nativeSymbol] ?? 1;
  const usd = chainId === 1 ? 1.2 : chainId === 137 ? 0.004 : 0.03;
  const amount = BigInt(Math.round((usd / price) * 1e18));
  return { amount, usd };
};

export const makeDemoProvider = (profile: DemoProfile): RouteProvider => {
  const meta = providerMeta(profile.id)!;
  return {
    id: profile.id,
    name: meta.name,
    kind: "demo",
    status: "demo-only",
    description: meta.description,
    supports: ({ sourceChain, destinationChain, token }) =>
      sourceChain.id !== destinationChain.id &&
      meta.chains.includes(sourceChain.id) &&
      meta.chains.includes(destinationChain.id) &&
      (!profile.sameAssetOnly || token.addresses[destinationChain.key] !== undefined),
    async getQuote(params) {
      const { sourceChain, destinationChain, sourceToken, destinationToken, amountIn } = params;
      if (profile.sameAssetOnly && sourceToken.symbol !== destinationToken.symbol) return null;
      if (!meta.chains.includes(sourceChain.id) || !meta.chains.includes(destinationChain.id)) return null;
      if (amountIn <= 0n) return null;

      const priceIn = DEMO_PRICES[sourceToken.symbol] ?? 1;
      const priceOut = DEMO_PRICES[destinationToken.symbol] ?? 1;
      const seed = `${profile.id}:${sourceChain.id}:${destinationChain.id}:${sourceToken.symbol}:${destinationToken.symbol}`;
      const feePct = Math.max(0, profile.feePct * (1 + jitter(seed) * 0.2));
      const amountInUsd = (Number(amountIn) / 10 ** sourceToken.decimals) * priceIn;
      const feeUsd = amountInUsd * feePct + profile.fixedUsd;
      const outUsd = Math.max(0, amountInUsd - feeUsd);
      const estimatedAmountOut = BigInt(Math.floor((outUsd / priceOut) * 10 ** destinationToken.decimals));
      const feeAmount = BigInt(Math.floor((feeUsd / priceIn) * 10 ** sourceToken.decimals));
      const gas = demoGas(sourceChain.id, sourceChain.native.symbol);

      const sourceRef = toTokenRef(sourceToken, sourceChain);
      const destinationRef = toTokenRef(destinationToken, destinationChain);
      const steps: RouteStep[] = [];
      if (sourceToken.kind === "erc20") steps.push({ kind: "approve", chainId: sourceChain.id, label: `APPROVE ${sourceToken.symbol}`, tokenIn: sourceRef });
      if (sourceToken.symbol !== destinationToken.symbol && profile.swaps && sourceToken.kind === "erc20") {
        steps.push({ kind: "swap", chainId: sourceChain.id, label: `${sourceToken.symbol} → ${destinationToken.symbol}`, detail: "swap on source", tokenIn: sourceRef });
      }
      steps.push({ kind: "bridge", chainId: sourceChain.id, label: meta.name.toUpperCase(), detail: profile.id === "canonical" ? "official bridge" : "provider" });
      if (sourceToken.symbol !== destinationToken.symbol && profile.swaps && sourceToken.kind === "native") {
        steps.push({ kind: "swap", chainId: destinationChain.id, label: `${sourceToken.symbol} → ${destinationToken.symbol}`, detail: "swap on destination", tokenOut: destinationRef });
      }
      steps.push({ kind: "receive", chainId: destinationChain.id, label: destinationChain.label, tokenOut: destinationRef });

      const notes = ["Demo data — simulated quote, no provider was contacted."];
      if (profile.id === "canonical" && !destinationChain.home) notes.push("Withdrawals through the canonical bridge wait for the challenge period.");

      const quote: RouteQuote = {
        id: quoteId(profile.id),
        provider: profile.id,
        providerName: meta.name,
        source: "demo",
        sourceChain: sourceChain.id,
        destinationChain: destinationChain.id,
        sourceToken: sourceRef,
        destinationToken: destinationRef,
        amountIn,
        estimatedAmountOut,
        minimumAmountOut: (estimatedAmountOut * 995n) / 1000n,
        providerFees: [{ label: `${meta.name} fee`, amount: feeAmount, token: sourceRef, usd: feeUsd }],
        estimatedGas: { amount: gas.amount, token: nativeRef(sourceChain), usd: gas.usd },
        estimatedDuration: profile.duration(params),
        transactionSteps: steps,
        quoteExpiration: Date.now() + 90_000,
        amountInUsd,
        amountOutUsd: usdOf(estimatedAmountOut, destinationToken.decimals, priceOut),
        executable: false,
        notes,
      };
      return quote;
    },
    async buildTransaction() {
      throw new ProviderNotConfiguredError(profile.id, "Demo quotes cannot be executed. Switch to LIVE mode for real routes.");
    },
    async getStatus(tracking: TrackingRef): Promise<RouteStatus> {
      const started = Number(tracking.requestId ?? 0);
      const elapsed = Date.now() - started;
      const state = elapsed > 8_000 ? "arrived" : elapsed > 2_000 ? "in_transit" : "source_confirmed";
      return { state, updatedAt: Date.now(), message: "Demo status — simulated." };
    },
  };
};

export const DEMO_PROVIDERS: RouteProvider[] = PROFILES.map(makeDemoProvider);

/** Which demo profiles exist, for the explorer. */
export const demoProviderIds = (): ProviderId[] => PROVIDERS.map((p) => p.id);

export type { DemoProfile };
export const demoPlaceholderSender: Address = "0x000000000000000000000000000000000000dEaD";
