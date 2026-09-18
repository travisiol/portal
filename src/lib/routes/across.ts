import { encodeFunctionData, type Address, type Hex } from "viem";
import { ACROSS_SPOKE_POOL } from "@/config/contracts";
import { providerMeta } from "@/config/providers";
import { toTokenRef } from "@/config/tokens";
import { acrossSpokePoolAbi, ACROSS_DEPOSIT_GAS } from "@/lib/contracts/across";
import { ProviderError } from "@/lib/errors";
import { nativePriceUsd, tokenPriceUsd } from "@/lib/prices";
import type { QuoteParams, RouteProvider } from "@/types/provider";
import type { BuiltRoute, RouteQuote, RouteStatus, RouteStep, TrackingRef } from "@/types/route";
import type { TokenRef } from "@/types/token";
import { chainLabel, fetchJson, gasPriceOf, hexToBigInt, nativeRef, quoteId, usdOf } from "./shared";

/**
 * Across — https://docs.across.to/reference/api-reference
 * Public `suggested-fees` gives the fee parameters; the deposit is encoded
 * locally against the SpokePool the API names. Verified for chain 4663 on
 * 2026-09-18 (Ethereum → Robinhood Chain, ETH).
 */
const BASE = "https://app.across.to/api";

export interface AcrossFees {
  estimatedFillTimeSec: number;
  timestamp: string;
  isAmountTooLow: boolean;
  quoteBlock?: string;
  exclusiveRelayer: Address;
  exclusivityDeadline: number;
  spokePoolAddress: Address;
  destinationSpokePoolAddress?: Address;
  totalRelayFee: { pct: string; total: string };
  relayerCapitalFee?: { pct: string; total: string };
  relayerGasFee?: { pct: string; total: string };
  lpFee: { pct: string; total: string };
  limits: { minDeposit: string; maxDeposit: string; maxDepositInstant?: string };
  fillDeadline: string;
  outputAmount: string;
  inputToken: { address: Address; symbol: string; decimals: number; chainId: number };
  outputToken: { address: Address; symbol: string; decimals: number; chainId: number };
  id?: string;
  message?: string;
}

interface AcrossStatus {
  status: "pending" | "filled" | "expired" | "refunded" | "slowFillRequested" | string;
  fillTx?: Hex;
  depositTxHash?: Hex;
  depositRefundTxHash?: Hex;
}

/** Across moves the ERC-20 representation: native ETH goes in as WETH and comes out as ETH for EOAs. */
const inputAddressFor = (params: QuoteParams): Address | undefined => {
  const token = params.sourceToken;
  if (token.kind === "native") return params.sourceChain.wrappedNative;
  return token.addresses[params.sourceChain.key];
};

const outputAddressFor = (params: QuoteParams): Address | undefined => {
  const token = params.destinationToken;
  if (token.kind === "native") return "0x0000000000000000000000000000000000000000";
  return token.addresses[params.destinationChain.key];
};

const feesUrl = (params: QuoteParams, recipient?: Address) => {
  const inputToken = inputAddressFor(params);
  const outputToken = outputAddressFor(params);
  if (!inputToken || !outputToken) return undefined;
  const search = new URLSearchParams({
    inputToken,
    outputToken,
    originChainId: String(params.sourceChain.id),
    destinationChainId: String(params.destinationChain.id),
    amount: params.amountIn.toString(),
  });
  if (recipient) search.set("recipient", recipient);
  return `${BASE}/suggested-fees?${search.toString()}`;
};

async function requestFees(params: QuoteParams, recipient?: Address): Promise<AcrossFees | null> {
  const url = feesUrl(params, recipient);
  if (!url) return null;
  const { ok, status, body } = await fetchJson<AcrossFees>("across", url, { signal: params.signal });
  if (!ok) {
    if (status === 400 || status === 404 || status === 422) return null; // unsupported token / route
    throw new ProviderError("across", body?.message ?? `Across answered ${status}`);
  }
  if (!body?.outputAmount) return null;
  return body;
}

/** Exported for the fixture tests. */
export function normalizeAcross(params: QuoteParams, fees: AcrossFees, ctx: { priceIn?: number; priceOut?: number; nativePrice?: number; gasPrice?: bigint }): RouteQuote | null {
  if (fees.isAmountTooLow) return null;
  const sourceRef: TokenRef = toTokenRef(params.sourceToken, params.sourceChain);
  const destinationRef: TokenRef = toTokenRef(params.destinationToken, params.destinationChain);
  const amountIn = params.amountIn;
  const estimatedAmountOut = hexToBigInt(fees.outputAmount);
  const relayFee = hexToBigInt(fees.totalRelayFee.total);
  const lpFee = hexToBigInt(fees.lpFee.total);

  const gasAmount = ctx.gasPrice !== undefined ? ctx.gasPrice * ACROSS_DEPOSIT_GAS : 0n;
  const steps: RouteStep[] = [];
  if (params.sourceToken.kind === "erc20") steps.push({ kind: "approve", chainId: sourceRef.chainId, label: `APPROVE ${sourceRef.symbol}`, tokenIn: sourceRef });
  steps.push({ kind: "bridge", chainId: sourceRef.chainId, label: "ACROSS", detail: "intent, filled by relayers", tokenIn: sourceRef, tokenOut: destinationRef });
  steps.push({ kind: "receive", chainId: destinationRef.chainId, label: chainLabel(destinationRef.chainId), tokenOut: destinationRef });

  const notes = [`SpokePool ${fees.spokePoolAddress}`];
  const known = ACROSS_SPOKE_POOL[params.sourceChain.id];
  if (known && known.toLowerCase() !== fees.spokePoolAddress.toLowerCase()) notes.push("SpokePool address differs from the configured table; the API value is used.");

  return {
    id: quoteId("across"),
    provider: "across",
    providerName: "Across",
    source: "live",
    sourceChain: params.sourceChain.id,
    destinationChain: params.destinationChain.id,
    sourceToken: sourceRef,
    destinationToken: destinationRef,
    amountIn,
    estimatedAmountOut,
    minimumAmountOut: estimatedAmountOut,
    providerFees: [
      { label: "Relayer fee", amount: relayFee, token: sourceRef, usd: usdOf(relayFee, sourceRef.decimals, ctx.priceIn) },
      ...(lpFee > 0n ? [{ label: "LP fee", amount: lpFee, token: sourceRef, usd: usdOf(lpFee, sourceRef.decimals, ctx.priceIn) }] : []),
    ],
    estimatedGas: { amount: gasAmount, token: nativeRef(params.sourceChain), usd: gasAmount > 0n ? usdOf(gasAmount, 18, ctx.nativePrice) : undefined },
    estimatedDuration: Number(fees.estimatedFillTimeSec) || 60,
    transactionSteps: steps,
    quoteExpiration: Date.now() + 120_000,
    amountInUsd: usdOf(amountIn, sourceRef.decimals, ctx.priceIn),
    amountOutUsd: usdOf(estimatedAmountOut, destinationRef.decimals, ctx.priceOut),
    executable: true,
    notes,
    raw: { fees, recipient: undefined as Address | undefined },
  };
}

export const acrossProvider: RouteProvider = {
  id: "across",
  name: "Across",
  kind: "live",
  status: "live",
  description: providerMeta("across")!.description,
  supports: ({ sourceChain, destinationChain, token }) =>
    sourceChain.id !== destinationChain.id &&
    sourceChain.providerKeys.across !== undefined &&
    destinationChain.providerKeys.across !== undefined &&
    token.addresses[destinationChain.key] !== undefined &&
    (token.kind === "erc20" || sourceChain.wrappedNative !== undefined),
  async getQuote(params) {
    if (params.sourceToken.symbol !== params.destinationToken.symbol) return null; // same asset only
    const fees = await requestFees(params, params.sender);
    if (!fees) return null;
    const sourceRef = toTokenRef(params.sourceToken, params.sourceChain);
    const destinationRef = toTokenRef(params.destinationToken, params.destinationChain);
    const [priceIn, priceOut, nativePrice, gasPrice] = await Promise.all([
      tokenPriceUsd(sourceRef.chainId, sourceRef.address, params.signal),
      tokenPriceUsd(destinationRef.chainId, destinationRef.address, params.signal),
      nativePriceUsd(params.sourceChain.id, params.signal),
      gasPriceOf(params.sourceChain.id),
    ]);
    const quote = normalizeAcross(params, fees, { priceIn, priceOut, nativePrice, gasPrice });
    if (quote) quote.raw = { fees, recipient: params.sender };
    return quote;
  },
  async buildTransaction(quote, params): Promise<BuiltRoute> {
    const raw = quote.raw as { fees: AcrossFees; recipient?: Address } | undefined;
    let fees = raw?.fees;
    if (!fees || raw?.recipient?.toLowerCase() !== params.sender.toLowerCase()) {
      fees = (await requestFees(params, params.sender)) ?? undefined;
      if (!fees) throw new ProviderError("across", "Across no longer quotes this transfer.");
    }
    if (fees.isAmountTooLow) throw new ProviderError("across", "Amount is below the Across minimum for this route.");
    const inputToken = inputAddressFor(params);
    if (!inputToken) throw new ProviderError("across", "No input token for this chain.");
    const recipient = params.recipient ?? params.sender;
    const isNativeIn = params.sourceToken.kind === "native";
    const data = encodeFunctionData({
      abi: acrossSpokePoolAbi,
      functionName: "depositV3",
      args: [
        params.sender,
        recipient,
        inputToken,
        fees.outputToken.address,
        params.amountIn,
        hexToBigInt(fees.outputAmount),
        BigInt(params.destinationChain.id),
        fees.exclusiveRelayer,
        Number(fees.timestamp),
        Number(fees.fillDeadline),
        Number(fees.exclusivityDeadline),
        "0x",
      ],
    });
    const approvals: BuiltRoute["approvals"] = isNativeIn
      ? []
      : [{ chainId: params.sourceChain.id, token: toTokenRef(params.sourceToken, params.sourceChain), spender: fees.spokePoolAddress, amount: params.amountIn }];
    return {
      approvals,
      transaction: { chainId: params.sourceChain.id, to: fees.spokePoolAddress, data, value: isNativeIn ? params.amountIn : 0n },
      tracking: { provider: "across", sourceChain: params.sourceChain.id, destinationChain: params.destinationChain.id },
    };
  },
  async getStatus(tracking: TrackingRef): Promise<RouteStatus> {
    if (!tracking.txHash) return { state: "pending", updatedAt: Date.now() };
    const search = new URLSearchParams({ originChainId: String(tracking.sourceChain), depositTxHash: tracking.txHash });
    const { ok, body } = await fetchJson<AcrossStatus>("across", `${BASE}/deposit/status?${search.toString()}`);
    if (!ok || !body) return { state: "in_transit", sourceTxHash: tracking.txHash, updatedAt: Date.now(), message: "Waiting for Across to index the deposit" };
    const base = { sourceTxHash: tracking.txHash, destinationTxHash: body.fillTx, updatedAt: Date.now() };
    switch (body.status) {
      case "filled":
        return { ...base, state: "arrived" };
      case "refunded":
      case "expired":
        return { ...base, state: "refunded", message: "Deposit was not filled and is being refunded." };
      case "pending":
      case "slowFillRequested":
        return { ...base, state: "in_transit" };
      default:
        return { ...base, state: "unknown", message: body.status };
    }
  },
};
