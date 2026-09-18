import assert from "node:assert/strict";
import { test } from "node:test";
import { scoreRoutes } from "@/lib/router/scoreRoutes";
import type { RouteQuote } from "@/types/route";

const eth = (chainId: number) => ({ chainId, address: "0x0000000000000000000000000000000000000000" as const, symbol: "ETH", decimals: 18 });

const quote = (over: Partial<RouteQuote> & { provider: RouteQuote["provider"] }): RouteQuote => ({
  id: `${over.provider}-1`,
  providerName: over.provider,
  source: "live",
  sourceChain: 1,
  destinationChain: 4663,
  sourceToken: eth(1),
  destinationToken: eth(4663),
  amountIn: 10n ** 18n,
  estimatedAmountOut: 999_000_000_000_000_000n,
  providerFees: [],
  estimatedGas: { amount: 0n, token: eth(1), usd: 1 },
  estimatedDuration: 20,
  transactionSteps: [],
  quoteExpiration: Date.now() + 60_000,
  amountOutUsd: 2497.5,
  executable: true,
  ...over,
});

test("winners are computed per category from real numbers", () => {
  const relay = quote({ provider: "relay", estimatedAmountOut: 999_400_000_000_000_000n, amountOutUsd: 2498.5, estimatedDuration: 14, estimatedGas: { amount: 0n, token: eth(1), usd: 1.2 }, providerFees: [{ label: "fee", amount: 600_000_000_000_000n, token: eth(1), usd: 1.5 }] });
  const across = quote({ provider: "across", estimatedAmountOut: 999_930_000_000_000_000n, amountOutUsd: 2499.8, estimatedDuration: 20, estimatedGas: { amount: 0n, token: eth(1), usd: 1.2 }, providerFees: [{ label: "fee", amount: 70_000_000_000_000n, token: eth(1), usd: 0.17 }] });
  const canonical = quote({ provider: "canonical", estimatedAmountOut: 10n ** 18n, amountOutUsd: 2500, estimatedDuration: 480, estimatedGas: { amount: 0n, token: eth(1), usd: 3.4 }, providerFees: [] });
  const ranking = scoreRoutes([relay, across, canonical], "value");
  assert.equal(ranking.winners.fastest, relay.id);
  assert.equal(ranking.winners.fees, across.id); // 0.17 + 1.2 < 0 + 3.4 < 1.5 + 1.2
  assert.equal(ranking.winners.value, across.id); // net: relay 2497.3, across 2498.6, canonical 2496.6
});

test("best value is net of gas, so the highest gross amount does not automatically win", () => {
  const across = quote({ provider: "across", estimatedAmountOut: 999_930_000_000_000_000n, amountOutUsd: 2499.8, estimatedGas: { amount: 0n, token: eth(1), usd: 1.2 } });
  const canonical = quote({ provider: "canonical", estimatedAmountOut: 10n ** 18n, amountOutUsd: 2500, estimatedDuration: 480, estimatedGas: { amount: 0n, token: eth(1), usd: 3.4 } });
  const ranking = scoreRoutes([across, canonical], "value");
  assert.equal(ranking.winners.value, across.id);
  assert.equal(ranking.best?.quote.id, across.id);
});

test("a single quote is never labelled best", () => {
  const ranking = scoreRoutes([quote({ provider: "lifi" })], "value");
  assert.equal(ranking.ranked.length, 1);
  assert.equal(ranking.best, undefined);
  assert.deepEqual(ranking.winners, {});
});

test("preference changes the order", () => {
  const fast = quote({ provider: "relay", estimatedAmountOut: 990_000_000_000_000_000n, amountOutUsd: 2475, estimatedDuration: 10 });
  const rich = quote({ provider: "across", estimatedAmountOut: 999_900_000_000_000_000n, amountOutUsd: 2499.75, estimatedDuration: 600 });
  assert.equal(scoreRoutes([fast, rich], "fastest").ranked[0].quote.id, fast.id);
  assert.equal(scoreRoutes([fast, rich], "value").ranked[0].quote.id, rich.id);
});

test("non-executable quotes are penalised only when an executable alternative exists", () => {
  const a = quote({ provider: "relay", executable: false, estimatedAmountOut: 999_500_000_000_000_000n, amountOutUsd: 2498.75 });
  const b = quote({ provider: "across", executable: true, estimatedAmountOut: 999_400_000_000_000_000n, amountOutUsd: 2498.5 });
  const mixed = scoreRoutes([a, b], "value");
  assert.equal(mixed.ranked[0].quote.id, b.id);
  const demoLike = scoreRoutes([{ ...a, id: "x" }, { ...b, id: "y", executable: false }], "value");
  assert.equal(demoLike.ranked[0].quote.id, "x");
});

test("scores fall back to token units when USD is unknown", () => {
  const a = quote({ provider: "relay", amountOutUsd: undefined, estimatedGas: { amount: 0n, token: eth(1), usd: undefined }, estimatedAmountOut: 999_000_000_000_000_000n });
  const b = quote({ provider: "across", amountOutUsd: undefined, estimatedGas: { amount: 0n, token: eth(1), usd: undefined }, estimatedAmountOut: 999_500_000_000_000_000n });
  const ranking = scoreRoutes([a, b], "value");
  assert.equal(ranking.winners.value, b.id);
  assert.ok(ranking.ranked.every((r) => Number.isFinite(r.score)));
});

test("quotes for the same token are re-valued at one median price before scoring", async () => {
  const { normalizePrices } = await import("@/lib/router/findRoutes");
  const a = quote({ provider: "relay", estimatedAmountOut: 998_000_000_000_000_000n, amountOutUsd: 2520 * 0.998 }); // pricey oracle
  const b = quote({ provider: "lifi", estimatedAmountOut: 999_700_000_000_000_000n, amountOutUsd: 2500 * 0.9997 });
  const c = quote({ provider: "across", estimatedAmountOut: 999_700_000_000_000_000n, amountOutUsd: 2503 * 0.9997 });
  const [na, nb] = normalizePrices([a, b, c]);
  assert.ok(nb.amountOutUsd! > na.amountOutUsd!, "more ETH must be worth more USD once the price is shared");
  const ranking = scoreRoutes(normalizePrices([a, b, c]), "value");
  assert.notEqual(ranking.winners.value, a.id);
});
