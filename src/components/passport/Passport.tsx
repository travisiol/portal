"use client";

import { useConnectModal } from "@rainbow-me/rainbowkit";
import { clsx } from "clsx";
import { ArrowRight, Trash2 } from "lucide-react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { chainById } from "@/config/chains";
import { FEE_TIERS, PORTAL_TOKEN } from "@/config/token";
import { formatAmount, formatUsd, shortAddress } from "@/lib/format";
import { useMounted } from "@/lib/hooks";
import { useBridgeStore } from "@/lib/store/bridge";
import { useMode } from "@/lib/store/mode";
import { LEVELS, passportStats, usePassportStore } from "@/lib/store/passport";
import { CrossingRow } from "@/components/landing/Sections";
import { Button } from "@/components/ui/Button";
import { ChainGlyph } from "@/components/ui/Icons";
import { Logo } from "@/components/ui/Logo";
import { Label, Panel, Tag } from "@/components/ui/primitives";
import { usePortalBalance } from "@/components/wallet/PortalBalance";

/** PORTAL PASSPORT — non-financial stats accumulated locally by this browser. */
export function Passport() {
  const mounted = useMounted();
  const mode = useMode();
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const journeys = usePassportStore((s) => s.journeys);
  const savedRoutes = usePassportStore((s) => s.savedRoutes);
  const removeRoute = usePassportStore((s) => s.removeRoute);
  const clear = usePassportStore((s) => s.clear);
  const setPair = useBridgeStore((s) => s.setPair);
  const stats = passportStats(mounted ? journeys : []);
  const { configured, balance, tier, chain } = usePortalBalance();
  const favSource = stats.favorite ? chainById(stats.favorite.sourceChain) : undefined;
  const favDestination = stats.favorite ? chainById(stats.favorite.destinationChain) : undefined;
  const levelIndex = LEVELS.findIndex((l) => l.level === stats.level);
  const next = LEVELS[levelIndex + 1];

  return (
    <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
      <Panel className="relative overflow-hidden p-6" tilt>
        <div className="pointer-events-none absolute -right-10 -top-10 text-graphite-2">
          <Logo size={220} />
        </div>
        <div className="relative">
          <div className="flex items-center justify-between">
            <Label className="text-white">Portal passport</Label>
            <Tag tone="energy">{stats.level}</Tag>
          </div>
          <div className="mono mt-4 text-sm text-muted">{isConnected && address ? shortAddress(address, 6) : "No wallet connected"}</div>
          <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              ["Chains", stats.chainsVisited],
              ["Routes", stats.routesCompleted],
              ["Assets moved", stats.assets],
              ["Volume routed", stats.liveCompleted ? formatUsd(stats.volumeUsd, { compact: true }) : "—"],
            ].map(([k, v]) => (
              <div key={String(k)}>
                <dt className="label text-[10px]">{k}</dt>
                <dd className="mono mt-1 text-2xl text-white">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2">
            <span className="label">
              Favorite route:{" "}
              {favSource && favDestination ? (
                <span className="text-white">
                  {favSource.name} → {favDestination.name}
                </span>
              ) : (
                <span className="text-muted-2">none yet</span>
              )}
            </span>
            <span className="label">
              Estimated fees paid: <span className="text-muted-2">— (not tracked)</span>
            </span>
          </div>
          <div className="mt-6">
            <div className="flex items-center justify-between">
              <Label className="text-[10px]">Level</Label>
              <Label className="text-[10px]">{next ? `${next.min - stats.liveCompleted} live routes to ${next.level}` : "Top level"}</Label>
            </div>
            <div className="mt-2 flex gap-1">
              {LEVELS.map((l, i) => (
                <span key={l.level} className={clsx("h-1.5 flex-1 rounded-full", i <= levelIndex ? "bg-energy" : "bg-graphite-2")} title={l.level} />
              ))}
            </div>
            <p className="label mt-2 normal-case tracking-normal text-muted-2">Levels are reputation only. Demo journeys count as routes, never as volume. Everything here lives in this browser.</p>
          </div>
          {!isConnected && (
            <Button variant="ghost" className="mt-6" onClick={openConnectModal}>
              Connect wallet
            </Button>
          )}
        </div>
      </Panel>

      <div className="flex flex-col gap-4">
        <Panel className="p-5" tilt={false}>
          <div className="flex items-center justify-between">
            <Label className="text-white">Portal balance</Label>
            <Tag tone={configured ? "energy" : "muted"}>{configured ? "Configured" : "Token not deployed"}</Tag>
          </div>
          {configured ? (
            <div className="mt-3">
              <div className="mono text-2xl text-white">
                {formatAmount(balance, PORTAL_TOKEN.decimals, 0)} <span className="text-sm text-muted">PORTAL · {chain?.name}</span>
              </div>
              <div className="label mt-2">
                Tier: <span className="text-white">{tier.name}</span> · next: {FEE_TIERS[FEE_TIERS.indexOf(tier) + 1]?.name ?? "—"}
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted">No $PORTAL contract is configured, so no balance is read and no tier applies. Set NEXT_PUBLIC_PORTAL_TOKEN_ROBINHOOD to enable it.</p>
          )}
        </Panel>

        <Panel className="p-5" tilt={false}>
          <div className="flex items-center justify-between">
            <Label className="text-white">Saved routes</Label>
            <Label className="text-[10px]">{mounted ? savedRoutes.length : 0}</Label>
          </div>
          {mounted && savedRoutes.length > 0 ? (
            <ul className="mt-3 flex flex-col divide-y divide-graphite">
              {savedRoutes.map((r) => {
                const a = chainById(r.sourceChain);
                const b = chainById(r.destinationChain);
                if (!a || !b) return null;
                return (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                    <Link href="/bridge" onClick={() => setPair(r.sourceChain, r.destinationChain, r.tokenSymbol)} className="flex items-center gap-2 text-sm text-white hover:text-energy">
                      <ChainGlyph chainKey={a.key} hue={a.hue} size={14} /> {a.name} <ArrowRight size={12} className="text-muted-2" /> <ChainGlyph chainKey={b.key} hue={b.hue} size={14} active={b.home} /> {b.name}
                      <span className="label ml-1">{r.tokenSymbol}</span>
                    </Link>
                    <button type="button" onClick={() => removeRoute(r.id)} className="text-muted hover:text-danger" aria-label="Remove">
                      <Trash2 size={14} />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted">Save a pair from the bridge with the bookmark button.</p>
          )}
        </Panel>
      </div>

      <Panel className="p-5 lg:col-span-2" tilt={false}>
        <div className="flex items-center justify-between">
          <Label className="text-white">Recent journeys</Label>
          <div className="flex items-center gap-2">
            <Tag tone={mode === "demo" ? "demo" : "energy"}>{mode === "demo" ? "Showing demo journeys" : "Showing live journeys"}</Tag>
            {mounted && journeys.length > 0 && (
              <button type="button" onClick={clear} className="label hover:text-danger">
                Clear
              </button>
            )}
          </div>
        </div>
        {mounted && journeys.filter((j) => j.mode === mode).length > 0 ? (
          <ul className="mt-2">
            {journeys
              .filter((j) => j.mode === mode)
              .slice(0, 30)
              .map((j) => (
                <CrossingRow key={j.id} c={j} />
              ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted">No journeys in {mode} mode yet. Open the portal to begin.</p>
        )}
      </Panel>
    </div>
  );
}
