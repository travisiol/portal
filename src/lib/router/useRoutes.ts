"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useAccount } from "wagmi";
import { requireChain } from "@/config/chains";
import { tokenBySymbol } from "@/config/tokens";
import { DEFAULT_SLIPPAGE_BPS } from "@/lib/env";
import { parseAmount } from "@/lib/format";
import { providersFor } from "@/lib/routes";
import { useBridgeStore } from "@/lib/store/bridge";
import { useMode } from "@/lib/store/mode";
import type { QuoteParams } from "@/types/provider";
import { findRoutes, type RouteSearch } from "./findRoutes";
import { scoreRoutes } from "./scoreRoutes";

/** The bridge form, resolved into typed quote parameters (undefined while incomplete). */
export function useQuoteParams(): { params?: QuoteParams; amountError?: "empty" | "invalid" } {
  const sourceChainId = useBridgeStore((s) => s.sourceChainId);
  const destinationChainId = useBridgeStore((s) => s.destinationChainId);
  const sourceTokenSymbol = useBridgeStore((s) => s.sourceTokenSymbol);
  const destinationTokenSymbol = useBridgeStore((s) => s.destinationTokenSymbol);
  const amountInput = useBridgeStore((s) => s.amountInput);
  const { address } = useAccount();

  return useMemo(() => {
    const sourceToken = tokenBySymbol(sourceTokenSymbol);
    const destinationToken = tokenBySymbol(destinationTokenSymbol);
    if (!sourceToken || !destinationToken) return { amountError: "invalid" as const };
    const amountIn = parseAmount(amountInput, sourceToken.decimals);
    if (amountIn === undefined) return { amountError: amountInput.trim() ? ("invalid" as const) : ("empty" as const) };
    if (amountIn === 0n) return { amountError: "empty" as const };
    return {
      params: {
        sourceChain: requireChain(sourceChainId),
        destinationChain: requireChain(destinationChainId),
        sourceToken,
        destinationToken,
        amountIn,
        sender: address,
        slippageBps: DEFAULT_SLIPPAGE_BPS,
      },
    };
  }, [sourceChainId, destinationChainId, sourceTokenSymbol, destinationTokenSymbol, amountInput, address]);
}

export function useRoutes() {
  const mode = useMode();
  const preference = useBridgeStore((s) => s.preference);
  const selectedProvider = useBridgeStore((s) => s.selectedProvider);
  const { params, amountError } = useQuoteParams();

  const query = useQuery<RouteSearch>({
    queryKey: [
      "routes",
      mode,
      params?.sourceChain.id,
      params?.destinationChain.id,
      params?.sourceToken.symbol,
      params?.destinationToken.symbol,
      params?.amountIn.toString(),
      params?.sender ?? "anon",
    ],
    queryFn: ({ signal }) => findRoutes({ ...params!, signal }, providersFor(mode)),
    enabled: Boolean(params),
    staleTime: 25_000,
    refetchInterval: 40_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    placeholderData: keepPreviousData,
    retry: 0,
  });

  const ranking = useMemo(() => scoreRoutes(query.data?.quotes ?? [], preference), [query.data, preference]);
  const selected = useMemo(() => {
    if (selectedProvider) {
      const chosen = ranking.ranked.find((r) => r.quote.provider === selectedProvider);
      if (chosen) return chosen;
    }
    return ranking.ranked[0];
  }, [ranking, selectedProvider]);

  return { mode, params, amountError, query, ranking, selected, search: query.data };
}
