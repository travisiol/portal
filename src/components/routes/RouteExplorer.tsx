"use client";

import { clsx } from "clsx";
import { ArrowRight, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { CHAINS, HOME_CHAIN } from "@/config/chains";
import { PROVIDERS, providersForPair } from "@/config/providers";
import { tokensOn } from "@/config/tokens";
import { DEFAULT_SLIPPAGE_BPS } from "@/lib/env";
import { formatAmount, formatDuration, formatUsd } from "@/lib/format";
import { findRoutes, type RouteSearch } from "@/lib/router/findRoutes";
import { scoreRoutes } from "@/lib/router/scoreRoutes";
import { providersFor } from "@/lib/routes";
import { useBridgeStore } from "@/lib/store/bridge";
import { useMode } from "@/lib/store/mode";
import type { ChainConfig } from "@/types/chain";
import type { TokenConfig } from "@/types/token";
import { Button } from "@/components/ui/Button";
import { ChainGlyph, TokenGlyphIcon } from "@/components/ui/Icons";
import { Label, Panel, SourceTag, Tag } from "@/components/ui/primitives";

const STATUS_TONE = { live: "energy", "needs-key": "muted", experimental: "muted", "demo-only": "muted" } as const;
const STATUS_LABEL = { live: "Live", "needs-key": "Needs key", experimental: "Experimental", "demo-only": "Demo only" } as const;

export const activeProviders = (a: ChainConfig, b: ChainConfig) => providersForPair(a.id, b.id).filter((p) => p.status !== "demo-only");

export function RouteCard({ from, to }: { from: ChainConfig; to: ChainConfig }) {
  const providers = activeProviders(from, to);
  const assets = tokensOn(from).filter((t) => tokensOn(to).some((d) => d.symbol === t.symbol));
  return (
    <Link href={`/routes/${from.key}/${to.key}`} data-portal-interactive="">
      <Panel className="group flex h-full flex-col gap-4 p-5 transition-colors hover:border-graphite-3">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <ChainGlyph chainKey={from.key} hue={from.hue} size={18} active={from.home} />
            <span className="label text-white">{from.label}</span>
          </span>
          <ArrowRight size={14} className="text-muted-2 transition-transform group-hover:translate-x-0.5" />
          <span className="flex items-center gap-2">
            <span className="label text-white">{to.label}</span>
            <ChainGlyph chainKey={to.key} hue={to.hue} size={18} active={to.home} />
          </span>
        </div>
        <div className="flex items-end justify-between">
          <div>
            <div className="mono text-3xl text-white">{providers.length}</div>
            <div className="label mt-1">provider{providers.length === 1 ? "" : "s"}</div>
          </div>
          <div className="flex items-center gap-1">
            {assets.slice(0, 4).map((t) => (
              <span key={t.symbol} title={t.symbol}>
                <TokenGlyphIcon glyph={t.glyph} size={16} />
              </span>
            ))}
            {assets.length === 0 && <Tag>swap routes only</Tag>}
          </div>
        </div>
      </Panel>
    </Link>
  );
}

export function RouteGrid() {
  const others = CHAINS.filter((c) => !c.home);
  const [all, setAll] = useState(false);
  const cross = others.flatMap((a) => others.filter((b) => b.id !== a.id).map((b) => [a, b] as const));
  return (
    <div className="flex flex-col gap-10">
      <div>
        <Label className="text-white">Into {HOME_CHAIN.name}</Label>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {others.map((c) => (
            <RouteCard key={c.key} from={c} to={HOME_CHAIN} />
          ))}
        </div>
      </div>
      <div>
        <Label className="text-white">Out of {HOME_CHAIN.name}</Label>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {others.map((c) => (
            <RouteCard key={c.key} from={HOME_CHAIN} to={c} />
          ))}
        </div>
      </div>
      <div>
        <button type="button" onClick={() => setAll((v) => !v)} className="label flex items-center gap-2 hover:text-white" aria-expanded={all}>
          {all ? "Hide" : "Show"} {cross.length} routes between other chains
        </button>
        {all && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {cross.map(([a, b]) => (
              <RouteCard key={`${a.key}-${b.key}`} from={a} to={b} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Deterministic 30-day strip for DEMO mode; LIVE has no history source yet and says so. */
function AvailabilityStrip({ seed }: { seed: string }) {
  const mode = useMode();
  const days = Array.from({ length: 30 }, (_, i) => {
    let h = 7;
    for (const ch of `${seed}${i}`) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return (h % 100) / 100;
  });
  if (mode === "live") {
    return (
      <div className="panel-inset flex items-center justify-between px-4 py-3">
        <span className="label">Historical availability</span>
        <span className="label text-muted-2">Not tracked yet — tracking starts when an indexer is configured</span>
      </div>
    );
  }
  return (
    <div className="panel-inset px-4 py-3">
      <div className="flex items-center justify-between">
        <span className="label">Historical availability · 30 days</span>
        <Tag tone="demo">Demo data</Tag>
      </div>
      <div className="mt-3 grid grid-cols-30 gap-0.5" style={{ gridTemplateColumns: "repeat(30, minmax(0, 1fr))" }}>
        {days.map((d, i) => (
          <span key={i} className={clsx("h-6 rounded-sm", d > 0.08 ? "bg-energy/70" : "bg-graphite-3")} title={`Day ${i + 1}: ${d > 0.08 ? "available" : "unavailable"}`} />
        ))}
      </div>
    </div>
  );
}

export function RouteDetail({ from, to }: { from: ChainConfig; to: ChainConfig }) {
  const providers = providersForPair(from.id, to.id);
  const assets = tokensOn(from);
  const same = assets.filter((t) => tokensOn(to).some((d) => d.symbol === t.symbol));
  const setPair = useBridgeStore((s) => s.setPair);
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="flex flex-col gap-6">
        <Panel className="p-5" tilt={false}>
          <Label className="text-white">Available assets</Label>
          <ul className="mt-3 flex flex-col divide-y divide-graphite">
            {assets.map((t) => {
              const direct = same.some((s) => s.symbol === t.symbol);
              return (
                <li key={t.symbol} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="flex items-center gap-2 text-sm text-white">
                    <TokenGlyphIcon glyph={t.glyph} size={18} /> {t.symbol} <span className="text-muted">{t.name}</span>
                  </span>
                  <Tag tone={direct ? "energy" : "muted"}>{direct ? "Same asset on both sides" : "Swap on arrival"}</Tag>
                </li>
              );
            })}
          </ul>
        </Panel>
        <Panel className="p-5" tilt={false}>
          <Label className="text-white">Providers</Label>
          <ul className="mt-3 flex flex-col divide-y divide-graphite">
            {providers.map((p) => (
              <li key={p.id} className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 py-3 sm:grid-cols-[140px_1fr_110px_90px] sm:items-center">
                <span className="text-sm font-medium text-white">{p.name}</span>
                <span className="col-span-2 text-xs leading-relaxed text-muted sm:col-span-1">{p.description}</span>
                <span className="mono text-xs text-muted">{formatDuration(p.typicalDuration)}</span>
                <Tag tone={STATUS_TONE[p.status]} className="justify-self-start sm:justify-self-end">
                  {STATUS_LABEL[p.status]}
                </Tag>
              </li>
            ))}
          </ul>
          <p className="label mt-3 normal-case tracking-normal text-muted-2">Fees and speed for a real amount come from the probe on the right; the table only lists what each adapter can do.</p>
        </Panel>
        <AvailabilityStrip seed={`${from.key}-${to.key}`} />
      </div>
      <div className="flex flex-col gap-4">
        <LiveProbe from={from} to={to} assets={same.length ? same : assets} />
        <Link href="/bridge" onClick={() => setPair(from.id, to.id, (same[0] ?? assets[0])?.symbol)} className="btn btn-primary h-12">
          Open portal on this route
        </Link>
      </div>
    </div>
  );
}

/** Asks every provider for a real quote of one unit, in the current mode, without a wallet. */
function LiveProbe({ from, to, assets }: { from: ChainConfig; to: ChainConfig; assets: TokenConfig[] }) {
  const mode = useMode();
  const [token, setToken] = useState<TokenConfig>(assets[0]);
  const [result, setResult] = useState<RouteSearch | undefined>();
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      const destinationToken = tokensOn(to).find((t) => t.symbol === token.symbol) ?? tokensOn(to)[0];
      const amountIn = token.decimals >= 18 ? 10n ** BigInt(token.decimals - 1) : 10n ** BigInt(token.decimals) * 100n; // 0.1 ETH or 100 stable
      const search = await findRoutes({ sourceChain: from, destinationChain: to, sourceToken: token, destinationToken, amountIn, slippageBps: DEFAULT_SLIPPAGE_BPS }, providersFor(mode));
      setResult(search);
    } finally {
      setBusy(false);
    }
  };
  const ranking = result ? scoreRoutes(result.quotes, "value") : undefined;
  return (
    <Panel className="p-5" tilt={false}>
      <div className="flex items-center justify-between">
        <Label className="text-white">Quote probe</Label>
        <Tag tone={mode === "demo" ? "demo" : "energy"}>{mode === "demo" ? "Demo data" : "Live"}</Tag>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {assets.map((t) => (
          <button key={t.symbol} type="button" onClick={() => setToken(t)} className={clsx("tag", token.symbol === t.symbol && "border-energy/40 text-white")}>
            {t.symbol}
          </button>
        ))}
      </div>
      <Button variant="quiet" className="mt-4 w-full" onClick={run} disabled={busy} icon={<RefreshCw size={12} className={clsx(busy && "animate-spin")} />}>
        {busy ? "Asking providers…" : `Quote ${token.decimals >= 18 ? "0.1" : "100"} ${token.symbol}`}
      </Button>
      {ranking && (
        <ul className="mt-4 flex flex-col gap-2">
          {ranking.ranked.map((r) => (
            <li key={r.quote.id} className="panel-inset flex items-center justify-between gap-2 px-3 py-2">
              <span className="flex items-center gap-2 text-sm text-white">
                {r.quote.providerName}
                <SourceTag source={r.quote.source} />
              </span>
              <span className="mono text-right text-xs text-muted">
                {formatAmount(r.quote.estimatedAmountOut, r.quote.destinationToken.decimals)} {r.quote.destinationToken.symbol} · {formatDuration(r.quote.estimatedDuration)} · {formatUsd(r.totalCostUsd)}
              </span>
            </li>
          ))}
          {ranking.ranked.length === 0 && <li className="label text-danger">No route available for this asset.</li>}
          {result!.failures.map((f) => (
            <li key={f.provider} className="label text-muted-2">
              {f.providerName}: {f.message}
            </li>
          ))}
          {result!.skipped.length > 0 && <li className="label text-muted-2">Not asked: {result!.skipped.map((id) => PROVIDERS.find((p) => p.id === id)?.name ?? id).join(", ")}</li>}
        </ul>
      )}
    </Panel>
  );
}
