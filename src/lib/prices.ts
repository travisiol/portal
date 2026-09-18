import type { Address } from "viem";

/**
 * USD prices for live quotes. LI.FI's public token endpoint is keyless and
 * covers every configured chain; results are cached for a minute. In DEMO mode
 * the demo adapter uses its own fixed table and never calls this.
 */
const cache = new Map<string, { price: number; at: number }>();
const inflight = new Map<string, Promise<number | undefined>>();

const key = (chainId: number, address: Address) => `${chainId}:${address.toLowerCase()}`;

export async function tokenPriceUsd(chainId: number, address: Address, signal?: AbortSignal): Promise<number | undefined> {
  const k = key(chainId, address);
  const cached = cache.get(k);
  if (cached && Date.now() - cached.at < 60_000) return cached.price;
  const pending = inflight.get(k);
  if (pending) return pending;
  const promise = (async () => {
    try {
      const response = await fetch(`https://li.quest/v1/token?chain=${chainId}&token=${address}`, { signal, headers: { accept: "application/json" } });
      if (!response.ok) return undefined;
      const body = (await response.json()) as { priceUSD?: string };
      const price = Number(body.priceUSD);
      if (!Number.isFinite(price) || price <= 0) return undefined;
      cache.set(k, { price, at: Date.now() });
      return price;
    } catch {
      return undefined;
    } finally {
      inflight.delete(k);
    }
  })();
  inflight.set(k, promise);
  return promise;
}

export const nativePriceUsd = (chainId: number, signal?: AbortSignal) => tokenPriceUsd(chainId, "0x0000000000000000000000000000000000000000", signal);

/** Fixed table for DEMO mode. Clearly not market data. */
export const DEMO_PRICES: Record<string, number> = {
  ETH: 2500,
  WETH: 2500,
  POL: 0.42,
  USDC: 1,
  USDG: 1,
  PORTAL: 0.05,
};
