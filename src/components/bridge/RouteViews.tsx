"use client";

import { clsx } from "clsx";
import { AlertTriangle, ArrowDown, RefreshCw } from "lucide-react";
import { chainById } from "@/config/chains";
import { providerMeta } from "@/config/providers";
import { formatAmount, formatDuration, formatUsd } from "@/lib/format";
import type { BridgeError } from "@/lib/errors";
import { PREFERENCE_LABEL } from "@/lib/router/scoreRoutes";
import { useBridgeStore } from "@/lib/store/bridge";
import type { Preference, RouteQuote, RouteRanking, RouteStep, ScoredRoute } from "@/types/route";
import { Label, SourceTag, Tag } from "@/components/ui/primitives";
import type { RouteFailure } from "@/lib/router/findRoutes";

const PREFERENCES: Preference[] = ["value", "fastest", "fees"];

/** The path an asset takes, step by step. Intermediate swaps are never hidden. */
export function RoutePath({ quote, compact = false }: { quote: RouteQuote; compact?: boolean }) {
  const source = chainById(quote.sourceChain);
  const nodes: { label: string; detail?: string; kind: RouteStep["kind"] | "source" }[] = [{ label: source?.label ?? "SOURCE", kind: "source" }];
  for (const s of quote.transactionSteps) nodes.push({ label: s.label, detail: s.detail, kind: s.kind });
  return (
    <ol className={clsx("flex flex-wrap items-center", compact ? "gap-x-2 gap-y-1" : "gap-x-3 gap-y-2")} aria-label="Route path">
      {nodes.map((n, i) => (
        <li key={`${n.label}-${i}`} className="flex items-center gap-2">
          {i > 0 && <ArrowDown size={12} className="-rotate-90 text-muted-2" aria-hidden />}
          <span
            className={clsx(
              "label",
              n.kind === "bridge" || n.kind === "swap" ? "text-energy" : n.kind === "approve" ? "text-muted" : "text-white",
              compact && "text-[10px]",
            )}
            title={n.detail}
          >
            {n.label}
          </span>
        </li>
      ))}
    </ol>
  );
}

function RouteRow({ route, ranking, active, onSelect }: { route: ScoredRoute; ranking: RouteRanking; active: boolean; onSelect: () => void }) {
  const q = route.quote;
  const badges = PREFERENCES.filter((p) => ranking.winners[p] === q.id);
  return (
    <button
      type="button"
      onClick={onSelect}
      data-portal-interactive=""
      aria-pressed={active}
      className={clsx(
        "grid w-full grid-cols-[1fr_auto] items-center gap-3 rounded-[10px] border px-4 py-3 text-left transition-colors sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,0.8fr)]",
        active ? "border-energy/40 bg-graphite" : "border-graphite hover:border-graphite-3 hover:bg-graphite/60",
      )}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-white">{q.providerName}</span>
          {badges.map((b) => (
            <Tag key={b} tone="energy" className="hidden sm:inline-flex">
              {PREFERENCE_LABEL[b]}
            </Tag>
          ))}
          {!q.executable && q.source === "live" && <Tag>Comparison only</Tag>}
        </div>
        <span className="label truncate text-[10px]">{q.transactionSteps.filter((s) => s.kind !== "receive" && s.kind !== "approve").map((s) => s.label).join(" → ")}</span>
      </div>
      <div className="mono text-right text-sm text-white sm:text-left">
        {formatAmount(q.estimatedAmountOut, q.destinationToken.decimals)} <span className="text-muted">{q.destinationToken.symbol}</span>
      </div>
      <div className="mono hidden text-sm text-muted sm:block">{formatDuration(q.estimatedDuration)}</div>
      <div className="mono hidden text-sm text-muted sm:block">{formatUsd(route.totalCostUsd)}</div>
    </button>
  );
}

/** OTHER ROUTES + the preference switch. BEST ROUTE is a real score, not a label. */
export function RouteList({ ranking, selected, failures, skippedNames }: { ranking: RouteRanking; selected?: ScoredRoute; failures: RouteFailure[]; skippedNames: string[] }) {
  const preference = useBridgeStore((s) => s.preference);
  const setPreference = useBridgeStore((s) => s.setPreference);
  const selectProvider = useBridgeStore((s) => s.selectProvider);
  const others = ranking.ranked.filter((r) => r.quote.id !== selected?.quote.id);
  if (ranking.ranked.length === 0 && failures.length === 0) return null;
  return (
    <section className="flex flex-col gap-3" aria-label="Other routes">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label className="text-white">{others.length > 0 ? "Other routes" : "Routes"}</Label>
        <div className="flex items-center gap-1" role="radiogroup" aria-label="Route preference">
          {PREFERENCES.map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={preference === p}
              onClick={() => setPreference(p)}
              data-portal-interactive=""
              className={clsx("label rounded-md px-2.5 py-1.5 transition-colors", preference === p ? "bg-graphite-2 text-white" : "hover:text-white")}
            >
              {PREFERENCE_LABEL[p]}
            </button>
          ))}
        </div>
      </div>
      {others.length > 0 && (
        <div className="flex flex-col gap-2">
          {others.map((r) => (
            <RouteRow key={r.quote.id} route={r} ranking={ranking} active={false} onSelect={() => selectProvider(r.quote.provider)} />
          ))}
        </div>
      )}
      {(failures.length > 0 || skippedNames.length > 0) && (
        <p className="label leading-relaxed text-muted-2">
          {failures.map((f) => `${f.providerName}: ${f.message}`).join(" · ")}
          {failures.length > 0 && skippedNames.length > 0 && " · "}
          {skippedNames.length > 0 && `Not asked (pair unsupported): ${skippedNames.join(", ")}`}
        </p>
      )}
    </section>
  );
}

export function RouteErrorView({ error, onRefresh }: { error: BridgeError; onRefresh?: () => void }) {
  return (
    <div role="alert" className="panel flex items-start gap-3 border-danger/30 p-4">
      <AlertTriangle size={16} className="mt-0.5 shrink-0 text-danger" />
      <div className="min-w-0 flex-1">
        <div className="label text-danger">{error.title}</div>
        <p className="mt-1 text-sm text-muted">{error.message}</p>
      </div>
      {error.action === "refresh" && onRefresh && (
        <button type="button" onClick={onRefresh} className="label flex items-center gap-1.5 text-white" data-portal-interactive="">
          <RefreshCw size={12} /> Refresh
        </button>
      )}
    </div>
  );
}

/** Fee breakdown used by the summary and the security review. */
export function FeeLines({ quote, gasUsd }: { quote: RouteQuote; gasUsd?: number }) {
  return (
    <ul className="flex flex-col gap-1">
      {quote.providerFees.map((f, i) => (
        <li key={i} className="flex items-center justify-between gap-3">
          <span className="label">{f.label}</span>
          <span className="mono text-xs text-white">
            {formatAmount(f.amount, f.token.decimals, 6)} {f.token.symbol}
            {f.usd !== undefined && <span className="text-muted"> · {formatUsd(f.usd)}</span>}
          </span>
        </li>
      ))}
      <li className="flex items-center justify-between gap-3">
        <span className="label">Gas on {chainById(quote.sourceChain)?.name}</span>
        <span className="mono text-xs text-white">
          {quote.estimatedGas.amount > 0n ? `${formatAmount(quote.estimatedGas.amount, quote.estimatedGas.token.decimals, 6)} ${quote.estimatedGas.token.symbol}` : "—"}
          {gasUsd !== undefined && <span className="text-muted"> · {formatUsd(gasUsd)}</span>}
        </span>
      </li>
    </ul>
  );
}

export function ProviderNote({ quote }: { quote: RouteQuote }) {
  const meta = providerMeta(quote.provider);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <SourceTag source={quote.source} />
      {meta?.status === "needs-key" && quote.source === "live" && <Tag>Needs API key to execute</Tag>}
      {meta?.status === "experimental" && <Tag>Experimental</Tag>}
    </div>
  );
}
