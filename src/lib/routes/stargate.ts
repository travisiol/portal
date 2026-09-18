import type { Address, Hex } from "viem";
import { providerMeta } from "@/config/providers";
import { toTokenRef } from "@/config/tokens";
import { PLACEHOLDER_ADDRESS } from "@/lib/env";
import { ProviderError } from "@/lib/errors";
import { nativePriceUsd, tokenPriceUsd } from "@/lib/prices";
import type { QuoteParams, RouteProvider } from "@/types/provider";
import type { BuiltRoute, Fee, RouteStatus, RouteStep, TrackingRef } from "@/types/route";
import { chainLabel, fetchJson, hexToBigInt, nativeRef, quoteId, usdOf } from "./shared";

/**
 * Stargate through the LayerZero transfer API
 * (https://transfer.layerzero-api.com — the successor of stargate.finance/api/v1,
 * which now answers "deprecated"). The chain list includes Robinhood
 * (chainKey "robinhood"), but on 2026-09-18 `/v1/quotes` answered 404 for
 * every pair tried, so this adapter is EXPERIMENTAL: a 404 is reported as
 * "no route", never as a quote.
 */
const BASE = "https://transfer.layerzero-api.com/v1";
const NATIVE = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

interface LzQuote {
  route: string;
  srcAmount: string;
  dstAmount: string;
  dstAmountMin?: string;
  duration?: { estimated?: number };
  fees?: { token: string; amount: string; type: string; chainKey: string }[];
  steps?: { type: "approve" | "bridge" | string; sender?: Address; chainKey: string; transaction?: { to: Address; data: Hex; value?: string; from?: Address } }[];
}

interface LzQuotes {
  quotes?: LzQuote[];
  message?: string;
}

const tokenAddress = (params: QuoteParams, side: "source" | "destination"): string | undefined => {
  const token = side === "source" ? params.sourceToken : params.destinationToken;
  const chain = side === "source" ? params.sourceChain : params.destinationChain;
  if (token.kind === "native") return NATIVE;
  return token.addresses[chain.key];
};

async function requestQuotes(params: QuoteParams, sender: Address): Promise<LzQuote | null> {
  const srcToken = tokenAddress(params, "source");
  const dstToken = tokenAddress(params, "destination");
  const srcChainKey = params.sourceChain.providerKeys.layerzero;
  const dstChainKey = params.destinationChain.providerKeys.layerzero;
  if (!srcToken || !dstToken || !srcChainKey || !dstChainKey) return null;
  const minOut = (params.amountIn * BigInt(10_000 - params.slippageBps)) / 10_000n;
  const search = new URLSearchParams({
    srcToken,
    dstToken,
    srcAddress: sender,
    dstAddress: params.recipient ?? sender,
    srcChainKey,
    dstChainKey,
    srcAmount: params.amountIn.toString(),
    dstAmountMin: minOut.toString(),
  });
  const { ok, status, body } = await fetchJson<LzQuotes>("stargate", `${BASE}/quotes?${search.toString()}`, { signal: params.signal });
  if (!ok) {
    if (status === 404 || status === 400 || status === 422) return null;
    throw new ProviderError("stargate", body?.message ?? `LayerZero transfer API answered ${status}`);
  }
  const best = body?.quotes?.find((q) => hexToBigInt(q.dstAmount) > 0n);
  return best ?? null;
}

export const stargateProvider: RouteProvider = {
  id: "stargate",
  name: "Stargate",
  kind: "live",
  status: "experimental",
  description: providerMeta("stargate")!.description,
  supports: ({ sourceChain, destinationChain, token }) =>
    sourceChain.id !== destinationChain.id &&
    sourceChain.providerKeys.layerzero !== undefined &&
    destinationChain.providerKeys.layerzero !== undefined &&
    token.addresses[destinationChain.key] !== undefined,
  async getQuote(params) {
    if (params.sourceToken.symbol !== params.destinationToken.symbol) return null;
    const sender = params.sender ?? PLACEHOLDER_ADDRESS;
    const q = await requestQuotes(params, sender);
    if (!q) return null;
    const sourceRef = toTokenRef(params.sourceToken, params.sourceChain);
    const destinationRef = toTokenRef(params.destinationToken, params.destinationChain);
    const [priceIn, priceOut, nativePrice] = await Promise.all([
      tokenPriceUsd(sourceRef.chainId, sourceRef.address, params.signal),
      tokenPriceUsd(destinationRef.chainId, destinationRef.address, params.signal),
      nativePriceUsd(params.sourceChain.id, params.signal),
    ]);
    const providerFees: Fee[] = (q.fees ?? []).map((f) => {
      const native = f.token.toLowerCase() === NATIVE.toLowerCase();
      return {
        label: f.type === "message" ? "LayerZero message fee" : `${f.type} fee`,
        amount: hexToBigInt(f.amount),
        token: native ? nativeRef(params.sourceChain) : sourceRef,
        usd: usdOf(hexToBigInt(f.amount), native ? 18 : sourceRef.decimals, native ? nativePrice : priceIn),
      };
    });
    const steps: RouteStep[] = [];
    if (params.sourceToken.kind === "erc20") steps.push({ kind: "approve", chainId: sourceRef.chainId, label: `APPROVE ${sourceRef.symbol}`, tokenIn: sourceRef });
    steps.push({ kind: "bridge", chainId: sourceRef.chainId, label: "STARGATE", detail: q.route, tokenIn: sourceRef, tokenOut: destinationRef });
    steps.push({ kind: "receive", chainId: destinationRef.chainId, label: chainLabel(destinationRef.chainId), tokenOut: destinationRef });
    const bridgeTx = q.steps?.find((s) => s.type === "bridge")?.transaction;
    const estimatedAmountOut = hexToBigInt(q.dstAmount);
    return {
      id: quoteId("stargate"),
      provider: "stargate",
      providerName: "Stargate",
      source: "live",
      sourceChain: params.sourceChain.id,
      destinationChain: params.destinationChain.id,
      sourceToken: sourceRef,
      destinationToken: destinationRef,
      amountIn: params.amountIn,
      estimatedAmountOut,
      minimumAmountOut: q.dstAmountMin ? hexToBigInt(q.dstAmountMin) : undefined,
      providerFees,
      estimatedGas: { amount: 0n, token: nativeRef(params.sourceChain), usd: undefined },
      estimatedDuration: Number(q.duration?.estimated) || 45,
      transactionSteps: steps,
      quoteExpiration: Date.now() + 60_000,
      amountInUsd: usdOf(params.amountIn, sourceRef.decimals, priceIn),
      amountOutUsd: usdOf(estimatedAmountOut, destinationRef.decimals, priceOut),
      executable: Boolean(bridgeTx?.to && bridgeTx?.data),
      notes: ["Experimental adapter — LayerZero transfer API."],
      raw: { quote: q, sender },
    };
  },
  async buildTransaction(quote, params): Promise<BuiltRoute> {
    const raw = quote.raw as { quote: LzQuote; sender: Address } | undefined;
    let q = raw?.quote;
    if (!q || raw?.sender.toLowerCase() !== params.sender.toLowerCase()) {
      q = (await requestQuotes(params, params.sender)) ?? undefined;
      if (!q) throw new ProviderError("stargate", "Stargate has no route for this transfer.");
    }
    const bridge = q.steps?.find((s) => s.type === "bridge")?.transaction;
    if (!bridge?.to || !bridge.data) throw new ProviderError("stargate", "Stargate returned no transaction.");
    const approvals: BuiltRoute["approvals"] = [];
    const approve = q.steps?.find((s) => s.type === "approve")?.transaction;
    if (approve && params.sourceToken.kind === "erc20") {
      approvals.push({ chainId: params.sourceChain.id, token: quote.sourceToken, spender: bridge.to, amount: params.amountIn });
    }
    return {
      approvals,
      transaction: { chainId: params.sourceChain.id, to: bridge.to, data: bridge.data, value: hexToBigInt(bridge.value) },
      tracking: { provider: "stargate", sourceChain: params.sourceChain.id, destinationChain: params.destinationChain.id },
    };
  },
  async getStatus(tracking: TrackingRef): Promise<RouteStatus> {
    if (!tracking.txHash) return { state: "pending", updatedAt: Date.now() };
    const { ok, body } = await fetchJson<{ data?: { status?: { name?: string }; destination?: { tx?: { txHash?: Hex } } }[] }>(
      "stargate",
      `https://scan.layerzero-api.com/v1/messages/tx/${tracking.txHash}`,
    );
    const message = body?.data?.[0];
    if (!ok || !message) return { state: "in_transit", sourceTxHash: tracking.txHash, updatedAt: Date.now(), message: "Waiting for LayerZero scan" };
    const name = message.status?.name ?? "";
    const base = { sourceTxHash: tracking.txHash, destinationTxHash: message.destination?.tx?.txHash, updatedAt: Date.now() };
    if (name === "DELIVERED") return { ...base, state: "arrived" };
    if (name === "FAILED" || name === "BLOCKED") return { ...base, state: "failed", message: name };
    return { ...base, state: "in_transit", message: name || undefined };
  },
};
