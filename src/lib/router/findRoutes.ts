import { QUOTE_TIMEOUT_MS } from "@/lib/env";
import { errorMessage } from "@/lib/errors";
import type { QuoteParams, RouteProvider } from "@/types/provider";
import type { ProviderId, RouteQuote } from "@/types/route";

export interface RouteFailure {
  provider: ProviderId;
  providerName: string;
  message: string;
}

export interface RouteSearch {
  quotes: RouteQuote[];
  failures: RouteFailure[];
  /** Providers that could not quote this pair at all (not asked). */
  skipped: ProviderId[];
  searchedAt: number;
}

/**
 * Providers price the same token with their own oracles, so their USD figures
 * cannot be compared directly — a smaller ETH amount would "win" on value with
 * a higher price feed. Every quote for a token is re-valued at the median
 * implied price across the quotes that carry one; quotes without a USD value
 * inherit it. Exported for the tests.
 */
export function normalizePrices(quotes: RouteQuote[]): RouteQuote[] {
  const implied = new Map<string, number[]>();
  const key = (t: { chainId: number; address: string }) => `${t.chainId}:${t.address.toLowerCase()}`;
  const push = (t: { chainId: number; address: string; decimals: number }, amount: bigint, usd: number | undefined) => {
    if (usd === undefined || amount <= 0n) return;
    const price = usd / (Number(amount) / 10 ** t.decimals);
    if (Number.isFinite(price) && price > 0) implied.set(key(t), [...(implied.get(key(t)) ?? []), price]);
  };
  for (const q of quotes) {
    push(q.destinationToken, q.estimatedAmountOut, q.amountOutUsd);
    push(q.sourceToken, q.amountIn, q.amountInUsd);
  }
  const median = (xs: number[]) => {
    const s = [...xs].sort((a, b) => a - b);
    return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
  };
  const price = new Map<string, number>();
  for (const [k, xs] of implied) price.set(k, median(xs));
  return quotes.map((q) => {
    const pOut = price.get(key(q.destinationToken));
    const pIn = price.get(key(q.sourceToken));
    return {
      ...q,
      amountOutUsd: pOut !== undefined ? (Number(q.estimatedAmountOut) / 10 ** q.destinationToken.decimals) * pOut : q.amountOutUsd,
      amountInUsd: pIn !== undefined ? (Number(q.amountIn) / 10 ** q.sourceToken.decimals) * pIn : q.amountInUsd,
    };
  });
}

/**
 * Fan out one quote request to every provider that supports the pair. A slow
 * or failing provider never hides the others: failures are returned next to
 * the quotes so the UI can show them. Providers not asked are listed too.
 */
export async function findRoutes(params: QuoteParams, providers: readonly RouteProvider[]): Promise<RouteSearch> {
  const pair = { sourceChain: params.sourceChain, destinationChain: params.destinationChain, token: params.sourceToken };
  const asked = providers.filter((p) => p.supports(pair));
  const skipped = providers.filter((p) => !p.supports(pair)).map((p) => p.id);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), QUOTE_TIMEOUT_MS);
  const outer = params.signal;
  outer?.addEventListener("abort", () => controller.abort(), { once: true });

  const settled = await Promise.allSettled(asked.map((p) => p.getQuote({ ...params, signal: controller.signal })));
  clearTimeout(timer);

  const quotes: RouteQuote[] = [];
  const failures: RouteFailure[] = [];
  settled.forEach((result, i) => {
    const provider = asked[i];
    if (result.status === "fulfilled") {
      if (result.value) quotes.push(result.value);
    } else {
      failures.push({ provider: provider.id, providerName: provider.name, message: errorMessage(result.reason) });
    }
  });
  return { quotes: normalizePrices(quotes), failures, skipped, searchedAt: Date.now() };
}
