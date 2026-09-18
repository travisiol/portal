import assert from "node:assert/strict";
import { test } from "node:test";
import { formatAmount, formatDuration, formatUsd, parseAmount, shortAddress, shortHash } from "@/lib/format";
import { passportStats } from "@/lib/store/passport";

test("amounts", () => {
  assert.equal(formatAmount(10n ** 18n, 18), "1");
  assert.equal(formatAmount(996_300_000_000_000_000n, 18), "0.9963");
  assert.equal(formatAmount(1_234_500_000n, 6), "1,234.5");
  assert.equal(formatAmount(0n, 18), "0");
  assert.equal(parseAmount("1.5", 18), 1_500_000_000_000_000_000n);
  assert.equal(parseAmount("1,000", 6), 1_000_000_000n);
  assert.equal(parseAmount("abc", 18), undefined);
  assert.equal(parseAmount(".", 18), undefined);
  assert.equal(parseAmount("", 18), undefined);
});

test("usd, durations, hashes", () => {
  assert.equal(formatUsd(1.21), "$1.21");
  assert.equal(formatUsd(undefined), "—");
  assert.equal(formatUsd(18_421, { compact: true }), "$18.4K");
  assert.equal(formatDuration(14), "~14 sec");
  assert.equal(formatDuration(480), "~8 min");
  assert.equal(formatDuration(7 * 86_400), "~7 d");
  assert.equal(shortAddress("0x71C7656EC7ab88b098defB751B7401B5f6d8976F"), "0x71C7…76F");
  assert.equal(shortHash("0xabcdef0123456789abcdef0123456789"), "0xabcdef…456789");
});

test("passport stats derive from completed journeys; demo never counts as volume", () => {
  const base = { providerName: "Relay", provider: "relay" as const, tokenSymbol: "ETH", amountIn: "1", amountOut: "0.99", startedAt: 1, completedAt: 20_000 };
  const stats = passportStats([
    { ...base, id: "a", mode: "live", sourceChain: 1, destinationChain: 4663, usd: 2500, state: "arrived" },
    { ...base, id: "b", mode: "live", sourceChain: 1, destinationChain: 4663, usd: 2500, state: "arrived" },
    { ...base, id: "c", mode: "demo", sourceChain: 8453, destinationChain: 4663, usd: 99_999, state: "arrived" },
    { ...base, id: "d", mode: "live", sourceChain: 42161, destinationChain: 4663, usd: 10, state: "failed" },
  ]);
  assert.equal(stats.routesCompleted, 3);
  assert.equal(stats.volumeUsd, 5000);
  assert.equal(stats.chainsVisited, 3);
  assert.equal(stats.favorite?.sourceChain, 1);
  assert.equal(stats.level, "Explorer");
});
