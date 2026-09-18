import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { chainByKey } from "@/config/chains";
import { tokenBySymbol } from "@/config/tokens";
import { DEMO_PROVIDERS } from "@/lib/routes/demo";
import { normalizeAcross, type AcrossFees } from "@/lib/routes/across";
import { normalizeLifi, type LifiQuote } from "@/lib/routes/lifi";
import { normalizeRelay, type RelayPrice } from "@/lib/routes/relay";
import type { QuoteParams } from "@/types/provider";

const fixture = <T>(name: string): T => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8")) as T;

const params = (source: string, destination: string, tokenIn = "ETH", tokenOut = tokenIn, amount = 10n ** 18n): QuoteParams => ({
  sourceChain: chainByKey(source)!,
  destinationChain: chainByKey(destination)!,
  sourceToken: tokenBySymbol(tokenIn)!,
  destinationToken: tokenBySymbol(tokenOut)!,
  amountIn: amount,
  slippageBps: 50,
});

test("LI.FI: a real Ethereum → Robinhood Chain quote normalizes with its transaction, fees and path", () => {
  const q = normalizeLifi(params("ethereum", "robinhood"), fixture<LifiQuote>("lifi-quote.json"), "0x000000000000000000000000000000000000dEaD");
  assert.equal(q.provider, "lifi");
  assert.equal(q.source, "live");
  assert.equal(q.sourceChain, 1);
  assert.equal(q.destinationChain, 4663);
  assert.equal(q.estimatedAmountOut, 999932378141243132n);
  assert.equal(q.estimatedDuration, 3);
  assert.ok(q.executable, "the quote carries a transaction request");
  assert.ok(q.providerFees.length >= 1);
  assert.ok(q.estimatedGas.usd !== undefined && q.estimatedGas.usd > 0);
  assert.deepEqual(
    q.transactionSteps.map((s) => s.kind),
    ["bridge", "receive"],
    "native ETH needs no approval; the bridge and the arrival are shown",
  );
  assert.equal(q.transactionSteps[0].label, "ACROSSV4");
  assert.equal(q.transactionSteps[1].label, "ROBINHOOD");
});

test("Across: suggested fees normalize into output amount, relayer fee and a local deposit step", () => {
  const fees = fixture<AcrossFees>("across-fees.json");
  const q = normalizeAcross(params("ethereum", "robinhood"), fees, { priceIn: 2500, priceOut: 2500, nativePrice: 2500, gasPrice: 1_000_000_000n });
  assert.ok(q);
  assert.equal(q.provider, "across");
  assert.equal(q.estimatedAmountOut, BigInt(fees.outputAmount));
  assert.equal(q.providerFees[0].label, "Relayer fee");
  assert.equal(q.providerFees[0].amount, BigInt(fees.totalRelayFee.total));
  assert.equal(q.estimatedDuration, fees.estimatedFillTimeSec);
  assert.equal(q.estimatedGas.amount, 140_000n * 1_000_000_000n);
  assert.ok(q.executable);
  assert.ok(q.notes?.[0].includes(fees.spokePoolAddress));
});

test("Across: an amount below the minimum yields no quote instead of a misleading one", () => {
  const fees = { ...fixture<AcrossFees>("across-fees.json"), isAmountTooLow: true };
  assert.equal(normalizeAcross(params("ethereum", "robinhood"), fees, {}), null);
});

test("Relay: a keyless price normalizes as comparison-only until RELAY_API_KEY exists", () => {
  const price = fixture<RelayPrice>("relay-price.json");
  const q = normalizeRelay(params("base", "robinhood"), price, false);
  assert.equal(q.provider, "relay");
  assert.equal(q.executable, false);
  assert.ok(q.notes?.some((n) => n.includes("RELAY_API_KEY")));
  assert.equal(q.estimatedAmountOut, BigInt(price.details.currencyOut.amount));
  assert.ok(q.providerFees.some((f) => f.label === "Relayer service"));
  assert.ok(q.estimatedDuration >= 8);
  const executable = normalizeRelay(params("base", "robinhood"), price, true);
  assert.equal(executable.executable, true);
});

test("Demo adapters: every quote is labelled demo, never executable, and respects each provider's constraints", async () => {
  const ethIn = params("ethereum", "robinhood");
  const quotes = (await Promise.all(DEMO_PROVIDERS.map((p) => (p.supports({ sourceChain: ethIn.sourceChain, destinationChain: ethIn.destinationChain, token: ethIn.sourceToken }) ? p.getQuote(ethIn) : null)))).filter((q) => q !== null);
  assert.ok(quotes.length >= 3);
  for (const q of quotes) {
    assert.equal(q.source, "demo");
    assert.equal(q.executable, false);
    assert.ok(q.estimatedAmountOut > 0n && q.estimatedAmountOut < q.amountIn, `${q.provider} receives less than it sends`);
    assert.equal(q.transactionSteps.at(-1)?.kind, "receive");
  }
  assert.ok(!quotes.some((q) => q.provider === "ccip"), "CCIP does not reach Robinhood Chain");
  assert.ok(!quotes.some((q) => q.provider === "canonical"), "the canonical bridge only connects Arbitrum and Robinhood Chain");

  const arbIn = params("arbitrum", "robinhood");
  const canonical = DEMO_PROVIDERS.find((p) => p.id === "canonical")!;
  const c = await canonical.getQuote(arbIn);
  assert.ok(c && c.estimatedDuration === 480);

  const usdcIn = params("base", "robinhood", "USDC", "USDG", 100_000_000n);
  const across = DEMO_PROVIDERS.find((p) => p.id === "across")!;
  assert.equal(await across.getQuote(usdcIn), null, "same-asset providers refuse a USDC → USDG route");
  const lifi = DEMO_PROVIDERS.find((p) => p.id === "lifi")!;
  const swap = await lifi.getQuote(usdcIn);
  assert.ok(swap?.transactionSteps.some((s) => s.kind === "swap"), "the swap is shown, never hidden");
  assert.ok(swap?.transactionSteps[0].kind === "approve");
});

test("Demo quotes are deterministic across refreshes", async () => {
  const p = DEMO_PROVIDERS.find((x) => x.id === "relay")!;
  const a = await p.getQuote(params("ethereum", "robinhood"));
  const b = await p.getQuote(params("ethereum", "robinhood"));
  assert.equal(a?.estimatedAmountOut, b?.estimatedAmountOut);
});
