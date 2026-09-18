import { createPublicClient, http, type Address, type PublicClient } from "viem";
import { chainById, requireChain } from "@/config/chains";
import { ProviderError } from "@/lib/errors";
import type { ChainConfig } from "@/types/chain";
import type { ProviderId } from "@/types/route";
import type { TokenRef } from "@/types/token";

let nonce = 0;
export const quoteId = (provider: ProviderId) => `${provider}-${Date.now().toString(36)}-${(nonce++).toString(36)}`;

export const nativeRef = (chain: ChainConfig): TokenRef => ({
  chainId: chain.id,
  address: "0x0000000000000000000000000000000000000000",
  symbol: chain.native.symbol,
  decimals: chain.native.decimals,
});

export const usdOf = (amount: bigint, decimals: number, price: number | undefined): number | undefined =>
  price === undefined ? undefined : (Number(amount) / 10 ** decimals) * price;

export async function fetchJson<T>(provider: ProviderId, url: string, init: RequestInit & { signal?: AbortSignal } = {}): Promise<{ ok: boolean; status: number; body: T | undefined }> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, headers: { accept: "application/json", ...(init.headers ?? {}) } });
  } catch (error) {
    if (init.signal?.aborted) throw new ProviderError(provider, "Timed out");
    throw new ProviderError(provider, error instanceof Error ? error.message : "Network error");
  }
  let body: T | undefined;
  try {
    body = (await response.json()) as T;
  } catch {
    body = undefined;
  }
  return { ok: response.ok, status: response.status, body };
}

const clients = new Map<number, PublicClient>();

/** Read-only viem client per configured chain (RPC from src/config/chains.ts). */
export const publicClientFor = (chainId: number): PublicClient => {
  const cached = clients.get(chainId);
  if (cached) return cached;
  const chain = requireChain(chainId);
  const client = createPublicClient({ transport: http(chain.rpcUrl, { timeout: 8_000 }) });
  clients.set(chainId, client);
  return client;
};

const gasPriceCache = new Map<number, { value: bigint; at: number }>();

/** Current gas price with a 30 s cache; undefined when the RPC does not answer. */
export async function gasPriceOf(chainId: number): Promise<bigint | undefined> {
  const cached = gasPriceCache.get(chainId);
  if (cached && Date.now() - cached.at < 30_000) return cached.value;
  try {
    const value = await publicClientFor(chainId).getGasPrice();
    gasPriceCache.set(chainId, { value, at: Date.now() });
    return value;
  } catch {
    return undefined;
  }
}

export const isNative = (address: Address) => /^0x0{40}$/i.test(address) || /^0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee$/i.test(address);

export const chainLabel = (chainId: number) => chainById(chainId)?.label ?? `CHAIN ${chainId}`;

/** Robinhood Chain explorer or the provider's own explorer for a hash. */
export const hexToBigInt = (value: string | number | bigint | undefined | null, fallback = 0n): bigint => {
  if (value === undefined || value === null || value === "") return fallback;
  try {
    return BigInt(value);
  } catch {
    return fallback;
  }
};
