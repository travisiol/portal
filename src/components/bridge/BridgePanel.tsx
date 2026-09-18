"use client";

import { clsx } from "clsx";
import { useState } from "react";
import { PROVIDERS } from "@/config/providers";
import { formatAmount } from "@/lib/format";
import { Portal } from "@/components/portal/Portal";
import { DestinationCard, SourceCard } from "./ChainCards";
import { CrossingOverlay, LockLabel } from "./Overlays";
import { RouteSummary } from "./RouteSummary";
import { RouteErrorView, RouteList } from "./RouteViews";
import { TransactionModal } from "./TransactionModal";
import { useBridge } from "./useBridge";

/**
 * The application. ETHEREUM — PORTAL — ROBINHOOD on desktop, a vertical flow
 * with the lite portal on phones. The same component is the hero of the
 * landing page and the whole of /bridge.
 */
export function BridgePanel({ variant = "hero", className }: { variant?: "hero" | "app"; className?: string }) {
  const bridge = useBridge();
  const [open, setOpen] = useState(false);
  const { selected, ranking, error, failures, search, params, mode, expired, refresh, destinationChain } = bridge;
  const skippedNames = (search?.skipped ?? []).map((id) => PROVIDERS.find((p) => p.id === id)?.name ?? id);
  const q = selected?.quote;

  return (
    <div className={clsx("grid gap-4 mx-auto max-w-[640px] xl:mx-0 xl:max-w-none xl:grid-cols-[minmax(280px,340px)_minmax(0,1fr)_minmax(280px,340px)] xl:items-start", className)}>
      <div className="order-1 xl:col-start-1 xl:row-start-1">
        <SourceCard bridge={bridge} />
      </div>

      <div className="order-2 flex flex-col gap-2 xl:col-start-2 xl:row-start-1">
        <div className={clsx("relative mx-auto w-full", variant === "hero" ? "h-[300px] sm:h-[400px] xl:h-[500px]" : "h-[320px] sm:h-[440px] xl:h-[540px]")}>
          <Portal className="h-full w-full" withIntro={variant === "hero"} />
          <CrossingOverlay amount={q ? formatAmount(q.estimatedAmountOut, q.destinationToken.decimals) : undefined} symbol={q?.destinationToken.symbol} chainName={destinationChain.name} />
        </div>
        <LockLabel />
      </div>

      <div className="order-3 xl:col-start-3 xl:row-start-1">
        <DestinationCard bridge={bridge} />
      </div>

      <div className="order-4 flex flex-col gap-4 xl:col-start-2 xl:row-start-2">
        {error && error.code !== "INSUFFICIENT_BALANCE" ? <RouteErrorView error={error} onRefresh={refresh} /> : null}
        <RouteSummary bridge={bridge} onOpen={() => setOpen(true)} />
        {error?.code === "INSUFFICIENT_BALANCE" && <RouteErrorView error={error} />}
        <RouteList ranking={ranking} selected={selected} failures={failures} skippedNames={skippedNames} />
      </div>

      <TransactionModal open={open} onClose={() => setOpen(false)} route={selected} params={params} mode={mode} expired={expired} onRefresh={refresh} />
    </div>
  );
}
