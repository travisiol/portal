import type { Metadata } from "next";
import { ADVANCED_FEATURES, FEE_TIERS, isPortalTokenConfigured, ROUTING_FEE_BPS, TOKEN_UTILITY_ACTIVE } from "@/config/token";
import { Label, Tag } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "$PORTAL" };

const state = (active: boolean) => (active ? <Tag tone="energy">Active</Tag> : <Tag>Inactive</Tag>);

export default function TokenPage() {
  const configured = isPortalTokenConfigured();
  return (
    <section className="mx-auto max-w-[1400px] px-4 pb-10 pt-24 sm:px-6 lg:pt-28">
      <div className="mb-8">
        <Label>Token</Label>
        <h1 className="display mt-3 text-4xl text-white sm:text-5xl">$PORTAL</h1>
        <p className="mt-3 max-w-xl text-sm text-muted">
          A configurable utility system. Nothing on this page is claimed active unless it is implemented and the token address is configured.
          {configured ? " A token address is configured." : " No token address is configured on this deployment."}
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="panel p-6">
          <div className="flex items-center justify-between">
            <Label className="text-white">1 · Routing fee discounts</Label>
            {state(TOKEN_UTILITY_ACTIVE.feeDiscounts)}
          </div>
          <p className="mt-3 text-sm text-muted">
            Holding PORTAL reduces PORTAL&apos;s own frontend routing fee. That fee is <span className="mono text-white">{ROUTING_FEE_BPS} bps</span> today, so there is nothing to discount yet. Bridge providers&apos; fees are not discounted.
          </p>
          <table className="mt-4 w-full text-sm">
            <tbody>
              {FEE_TIERS.map((t) => (
                <tr key={t.name} className="border-t border-graphite">
                  <td className="mono py-2 text-white">{t.threshold === 0n ? "0" : `${Number(t.threshold) / 1000}K`} PORTAL</td>
                  <td className="py-2 text-muted">{t.name}</td>
                  <td className="mono py-2 text-right text-muted">−{t.discountPct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="panel p-6">
          <div className="flex items-center justify-between">
            <Label className="text-white">2 · Advanced routing</Label>
            {state(TOKEN_UTILITY_ACTIVE.advancedRouting)}
          </div>
          <ul className="mt-3 flex flex-col divide-y divide-graphite">
            {ADVANCED_FEATURES.map((f) => (
              <li key={f.id} className="flex items-start justify-between gap-3 py-3">
                <div>
                  <div className="text-sm text-white">{f.name}</div>
                  <div className="mt-0.5 text-xs text-muted">{f.description}</div>
                  <div className="label mt-1 text-[10px]">Requires {FEE_TIERS[f.requiredTier].name}</div>
                </div>
                <Tag tone={f.implemented ? "energy" : "muted"}>{f.implemented ? "Implemented" : "Planned"}</Tag>
              </li>
            ))}
          </ul>
          <p className="label mt-3 normal-case tracking-normal text-muted-2">Implemented features are free for everyone until a token is configured; gating is a switch, not a promise.</p>
        </div>
        <div className="panel p-6">
          <div className="flex items-center justify-between">
            <Label className="text-white">3 · Portal treasury</Label>
            {state(TOKEN_UTILITY_ACTIVE.treasury)}
          </div>
          <p className="mt-3 text-sm text-muted">PORTAL takes no protocol fee, so there is no revenue and no treasury to display. This page will show real, on-chain balances the day a fee exists — never projected or simulated revenue.</p>
          <div className="panel-inset mt-4 px-4 py-3">
            <div className="label text-[10px]">Revenue to date</div>
            <div className="mono mt-1 text-2xl text-muted-2">—</div>
          </div>
        </div>
      </div>
    </section>
  );
}
