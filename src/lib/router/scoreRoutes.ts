import type { Preference, RouteQuote, RouteRanking, ScoredRoute } from "@/types/route";

/**
 * Route scoring. A route is only ever labelled BEST ROUTE when this ran over
 * at least two quotes; with a single quote the UI says ONLY ROUTE.
 *
 * Inputs per quote: amount received (USD when known, token units otherwise),
 * estimated gas, provider fees, estimated time, and availability (a quote the
 * user cannot execute here is penalised, but only when an executable
 * alternative exists — in DEMO mode nothing is executable and nothing is
 * penalised).
 */
const WEIGHTS: Record<Preference, { value: number; speed: number; fees: number }> = {
  value: { value: 0.6, speed: 0.25, fees: 0.15 },
  fastest: { value: 0.3, speed: 0.6, fees: 0.1 },
  fees: { value: 0.3, speed: 0.1, fees: 0.6 },
};

const UNAVAILABLE_PENALTY = 15;

const sum = (values: (number | undefined)[]): number | undefined => {
  let total = 0;
  for (const v of values) {
    if (v === undefined || !Number.isFinite(v)) return undefined;
    total += v;
  }
  return total;
};

/**
 * 0..1 within [min, max], but the spread never shrinks below `floor`: a
 * $0.25 difference on a $2,500 transfer must not stretch to the full range,
 * or it would outweigh time, fees and availability.
 */
const normalize = (value: number, min: number, max: number, floor = 0): number => {
  const range = Math.max(max - min, floor);
  return range < 1e-9 ? 1 : Math.min(1, (value - min) / range);
};

export interface RouteMetrics {
  quote: RouteQuote;
  amountOutUsd?: number;
  feesUsd?: number;
  gasUsd?: number;
  totalCostUsd?: number;
  netValueUsd?: number;
  /** Amount out in destination token units — the fallback when USD is unknown. */
  amountOutUnits: number;
  duration: number;
}

export const metricsOf = (quote: RouteQuote): RouteMetrics => {
  const feesUsd = sum(quote.providerFees.map((f) => f.usd));
  const gasUsd = quote.estimatedGas.usd;
  const amountOutUsd = quote.amountOutUsd;
  return {
    quote,
    amountOutUsd,
    feesUsd,
    gasUsd,
    totalCostUsd: sum([feesUsd, gasUsd]),
    netValueUsd: amountOutUsd !== undefined && gasUsd !== undefined ? amountOutUsd - gasUsd : undefined,
    amountOutUnits: Number(quote.estimatedAmountOut) / 10 ** quote.destinationToken.decimals,
    duration: Math.max(1, quote.estimatedDuration),
  };
};

export function scoreRoutes(quotes: RouteQuote[], preference: Preference = "value"): RouteRanking {
  const metrics = quotes.map(metricsOf);
  if (metrics.length === 0) return { preference, ranked: [], winners: {} };

  const usdKnown = metrics.every((m) => m.netValueUsd !== undefined);
  const valueOf = (m: RouteMetrics) => (usdKnown ? m.netValueUsd! : m.amountOutUnits);
  const feeKnown = metrics.every((m) => m.totalCostUsd !== undefined);
  const feeOf = (m: RouteMetrics) => (feeKnown ? m.totalCostUsd! : m.quote.providerFees.reduce((acc, f) => acc + Number(f.amount) / 10 ** f.token.decimals, 0));

  const values = metrics.map(valueOf);
  const fees = metrics.map(feeOf);
  const logDurations = metrics.map((m) => Math.log(m.duration));
  const vMin = Math.min(...values), vMax = Math.max(...values);
  const fMin = Math.min(...fees), fMax = Math.max(...fees);
  const dMin = Math.min(...logDurations), dMax = Math.max(...logDurations);
  const anyExecutable = metrics.some((m) => m.quote.executable);
  const w = WEIGHTS[preference];

  const scored: ScoredRoute[] = metrics.map((m, i) => {
    const valueNorm = normalize(values[i], vMin, vMax, Math.abs(vMax) * 0.005);
    const feeNorm = 1 - normalize(fees[i], fMin, fMax, feeKnown ? 0.5 : 0);
    const speedNorm = 1 - normalize(logDurations[i], dMin, dMax);
    let score = 100 * (w.value * valueNorm + w.speed * speedNorm + w.fees * feeNorm);
    if (anyExecutable && !m.quote.executable) score -= UNAVAILABLE_PENALTY;
    return { quote: m.quote, score: Math.round(Math.max(0, Math.min(100, score)) * 10) / 10, rank: 0, netValueUsd: m.netValueUsd, totalCostUsd: m.totalCostUsd, feesUsd: m.feesUsd };
  });

  scored.sort((a, b) => b.score - a.score || Number(b.quote.estimatedAmountOut - a.quote.estimatedAmountOut));
  scored.forEach((s, i) => (s.rank = i + 1));

  const winners: RouteRanking["winners"] = {};
  if (metrics.length >= 2) {
    const byValue = [...metrics].sort((a, b) => valueOf(b) - valueOf(a))[0];
    const byFees = [...metrics].sort((a, b) => feeOf(a) - feeOf(b))[0];
    const bySpeed = [...metrics].sort((a, b) => a.duration - b.duration || valueOf(b) - valueOf(a))[0];
    winners.value = byValue.quote.id;
    winners.fees = byFees.quote.id;
    winners.fastest = bySpeed.quote.id;
  }

  return { preference, ranked: scored, best: metrics.length >= 2 ? scored[0] : undefined, winners };
}

export const PREFERENCE_LABEL: Record<Preference, string> = { value: "BEST VALUE", fastest: "FASTEST", fees: "LOWEST FEES" };
