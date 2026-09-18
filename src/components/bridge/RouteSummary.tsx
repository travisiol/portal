"use client";

import { useConnectModal } from "@rainbow-me/rainbowkit";
import { clsx } from "clsx";
import { Bookmark, BookmarkCheck, ChevronDown } from "lucide-react";
import { useState } from "react";
import { formatAmount, formatDuration, formatUsd } from "@/lib/format";
import { PREFERENCE_LABEL } from "@/lib/router/scoreRoutes";
import { usePassportStore } from "@/lib/store/passport";
import { usePortalStore } from "@/lib/store/portal";
import type { Preference } from "@/types/route";
import { Button } from "@/components/ui/Button";
import { Label, Skeleton, Tag } from "@/components/ui/primitives";
import { FeeLines, ProviderNote, RoutePath } from "./RouteViews";
import type { BridgeController } from "./useBridge";

/** The chosen route and the one primary action. OPEN PORTAL only exists once the rings are locked and a route was scored. */
export function RouteSummary({ bridge, onOpen }: { bridge: BridgeController; onOpen: () => void }) {
  const { ranking, selected, query, phase, error, mode, address, busy, params } = bridge;
  const setHoverBoost = usePortalStore((s) => s.setHoverBoost);
  const { openConnectModal } = useConnectModal();
  const [showFees, setShowFees] = useState(false);
  const savedRoutes = usePassportStore((s) => s.savedRoutes);
  const saveRoute = usePassportStore((s) => s.saveRoute);
  const removeRoute = usePassportStore((s) => s.removeRoute);

  const q = selected?.quote;
  const loading = query.isFetching && !q;
  const isBest = Boolean(ranking.best && selected && ranking.best.quote.id === selected.quote.id);
  const heading = !q ? "Route" : ranking.ranked.length === 1 ? "Only route" : isBest ? "Best route" : "Selected route";
  const badges = q ? (Object.keys(ranking.winners) as Preference[]).filter((p) => ranking.winners[p] === q.id) : [];
  const readyPhase = phase === "building" || phase === "confirming";
  const canOpen = Boolean(q) && readyPhase && !error && !busy;
  const savedId = params ? `${params.sourceChain.id}-${params.destinationChain.id}-${params.sourceToken.symbol}` : undefined;
  const isSaved = Boolean(savedId && savedRoutes.some((r) => r.id === savedId));

  const cta = (() => {
    if (mode === "live" && !address) {
      return (
        <Button variant="ghost" className="h-12 w-full" onClick={openConnectModal}>
          Connect wallet to open
        </Button>
      );
    }
    if (phase === "aligning" || phase === "idle" || phase === "dormant") {
      return <div className="label flex h-12 items-center justify-center text-muted-2">Aligning rings…</div>;
    }
    if (phase === "locked" || loading) {
      return (
        <div className="label flex h-12 items-center justify-center gap-2 text-muted">
          <span className="size-1.5 animate-[blink_1s_ease-in-out_infinite] rounded-full bg-energy" /> Locked · searching routes
        </div>
      );
    }
    if (!q) return null;
    if (q.source === "live" && !q.executable) {
      return (
        <Button variant="ghost" className="h-12 w-full" disabled>
          Comparison only — pick another route
        </Button>
      );
    }
    return (
      <Button
        variant="primary"
        className="h-12 w-full text-[13px] tracking-[0.2em]"
        disabled={!canOpen}
        onClick={onOpen}
        onMouseEnter={() => setHoverBoost(true)}
        onMouseLeave={() => setHoverBoost(false)}
        magnet={5}
      >
        Open portal
        {mode === "demo" && <span className="ml-1 rounded-full bg-black/15 px-1.5 py-0.5 text-[9px] tracking-[0.12em]">demo</span>}
      </Button>
    );
  })();

  return (
    <section className="panel flex flex-col gap-4 p-4 sm:p-5" aria-label="Route">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Label className={clsx(isBest ? "text-energy" : "text-white")}>{heading}</Label>
          {badges.map((b) => (
            <Tag key={b} tone="energy">
              {PREFERENCE_LABEL[b]}
            </Tag>
          ))}
        </div>
        {q && <ProviderNote quote={q} />}
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      ) : q ? (
        <>
          <div className="grid gap-2 sm:grid-cols-[1.2fr_1fr_1fr]">
            <div className="panel-inset px-3 py-2.5">
              <div className="label text-[10px]">{q.providerName}</div>
              <div className="mono mt-1 text-lg text-white">
                {formatAmount(q.estimatedAmountOut, q.destinationToken.decimals)} <span className="text-sm text-muted">{q.destinationToken.symbol}</span>
              </div>
            </div>
            <div className="panel-inset px-3 py-2.5">
              <div className="label text-[10px]">Time</div>
              <div className="mono mt-1 text-lg text-white">{formatDuration(q.estimatedDuration)}</div>
            </div>
            <div className="panel-inset px-3 py-2.5">
              <div className="label text-[10px]">Total cost</div>
              <div className="mono mt-1 text-lg text-white">{formatUsd(selected?.totalCostUsd)}</div>
            </div>
          </div>
          <RoutePath quote={q} />
          <div>
            <button type="button" onClick={() => setShowFees((v) => !v)} className="label flex items-center gap-1 transition-colors hover:text-white" aria-expanded={showFees}>
              <ChevronDown size={12} className={clsx("transition-transform", showFees && "rotate-180")} /> Fee breakdown
            </button>
            {showFees && (
              <div className="mt-3">
                <FeeLines quote={q} gasUsd={q.estimatedGas.usd} />
                {q.notes?.map((n) => (
                  <p key={n} className="label mt-2 normal-case tracking-normal text-muted-2">
                    {n}
                  </p>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <p className="text-sm text-muted">Enter an amount to find routes.</p>
      )}

      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">{cta}</div>
        {savedId && q && (
          <button
            type="button"
            onClick={() => (isSaved ? removeRoute(savedId) : saveRoute({ sourceChain: params!.sourceChain.id, destinationChain: params!.destinationChain.id, tokenSymbol: params!.sourceToken.symbol }))}
            className={clsx("btn btn-ghost h-12 w-12 shrink-0 px-0", isSaved && "text-energy")}
            aria-label={isSaved ? "Remove saved route" : "Save route"}
            title={isSaved ? "Saved to passport" : "Save route to passport"}
          >
            {isSaved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
          </button>
        )}
      </div>
    </section>
  );
}
