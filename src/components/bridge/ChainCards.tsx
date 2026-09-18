"use client";

import { clsx } from "clsx";
import { ArrowDownUp } from "lucide-react";
import { CHAINS } from "@/config/chains";
import { tokensOn } from "@/config/tokens";
import { formatAmount, formatDuration, formatUsd } from "@/lib/format";
import { useBridgeStore } from "@/lib/store/bridge";
import { Dropdown } from "@/components/ui/Dropdown";
import { ChainGlyph, TokenGlyphIcon } from "@/components/ui/Icons";
import { AnimatedNumber, Label, Skeleton, SourceTag } from "@/components/ui/primitives";
import type { BridgeController } from "./useBridge";

const chainItems = CHAINS.map((c) => ({ value: c.id, label: c.name, icon: <ChainGlyph chainKey={c.key} hue={c.hue} size={20} />, hint: c.home ? "Home network" : undefined }));

export function SourceCard({ bridge }: { bridge: BridgeController }) {
  const { sourceChain, sourceToken, balance, balanceLoading, address, busy, selected } = bridge;
  const amountInput = useBridgeStore((s) => s.amountInput);
  const setAmount = useBridgeStore((s) => s.setAmount);
  const setSourceChain = useBridgeStore((s) => s.setSourceChain);
  const setSourceToken = useBridgeStore((s) => s.setSourceToken);
  const tokenItems = tokensOn(sourceChain).map((t) => ({ value: t.symbol, label: t.symbol, hint: t.name, icon: <TokenGlyphIcon glyph={t.glyph} size={20} /> }));
  const usd = selected?.quote.amountInUsd;

  return (
    <section className={clsx("panel flex flex-col gap-4 p-4 sm:p-5", busy && "pointer-events-none opacity-70")} aria-label="Source">
      <div className="flex items-center justify-between">
        <Label className="text-white">From</Label>
        <Label>Source network</Label>
      </div>
      <Dropdown ariaLabel="Source network" items={chainItems} value={sourceChain.id} onChange={setSourceChain} size="lg" />
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <div className="field flex h-14 items-center px-4">
          <input
            inputMode="decimal"
            autoComplete="off"
            spellCheck={false}
            value={amountInput}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            aria-label="Amount"
            className="mono w-full min-w-0 bg-transparent text-2xl font-medium text-white outline-none placeholder:text-muted-2"
          />
        </div>
        <Dropdown ariaLabel="Asset" items={tokenItems} value={sourceToken?.symbol ?? "ETH"} onChange={setSourceToken} size="lg" className="w-36" />
      </div>
      <div className="flex items-center justify-between">
        <span className="label">{usd !== undefined ? formatUsd(usd) : " "}</span>
        <button
          type="button"
          className="label text-right transition-colors hover:text-white disabled:cursor-default disabled:hover:text-muted"
          disabled={!balance}
          onClick={() => balance && setAmount(formatAmount(balance.value, balance.decimals, 6).replace(/,/g, ""))}
          title={balance ? "Use full balance" : undefined}
        >
          Balance:{" "}
          {!address ? (
            <span className="text-muted-2">connect wallet</span>
          ) : balanceLoading ? (
            <Skeleton className="inline-block h-3 w-16 align-middle" />
          ) : balance ? (
            <span className="mono text-white">
              {formatAmount(balance.value, balance.decimals)} {balance.symbol}
            </span>
          ) : (
            "—"
          )}
        </button>
      </div>
    </section>
  );
}

export function DestinationCard({ bridge }: { bridge: BridgeController }) {
  const { destinationChain, selected, query, busy, ranking } = bridge;
  const destinationTokenSymbol = useBridgeStore((s) => s.destinationTokenSymbol);
  const setDestinationChain = useBridgeStore((s) => s.setDestinationChain);
  const setDestinationToken = useBridgeStore((s) => s.setDestinationToken);
  const tokenItems = tokensOn(destinationChain).map((t) => ({ value: t.symbol, label: t.symbol, hint: t.name, icon: <TokenGlyphIcon glyph={t.glyph} size={20} /> }));
  const q = selected?.quote;
  const loading = query.isFetching && !q;
  const receive = q ? Number(q.estimatedAmountOut) / 10 ** q.destinationToken.decimals : 0;
  const totalCost = selected?.totalCostUsd;

  return (
    <section className={clsx("panel flex flex-col gap-4 p-4 sm:p-5", busy && "pointer-events-none opacity-70")} aria-label="Destination">
      <div className="flex items-center justify-between">
        <Label className="text-white">To</Label>
        <Label>Destination network</Label>
      </div>
      <Dropdown ariaLabel="Destination network" items={chainItems} value={destinationChain.id} onChange={setDestinationChain} size="lg" />
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <div className="field flex h-14 items-center justify-between px-4">
          {loading ? (
            <Skeleton className="h-6 w-28" />
          ) : q ? (
            <AnimatedNumber value={receive} format={(v) => v.toLocaleString("en-US", { maximumFractionDigits: v >= 1000 ? 2 : 4 })} className="mono text-2xl font-medium text-white" />
          ) : (
            <span className="mono text-2xl font-medium text-muted-2">0.00</span>
          )}
          <Label className="hidden sm:inline">Receive</Label>
        </div>
        <Dropdown ariaLabel="Destination asset" items={tokenItems} value={destinationTokenSymbol} onChange={setDestinationToken} size="lg" className="w-36" />
      </div>
      <dl className="grid grid-cols-3 gap-2">
        <div className="panel-inset px-3 py-2">
          <dt className="label text-[10px]">Est. time</dt>
          <dd className="mono mt-1 text-sm text-white">{loading ? <Skeleton className="h-4 w-12" /> : q ? formatDuration(q.estimatedDuration) : "—"}</dd>
        </div>
        <div className="panel-inset px-3 py-2">
          <dt className="label text-[10px]">Total cost</dt>
          <dd className="mono mt-1 text-sm text-white">{loading ? <Skeleton className="h-4 w-12" /> : q ? formatUsd(totalCost) : "—"}</dd>
        </div>
        <div className="panel-inset px-3 py-2">
          <dt className="label text-[10px]">{ranking.best ? "Best route" : "Route"}</dt>
          <dd className="mt-1 flex items-center gap-1.5 text-sm text-white">
            {loading ? <Skeleton className="h-4 w-14" /> : q ? <span className="truncate">{q.providerName}</span> : "—"}
          </dd>
        </div>
      </dl>
      {q && (
        <div className="flex items-center justify-between">
          <SourceTag source={q.source} />
          <FlipButton bridge={bridge} />
        </div>
      )}
    </section>
  );
}

function FlipButton({ bridge }: { bridge: BridgeController }) {
  const flip = useBridgeStore((s) => s.flip);
  return (
    <button type="button" onClick={flip} disabled={bridge.busy} data-portal-interactive="" className="label flex items-center gap-1.5 transition-colors hover:text-white" title="Reverse direction">
      <ArrowDownUp size={12} /> Reverse
    </button>
  );
}
