"use client";

import { useEffect, useMemo } from "react";
import { useAccount, useBalance } from "wagmi";
import { requireChain } from "@/config/chains";
import { tokenAddressOn, tokenBySymbol } from "@/config/tokens";
import { bridgeError, type BridgeError } from "@/lib/errors";
import { useNow } from "@/lib/hooks";
import { useRoutes } from "@/lib/router/useRoutes";
import { useBridgeStore } from "@/lib/store/bridge";
import { usePortalStore } from "@/lib/store/portal";

/**
 * Glue between the form, the route query and the portal machine:
 * - pair change → the rings align
 * - quotes arrive → ROUTE FOUND (pulse, energy)
 * - no quote → the error phase
 * - quote expiry → QUOTE EXPIRED
 */
export function useBridge() {
  const routes = useRoutes();
  const { params, ranking, selected, query, amountError, mode, search } = routes;
  const sourceChainId = useBridgeStore((s) => s.sourceChainId);
  const destinationChainId = useBridgeStore((s) => s.destinationChainId);
  const sourceTokenSymbol = useBridgeStore((s) => s.sourceTokenSymbol);
  const phase = usePortalStore((s) => s.phase);
  const align = usePortalStore((s) => s.align);
  const routeFound = usePortalStore((s) => s.routeFound);
  const setPhase = usePortalStore((s) => s.setPhase);
  const now = useNow();
  const { address } = useAccount();

  const sourceChain = requireChain(sourceChainId);
  const destinationChain = requireChain(destinationChainId);
  const sourceToken = tokenBySymbol(sourceTokenSymbol);
  const tokenAddress = sourceToken ? tokenAddressOn(sourceToken, sourceChain) : undefined;
  const balance = useBalance({
    address,
    chainId: sourceChain.id,
    token: sourceToken?.kind === "erc20" ? tokenAddress : undefined,
    query: { enabled: Boolean(address), refetchInterval: 20_000 },
  });

  // 1. pair → rings
  useEffect(() => {
    align(sourceChain.key, destinationChain.key);
  }, [sourceChain.key, destinationChain.key, align]);

  const hasRoutes = ranking.ranked.length > 0;
  const busy = phase === "open" || phase === "bridging" || phase === "confirming" || phase === "complete";

  // 2. quotes → ROUTE FOUND, once the rings are locked
  useEffect(() => {
    if (busy) return;
    if (hasRoutes && (phase === "locked" || phase === "idle")) routeFound();
  }, [hasRoutes, phase, busy, routeFound]);

  // 3. nothing found → error phase; found again → back to building
  const noRoute = Boolean(params) && !query.isFetching && query.isFetched && !hasRoutes;
  useEffect(() => {
    if (busy) return;
    if (noRoute && phase === "building") setPhase("error");
    if (!noRoute && phase === "error" && hasRoutes) setPhase("building");
  }, [noRoute, hasRoutes, phase, busy, setPhase]);

  const expired = Boolean(selected && now > 0 && now > selected.quote.quoteExpiration && !query.isFetching);

  const error: BridgeError | undefined = useMemo(() => {
    if (amountError === "invalid") return { code: "NO_ROUTE", title: "INVALID AMOUNT", message: "Enter a number." };
    if (noRoute) return bridgeError("NO_ROUTE");
    if (expired) return bridgeError("QUOTE_EXPIRED");
    if (selected && balance.data && selected.quote.amountIn > balance.data.value) return bridgeError("INSUFFICIENT_BALANCE");
    return undefined;
  }, [amountError, noRoute, expired, selected, balance.data]);

  const failures = search?.failures ?? [];

  return {
    ...routes,
    sourceChain,
    destinationChain,
    sourceToken,
    balance: balance.data,
    balanceLoading: balance.isLoading,
    address,
    phase,
    busy,
    error,
    expired,
    failures,
    refresh: () => query.refetch(),
    mode,
  };
}

export type BridgeController = ReturnType<typeof useBridge>;
