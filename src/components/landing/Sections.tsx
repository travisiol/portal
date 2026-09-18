"use client";

import { clsx } from "clsx";
import { motion } from "framer-motion";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { chainById, HOME_CHAIN } from "@/config/chains";
import { PROVIDERS } from "@/config/providers";
import { ADVANCED_FEATURES, FEE_TIERS, isPortalTokenConfigured, ROUTING_FEE_BPS, TOKEN_UTILITY_ACTIVE } from "@/config/token";
import { demoCrossings, type Crossing } from "@/lib/demo/activity";
import { useMode } from "@/lib/store/mode";
import { usePassportStore } from "@/lib/store/passport";
import { useBridgeStore } from "@/lib/store/bridge";
import { useMounted } from "@/lib/hooks";
import type { Journey } from "@/types/passport";
import { NetworkMap } from "@/components/network/NetworkMap";
import { Button } from "@/components/ui/Button";
import { ChainGlyph } from "@/components/ui/Icons";
import { Label, Panel, Tag } from "@/components/ui/primitives";

const reveal = { initial: { opacity: 0, y: 14 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: "-60px" }, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const } };

export function Section({ id, eyebrow, title, children, className, aside }: { id?: string; eyebrow: string; title?: ReactNode; children: ReactNode; className?: string; aside?: ReactNode }) {
  return (
    <section id={id} className={clsx("mx-auto max-w-[1400px] px-4 py-16 sm:px-6 lg:py-24", className)}>
      <motion.div {...reveal} className="mb-8 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Label>{eyebrow}</Label>
          {title && <h2 className="display mt-3 text-3xl text-white sm:text-4xl lg:text-5xl">{title}</h2>}
        </div>
        {aside}
      </motion.div>
      {children}
    </section>
  );
}

export function OneRoute() {
  return (
    <Section eyebrow="01 — One route" title="Three steps. One outcome.">
      <motion.div {...reveal} className="grid gap-px overflow-hidden rounded-[14px] border border-graphite bg-graphite md:grid-cols-3">
        {[
          ["PORTAL checks available routes.", `${PROVIDERS.filter((p) => p.status !== "demo-only").length} providers are asked at once. Slow ones never block the rest.`],
          ["You choose the outcome.", "Best value, fastest or lowest fees — every route is scored, nothing is labelled best without a number behind it."],
          ["PORTAL handles the path.", "Approvals, swaps and the crossing are shown before you sign. Your wallet confirms each step."],
        ].map(([h, p], i) => (
          <div key={h} className="bg-bg-2 p-6 lg:p-8">
            <span className="mono text-xs text-muted-2">0{i + 1}</span>
            <h3 className="mt-4 text-lg font-medium leading-snug text-white">{h}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{p}</p>
          </div>
        ))}
      </motion.div>
    </Section>
  );
}

export function NetworkSection() {
  return (
    <Section id="network" eyebrow="02 — Network" title="Robinhood Chain at the centre." aside={<Link href="/network" className="label flex items-center gap-1 hover:text-white">Open the map <ArrowUpRight size={12} /></Link>}>
      <motion.div {...reveal}>
        <NetworkMap />
      </motion.div>
    </Section>
  );
}

export function WhyPortal() {
  return (
    <Section eyebrow="03 — Why portal">
      <div className="grid gap-4 md:grid-cols-3">
        {[
          ["Fastest", "Compare route speed.", "Every quote carries the provider's own time estimate. The FASTEST label goes to the lowest one."],
          ["Cheapest", "Compare received amount.", "Fees are already inside what you receive. BEST VALUE ranks by net amount after gas."],
          ["Simplest", "One interface.", "Source, asset, destination. PORTAL does not care which bridge answers."],
        ].map(([h, s, p], i) => (
          <motion.div key={h} {...reveal} transition={{ ...reveal.transition, delay: i * 0.08 }}>
            <Panel className="h-full p-6">
              <h3 className="display text-3xl text-white">{h}</h3>
              <p className="mt-3 text-sm text-white">{s}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted">{p}</p>
            </Panel>
          </motion.div>
        ))}
      </div>
    </Section>
  );
}

export function TokenSection() {
  const configured = isPortalTokenConfigured();
  return (
    <Section
      eyebrow="04 — $PORTAL"
      title="Utility, only where it exists."
      aside={<Link href="/token" className="label flex items-center gap-1 hover:text-white">Token page <ArrowUpRight size={12} /></Link>}
    >
      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <motion.div {...reveal}>
          <Panel className="p-6" tilt={false}>
            <div className="flex items-center justify-between">
              <Label className="text-white">Routing fee discounts</Label>
              <Tag tone={TOKEN_UTILITY_ACTIVE.feeDiscounts ? "energy" : "muted"}>{TOKEN_UTILITY_ACTIVE.feeDiscounts ? "Active" : "Inactive"}</Tag>
            </div>
            <p className="mt-2 text-sm text-muted">
              PORTAL&apos;s own frontend routing fee is <span className="mono text-white">{ROUTING_FEE_BPS} bps</span> today — there is no fee to discount. Provider fees are never discounted.
            </p>
            <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {FEE_TIERS.map((t) => (
                <li key={t.name} className="panel-inset px-3 py-2">
                  <div className="mono text-sm text-white">{t.threshold === 0n ? "0" : `${Number(t.threshold) / 1000}K`} PORTAL</div>
                  <div className="label mt-1 text-[10px]">{t.name} · −{t.discountPct}%</div>
                </li>
              ))}
            </ul>
          </Panel>
        </motion.div>
        <motion.div {...reveal} transition={{ ...reveal.transition, delay: 0.08 }}>
          <Panel className="h-full p-6" tilt={false}>
            <div className="flex items-center justify-between">
              <Label className="text-white">Advanced routing</Label>
              <Tag tone={configured ? "energy" : "muted"}>{configured ? "Gated" : "Token not configured"}</Tag>
            </div>
            <ul className="mt-3 flex flex-col gap-2">
              {ADVANCED_FEATURES.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className={f.implemented ? "text-white" : "text-muted"}>{f.name}</span>
                  <Tag tone={f.implemented ? "energy" : "muted"}>{f.implemented ? "Implemented" : "Planned"}</Tag>
                </li>
              ))}
            </ul>
          </Panel>
        </motion.div>
      </div>
    </Section>
  );
}

export function CrossingRow({ c }: { c: Crossing | Journey }) {
  const source = chainById(c.sourceChain);
  const destination = chainById(c.destinationChain);
  const isJourney = "startedAt" in c;
  const amount = isJourney ? `${c.amountIn} ${c.tokenSymbol}` : `${c.amount} ${c.symbol}`;
  const seconds = isJourney ? (c.completedAt && c.startedAt ? Math.round((c.completedAt - c.startedAt) / 1000) : undefined) : c.seconds;
  const wallet = isJourney ? "you" : c.wallet;
  return (
    <li className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-graphite py-3 last:border-b-0 sm:grid-cols-[110px_1fr_140px_100px_70px]">
      <span className="mono text-xs text-muted">{wallet}</span>
      <span className="flex items-center gap-2 text-sm text-white">
        {source && <ChainGlyph chainKey={source.key} hue={source.hue} size={14} />}
        <span className="truncate">{source?.name}</span>
        <ArrowRight size={12} className="shrink-0 text-muted-2" />
        {destination && <ChainGlyph chainKey={destination.key} hue={destination.hue} size={14} active={destination.home} />}
        <span className="truncate">{destination?.name}</span>
      </span>
      <span className="mono text-right text-sm text-white sm:text-left">{amount}</span>
      <span className="label hidden sm:block">{c.providerName}</span>
      <span className="mono hidden text-xs text-muted sm:block">{seconds !== undefined ? `${seconds} sec` : isJourney && c.state !== "arrived" ? c.state.replace("_", " ") : "—"}</span>
    </li>
  );
}

export function RecentCrossings({ limit = 8, full = false }: { limit?: number; full?: boolean }) {
  const mode = useMode();
  const mounted = useMounted();
  const journeys = usePassportStore((s) => s.journeys);
  const demo = demoCrossings(limit);
  const own = mounted ? journeys.filter((j) => j.mode === mode).slice(0, full ? 50 : 4) : [];
  return (
    <Section
      id="activity"
      eyebrow={mode === "demo" ? "05 — Demo activity" : "05 — Recent crossings"}
      title={mode === "demo" ? "Recent crossings (demo)" : "Recent crossings"}
      aside={<Tag tone={mode === "demo" ? "demo" : "muted"}>{mode === "demo" ? "Demo data — simulated feed" : "Live feed needs an indexer"}</Tag>}
    >
      <motion.div {...reveal} className="panel px-4 sm:px-5">
        {own.length > 0 && (
          <>
            <div className="pt-4">
              <Label className="text-white">Your journeys</Label>
            </div>
            <ul>
              {own.map((j) => (
                <CrossingRow key={j.id} c={j} />
              ))}
            </ul>
          </>
        )}
        {mode === "demo" ? (
          <ul>
            {demo.map((c) => (
              <CrossingRow key={c.id} c={c} />
            ))}
          </ul>
        ) : (
          <p className="py-8 text-center text-sm text-muted">
            Live crossings by other wallets appear here once an indexer is configured. Your own journeys are listed above as they complete.
          </p>
        )}
      </motion.div>
    </Section>
  );
}

export function FinalCta() {
  const setPair = useBridgeStore((s) => s.setPair);
  return (
    <section className="mx-auto max-w-[1400px] px-4 pb-8 pt-8 sm:px-6">
      <motion.div {...reveal} className="panel relative overflow-hidden px-6 py-14 text-center sm:py-20">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-energy/60 to-transparent" />
        <Label>Ethereum → Portal → {HOME_CHAIN.name}</Label>
        <h2 className="display mt-4 text-4xl text-white sm:text-6xl">Open portal.</h2>
        <div className="mt-8 flex justify-center">
          <Link href="/bridge" onClick={() => setPair(1, HOME_CHAIN.id, "ETH")}>
            <Button variant="primary" className="h-12 px-8 text-[13px] tracking-[0.2em]" magnet={6}>
              Open portal
            </Button>
          </Link>
        </div>
      </motion.div>
    </section>
  );
}
