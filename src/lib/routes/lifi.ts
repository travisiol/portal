import type { Address, Hex } from "viem";
import { providerMeta } from "@/config/providers";
import { toTokenRef } from "@/config/tokens";
import { PLACEHOLDER_ADDRESS } from "@/lib/env";
import { ProviderError } from "@/lib/errors";
import type { QuoteParams, RouteProvider } from "@/types/provider";
import type { BuiltRoute, Fee, RouteQuote, RouteStatus, RouteStep, TrackingRef } from "@/types/route";
import type { TokenRef } from "@/types/token";
import { chainLabel, fetchJson, hexToBigInt, isNative, nativeRef, quoteId } from "./shared";

/**
 * LI.FI — https://docs.li.fi/li.fi-api
 * Public endpoints, no key: /v1/quote returns the transaction request, /v1/status tracks it.
 * Verified against chain 4663 on 2026-09-18.
 */
const BASE = "https://li.quest/v1";
const INTEGRATOR = "portal";

interface LifiToken {
  address: Address;
  symbol: string;
  decimals: number;
  chainId: number;
  priceUSD?: string;
}

export interface LifiQuote {
  id: string;
  tool: string;
  toolDetails?: { key: string; name: string };
  action: { fromChainId: number; toChainId: number; fromToken: LifiToken; toToken: LifiToken; fromAmount: string; fromAddress?: string; toAddress?: string };
  estimate: {
    toAmount: string;
    toAmountMin: string;
    approvalAddress: Address;
    executionDuration: number;
    fromAmountUSD?: string;
    toAmountUSD?: string;
    feeCosts?: { name: string; amount: string; amountUSD?: string; token: LifiToken; included?: boolean }[];
    gasCosts?: { type: string; amount: string; amountUSD?: string; token: LifiToken }[];
  };
  includedSteps?: { type: "swap" | "cross" | "protocol" | "custom"; tool: string; toolDetails?: { name: string }; action: { fromChainId: number; toChainId: number; fromToken: LifiToken; toToken: LifiToken } }[];
  transactionRequest?: { to: Address; data: Hex; value?: string; gasLimit?: string; chainId?: number; from?: Address };
  message?: string;
}

interface LifiStatus {
  status: "NOT_FOUND" | "INVALID" | "PENDING" | "DONE" | "FAILED";
  substatus?: string;
  substatusMessage?: string;
  sending?: { txHash?: Hex };
  receiving?: { txHash?: Hex; amount?: string };
}

const ref = (t: LifiToken): TokenRef => ({ chainId: t.chainId, address: t.address, symbol: t.symbol, decimals: t.decimals });

const quoteUrl = (params: QuoteParams, sender: Address, recipient?: Address) => {
  const search = new URLSearchParams({
    fromChain: String(params.sourceChain.providerKeys.lifi ?? params.sourceChain.id),
    toChain: String(params.destinationChain.providerKeys.lifi ?? params.destinationChain.id),
    fromToken: toTokenRef(params.sourceToken, params.sourceChain).address,
    toToken: toTokenRef(params.destinationToken, params.destinationChain).address,
    fromAmount: params.amountIn.toString(),
    fromAddress: sender,
    toAddress: recipient ?? sender,
    integrator: INTEGRATOR,
    slippage: String(params.slippageBps / 10_000),
    order: "RECOMMENDED",
  });
  return `${BASE}/quote?${search.toString()}`;
};

async function requestQuote(params: QuoteParams, sender: Address): Promise<LifiQuote | null> {
  const { ok, status, body } = await fetchJson<LifiQuote>("lifi", quoteUrl(params, sender, params.recipient), { signal: params.signal });
  if (!ok) {
    if (status === 404 || status === 400 || status === 422) return null; // no route for this pair / amount
    throw new ProviderError("lifi", body?.message ?? `LI.FI answered ${status}`);
  }
  if (!body?.estimate) return null;
  return body;
}

/** Exported for the fixture tests. */
export function normalizeLifi(params: QuoteParams, q: LifiQuote, sender: Address): RouteQuote {
  const sourceRef = ref(q.action.fromToken);
  const destinationRef = ref(q.action.toToken);
  const priceIn = Number(q.action.fromToken.priceUSD) || undefined;
  const priceOut = Number(q.action.toToken.priceUSD) || undefined;

  const providerFees: Fee[] = (q.estimate.feeCosts ?? []).map((f) => ({
    label: f.name,
    amount: hexToBigInt(f.amount),
    token: ref(f.token),
    usd: f.amountUSD !== undefined ? Number(f.amountUSD) : undefined,
  }));

  const gas = q.estimate.gasCosts?.[0];
  const estimatedGas = gas
    ? { amount: hexToBigInt(gas.amount), token: ref(gas.token), usd: gas.amountUSD !== undefined ? Number(gas.amountUSD) : undefined }
    : { amount: 0n, token: nativeRef(params.sourceChain), usd: undefined };

  const steps: RouteStep[] = [];
  if (!isNative(sourceRef.address)) steps.push({ kind: "approve", chainId: sourceRef.chainId, label: `APPROVE ${sourceRef.symbol}`, tokenIn: sourceRef });
  for (const s of q.includedSteps ?? []) {
    const name = (s.toolDetails?.name ?? s.tool).toUpperCase();
    if (s.type === "swap") {
      steps.push({ kind: "swap", chainId: s.action.fromChainId, label: `${s.action.fromToken.symbol} → ${s.action.toToken.symbol}`, detail: name, tokenIn: ref(s.action.fromToken), tokenOut: ref(s.action.toToken) });
    } else if (s.type === "cross") {
      steps.push({ kind: "bridge", chainId: s.action.fromChainId, label: name, detail: "via LI.FI", tokenIn: ref(s.action.fromToken), tokenOut: ref(s.action.toToken) });
    }
  }
  if (!steps.some((s) => s.kind === "bridge")) steps.push({ kind: "bridge", chainId: sourceRef.chainId, label: (q.toolDetails?.name ?? q.tool).toUpperCase(), detail: "via LI.FI" });
  steps.push({ kind: "receive", chainId: destinationRef.chainId, label: chainLabel(destinationRef.chainId), tokenOut: destinationRef });

  const amountIn = hexToBigInt(q.action.fromAmount, params.amountIn);
  const estimatedAmountOut = hexToBigInt(q.estimate.toAmount);
  return {
    id: quoteId("lifi"),
    provider: "lifi",
    providerName: "LI.FI",
    source: "live",
    sourceChain: params.sourceChain.id,
    destinationChain: params.destinationChain.id,
    sourceToken: sourceRef,
    destinationToken: destinationRef,
    amountIn,
    estimatedAmountOut,
    minimumAmountOut: hexToBigInt(q.estimate.toAmountMin, estimatedAmountOut),
    providerFees,
    estimatedGas,
    estimatedDuration: Number(q.estimate.executionDuration) || 60,
    transactionSteps: steps,
    quoteExpiration: Date.now() + 60_000,
    amountInUsd: q.estimate.fromAmountUSD !== undefined ? Number(q.estimate.fromAmountUSD) : priceIn && (Number(amountIn) / 10 ** sourceRef.decimals) * priceIn,
    amountOutUsd: q.estimate.toAmountUSD !== undefined ? Number(q.estimate.toAmountUSD) : priceOut && (Number(estimatedAmountOut) / 10 ** destinationRef.decimals) * priceOut,
    executable: Boolean(q.transactionRequest?.to && q.transactionRequest?.data),
    notes: [`${q.toolDetails?.name ?? q.tool} through the LI.FI diamond contract.`],
    raw: { quote: q, sender },
  };
}

export const lifiProvider: RouteProvider = {
  id: "lifi",
  name: "LI.FI",
  kind: "live",
  status: "live",
  description: providerMeta("lifi")!.description,
  supports: ({ sourceChain, destinationChain }) =>
    sourceChain.id !== destinationChain.id && sourceChain.providerKeys.lifi !== undefined && destinationChain.providerKeys.lifi !== undefined,
  async getQuote(params) {
    const sender = params.sender ?? PLACEHOLDER_ADDRESS;
    const q = await requestQuote(params, sender);
    return q ? normalizeLifi(params, q, sender) : null;
  },
  async buildTransaction(quote, params): Promise<BuiltRoute> {
    const raw = quote.raw as { quote: LifiQuote; sender: Address } | undefined;
    let q = raw?.quote;
    if (!q || raw?.sender.toLowerCase() !== params.sender.toLowerCase()) {
      q = (await requestQuote(params, params.sender)) ?? undefined;
      if (!q) throw new ProviderError("lifi", "LI.FI no longer has a route for this transfer.");
    }
    const tx = q.transactionRequest;
    if (!tx?.to || !tx.data) throw new ProviderError("lifi", "LI.FI returned no transaction for this route.");
    const approvals: BuiltRoute["approvals"] = [];
    if (!isNative(q.action.fromToken.address)) {
      approvals.push({ chainId: q.action.fromChainId, token: ref(q.action.fromToken), spender: q.estimate.approvalAddress, amount: hexToBigInt(q.action.fromAmount, quote.amountIn) });
    }
    return {
      approvals,
      transaction: {
        chainId: tx.chainId ?? q.action.fromChainId,
        to: tx.to,
        data: tx.data,
        value: hexToBigInt(tx.value),
        gas: tx.gasLimit ? hexToBigInt(tx.gasLimit) : undefined,
      },
      tracking: { provider: "lifi", sourceChain: q.action.fromChainId, destinationChain: q.action.toChainId, bridge: q.tool },
    };
  },
  async getStatus(tracking: TrackingRef): Promise<RouteStatus> {
    if (!tracking.txHash) return { state: "pending", updatedAt: Date.now() };
    const search = new URLSearchParams({ txHash: tracking.txHash, fromChain: String(tracking.sourceChain), toChain: String(tracking.destinationChain) });
    if (tracking.bridge) search.set("bridge", tracking.bridge);
    const { ok, body } = await fetchJson<LifiStatus>("lifi", `${BASE}/status?${search.toString()}`);
    if (!ok || !body) return { state: "unknown", sourceTxHash: tracking.txHash, updatedAt: Date.now(), message: "Status unavailable" };
    const base = { sourceTxHash: body.sending?.txHash ?? tracking.txHash, destinationTxHash: body.receiving?.txHash, updatedAt: Date.now(), message: body.substatusMessage };
    switch (body.status) {
      case "DONE":
        return { ...base, state: body.substatus === "REFUNDED" ? "refunded" : "arrived" };
      case "FAILED":
        return { ...base, state: "failed" };
      case "INVALID":
        return { ...base, state: "unknown" };
      default:
        return { ...base, state: "in_transit" };
    }
  },
};
