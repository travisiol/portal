"use client";

import { useAccount, useReadContract } from "wagmi";
import { chainByKey } from "@/config/chains";
import { feeTierFor, isPortalTokenConfigured, PORTAL_TOKEN } from "@/config/token";
import { erc20Abi } from "@/lib/contracts/erc20";
import { formatAmount } from "@/lib/format";
import type { ChainKey } from "@/types/chain";
import { TokenGlyphIcon } from "@/components/ui/Icons";

/** Reads the connected wallet's $PORTAL balance on the first chain the token is configured for. */
export function usePortalBalance() {
  const { address } = useAccount();
  const entry = Object.entries(PORTAL_TOKEN.addresses).find(([, a]) => Boolean(a)) as [ChainKey, `0x${string}`] | undefined;
  const chain = entry ? chainByKey(entry[0]) : undefined;
  const { data, isLoading } = useReadContract({
    abi: erc20Abi,
    address: entry?.[1],
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: chain?.id,
    query: { enabled: Boolean(address && entry && chain) },
  });
  return { configured: isPortalTokenConfigured(), balance: data ?? 0n, isLoading, chain, tier: feeTierFor(data ?? 0n) };
}

export function PortalBalance() {
  const { configured, balance, chain } = usePortalBalance();
  const { isConnected } = useAccount();
  if (!configured || !isConnected || !chain) return null;
  return (
    <div className="field mono hidden h-11 items-center gap-2 px-3 text-xs text-white md:flex" title={`$PORTAL on ${chain.name}`}>
      <TokenGlyphIcon glyph="portal" size={16} />
      {formatAmount(balance, PORTAL_TOKEN.decimals, 0)} PORTAL
    </div>
  );
}
