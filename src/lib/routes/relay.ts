import { decodeFunctionData, type Address, type Hex } from "viem";
import { providerMeta } from "@/config/providers";
import { toTokenRef } from "@/config/tokens";
import { erc20Abi } from "@/lib/contracts/erc20";
import { PLACEHOLDER_ADDRESS } from "@/lib/env";
import { ProviderError, ProviderNotConfiguredError } from "@/lib/errors";
import type { QuoteParams, RouteProvider } from "@/types/provider";
import type { BuiltRoute, Fee, RouteQuote, RouteStatus, RouteStep, TrackingRef } from "@/types/route";
import type { TokenRef } from "@/types/token";
import { chainLabel, fetchJson, hexToBigInt, isNative, nativeRef, quoteId } from "./shared";

/**
 * Relay — https://docs.relay.link/references/api
 * `POST /price` is keyless and gives the indicative quote (fees, output,
 * time). `POST /quote` (transaction data) requires an API key, which lives on
 * the server only: the browser calls /api/relay/quote and the route handler
 * adds RELAY_API_KEY. Without the key the adapter still quotes, flagged
 * `executable: false`, so Relay shows in comparisons but cannot be opened.
 */
const BASE = "https://api.relay.link";

interface RelayCurrency {
  chainId: number;
  address: Address;
  symbol: string;
  name: string;
  decimals: number;
}

interface RelayAmount {
  currency: RelayCurrency;
  amount: string;
  amountFormatted: string;
  amountUsd?: string;
  minimumAmount?: string;
}

export interface RelayPrice {
  fees: { gas?: RelayAmount; relayer?: RelayAmount; relayerGas?: RelayAmount; relayerService?: RelayAmount; app?: RelayAmount };
  details: {
    operation?: string;
    sender?: Address;
    recipient?: Address;
    currencyIn: RelayAmount;
    currencyOut: RelayAmount;
    timeEstimate?: number;
    rate?: string | number;
    totalImpact?: { usd?: string; percent?: string };
  };
  steps?: RelayStep[];
  message?: string;
  errorCode?: string;
}

interface RelayStep {
  id: string;
  action?: string;
  description?: string;
  kind: "transaction" | "signature";
  requestId?: string;
  items: { status?: string; data: { from?: Address; to: Address; data: Hex; value?: string; chainId: number; gas?: string }; check?: { endpoint: string; method: string } }[];
}

interface RelayStatus {
  status: "refund" | "delayed" | "waiting" | "failure" | "pending" | "success" | string;
  inTxHashes?: Hex[];
  txHashes?: Hex[];
  details?: string;
}

const ref = (c: RelayCurrency): TokenRef => ({ chainId: c.chainId, address: c.address, symbol: c.symbol, decimals: c.decimals });

const body = (params: QuoteParams, sender: Address) =>
  JSON.stringify({
    user: sender,
    recipient: params.recipient ?? sender,
    originChainId: params.sourceChain.providerKeys.relay ?? params.sourceChain.id,
    destinationChainId: params.destinationChain.providerKeys.relay ?? params.destinationChain.id,
    originCurrency: toTokenRef(params.sourceToken, params.sourceChain).address,
    destinationCurrency: toTokenRef(params.destinationToken, params.destinationChain).address,
    amount: params.amountIn.toString(),
    tradeType: "EXACT_INPUT",
    slippageTolerance: String(params.slippageBps),
    referrer: "portal",
  });

let executionAvailable: Promise<boolean> | undefined;

/** Asks our own server once whether RELAY_API_KEY is configured. */
const relayExecutionConfigured = (): Promise<boolean> => {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (!executionAvailable) {
    executionAvailable = fetch("/api/relay/status")
      .then((r) => (r.ok ? (r.json() as Promise<{ configured: boolean }>) : { configured: false }))
      .then((j) => Boolean(j.configured))
      .catch(() => false);
  }
  return executionAvailable;
};

/** Exported for the fixture tests. */
export function normalizeRelay(params: QuoteParams, price: RelayPrice, executable: boolean): RouteQuote {
  const inRef = ref(price.details.currencyIn.currency);
  const outRef = ref(price.details.currencyOut.currency);
  const feeOf = (label: string, a?: RelayAmount): Fee | undefined =>
    a && hexToBigInt(a.amount) > 0n ? { label, amount: hexToBigInt(a.amount), token: ref(a.currency), usd: a.amountUsd !== undefined ? Number(a.amountUsd) : undefined } : undefined;
  const providerFees = [feeOf("Relayer service", price.fees.relayerService), feeOf("Relayer gas", price.fees.relayerGas), feeOf("App fee", price.fees.app)].filter((f): f is Fee => Boolean(f));

  const gas = price.fees.gas;
  const estimatedGas = gas
    ? { amount: hexToBigInt(gas.amount), token: ref(gas.currency), usd: gas.amountUsd !== undefined ? Number(gas.amountUsd) : undefined }
    : { amount: 0n, token: nativeRef(params.sourceChain), usd: undefined };

  const steps: RouteStep[] = [];
  if (!isNative(inRef.address)) steps.push({ kind: "approve", chainId: inRef.chainId, label: `APPROVE ${inRef.symbol}`, tokenIn: inRef });
  if (inRef.symbol !== outRef.symbol) {
    steps.push({ kind: "bridge", chainId: inRef.chainId, label: "RELAY", detail: "solver fills on destination", tokenIn: inRef, tokenOut: outRef });
    steps.push({ kind: "swap", chainId: outRef.chainId, label: `${inRef.symbol} → ${outRef.symbol}`, detail: "solver swap", tokenOut: outRef });
  } else {
    steps.push({ kind: "bridge", chainId: inRef.chainId, label: "RELAY", detail: "solver fills on destination", tokenIn: inRef, tokenOut: outRef });
  }
  steps.push({ kind: "receive", chainId: outRef.chainId, label: chainLabel(outRef.chainId), tokenOut: outRef });

  const notes: string[] = [];
  if (!executable) notes.push("Quote shown for comparison only — Relay execution needs RELAY_API_KEY on the server.");
  if (price.details.totalImpact?.percent) notes.push(`Price impact ${price.details.totalImpact.percent}%`);

  return {
    id: quoteId("relay"),
    provider: "relay",
    providerName: "Relay",
    source: "live",
    sourceChain: params.sourceChain.id,
    destinationChain: params.destinationChain.id,
    sourceToken: inRef,
    destinationToken: outRef,
    amountIn: hexToBigInt(price.details.currencyIn.amount, params.amountIn),
    estimatedAmountOut: hexToBigInt(price.details.currencyOut.amount),
    minimumAmountOut: price.details.currencyOut.minimumAmount ? hexToBigInt(price.details.currencyOut.minimumAmount) : undefined,
    providerFees,
    estimatedGas,
    estimatedDuration: Math.max(Number(price.details.timeEstimate) || 0, 8),
    transactionSteps: steps,
    quoteExpiration: Date.now() + 30_000,
    amountInUsd: price.details.currencyIn.amountUsd !== undefined ? Number(price.details.currencyIn.amountUsd) : undefined,
    amountOutUsd: price.details.currencyOut.amountUsd !== undefined ? Number(price.details.currencyOut.amountUsd) : undefined,
    executable,
    notes,
    raw: { price },
  };
}

export const relayProvider: RouteProvider = {
  id: "relay",
  name: "Relay",
  kind: "live",
  status: "needs-key",
  description: providerMeta("relay")!.description,
  supports: ({ sourceChain, destinationChain }) =>
    sourceChain.id !== destinationChain.id && sourceChain.providerKeys.relay !== undefined && destinationChain.providerKeys.relay !== undefined,
  async getQuote(params) {
    const sender = params.sender ?? PLACEHOLDER_ADDRESS;
    const [{ ok, status, body: price }, executable] = await Promise.all([
      fetchJson<RelayPrice>("relay", `${BASE}/price`, { method: "POST", headers: { "content-type": "application/json" }, body: body(params, sender), signal: params.signal }),
      relayExecutionConfigured(),
    ]);
    if (!ok) {
      if (status === 400 || status === 404 || status === 422) return null;
      throw new ProviderError("relay", price?.message ?? `Relay answered ${status}`);
    }
    if (!price?.details?.currencyOut) return null;
    return normalizeRelay(params, price, executable);
  },
  async buildTransaction(quote, params): Promise<BuiltRoute> {
    const response = await fetch("/api/relay/quote", { method: "POST", headers: { "content-type": "application/json" }, body: body(params, params.sender) });
    if (response.status === 501) throw new ProviderNotConfiguredError("relay", "Relay execution needs RELAY_API_KEY on the server.");
    const full = (await response.json().catch(() => undefined)) as RelayPrice | undefined;
    if (!response.ok || !full?.steps?.length) throw new ProviderError("relay", full?.message ?? `Relay quote failed (${response.status})`);

    const approvals: BuiltRoute["approvals"] = [];
    let transaction: BuiltRoute["transaction"] | undefined;
    let requestId: string | undefined;
    for (const step of full.steps) {
      if (step.kind !== "transaction") throw new ProviderError("relay", `Relay asked for a ${step.kind} step, which PORTAL does not sign.`);
      for (const item of step.items) {
        const tx = item.data;
        if (step.id === "approve") {
          const decoded = decodeFunctionData({ abi: erc20Abi, data: tx.data });
          if (decoded.functionName !== "approve") throw new ProviderError("relay", "Unexpected approval step.");
          const [spender, amount] = decoded.args as [Address, bigint];
          approvals.push({ chainId: tx.chainId, token: quote.sourceToken, spender, amount });
        } else if (!transaction) {
          transaction = { chainId: tx.chainId, to: tx.to, data: tx.data, value: hexToBigInt(tx.value), gas: tx.gas ? hexToBigInt(tx.gas) : undefined };
          requestId = step.requestId;
        } else {
          throw new ProviderError("relay", "Relay returned more than one transaction; PORTAL only signs single-transaction routes.");
        }
      }
    }
    if (!transaction) throw new ProviderError("relay", "Relay returned no transaction.");
    return { approvals, transaction, tracking: { provider: "relay", sourceChain: params.sourceChain.id, destinationChain: params.destinationChain.id, requestId } };
  },
  async getStatus(tracking: TrackingRef): Promise<RouteStatus> {
    if (!tracking.requestId) return { state: "unknown", sourceTxHash: tracking.txHash, updatedAt: Date.now(), message: "No Relay request id" };
    const { ok, body: s } = await fetchJson<RelayStatus>("relay", `${BASE}/intents/status/v2?requestId=${encodeURIComponent(tracking.requestId)}`);
    if (!ok || !s) return { state: "in_transit", sourceTxHash: tracking.txHash, updatedAt: Date.now() };
    const base = { sourceTxHash: s.inTxHashes?.[0] ?? tracking.txHash, destinationTxHash: s.txHashes?.[0], updatedAt: Date.now(), message: s.details };
    switch (s.status) {
      case "success":
        return { ...base, state: "arrived" };
      case "failure":
        return { ...base, state: "failed" };
      case "refund":
        return { ...base, state: "refunded" };
      case "waiting":
        return { ...base, state: "source_confirmed" };
      default:
        return { ...base, state: "in_transit" };
    }
  },
};
