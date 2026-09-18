"use client";

import { useEffect, useState } from "react";
import { chainByKey } from "@/config/chains";
import { useBridgeStore } from "@/lib/store/bridge";
import { targetEnergy, usePortalStore, type PortalPhase } from "@/lib/store/portal";
import type { TokenGlyph } from "@/types/token";
import { Portal } from "./Portal";
import { primeSim } from "./sim";

const PHASES: PortalPhase[] = ["dormant", "idle", "aligning", "locked", "building", "confirming", "open", "bridging", "complete", "error"];

/**
 * Forces the machine into a state read from the URL so any phase of the
 * portal can be captured or inspected on its own (scripts/capture.mjs).
 * Never rendered in production.
 */
export function PortalInspector() {
  const [label, setLabel] = useState("");
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const phase = q.get("phase") as PortalPhase | null;
    const crossing = Number(q.get("crossing") ?? "0");
    const source = chainByKey(q.get("source") ?? "ethereum");
    const destination = chainByKey(q.get("destination") ?? "robinhood");
    const glyph = (q.get("glyph") ?? "eth") as TokenGlyph;
    const bridge = useBridgeStore.getState();
    if (source && destination) bridge.setPair(source.id, destination.id, glyph === "eth" ? "ETH" : glyph === "usdc" ? "USDC" : glyph === "usdg" ? "USDG" : "POL");
    const portal = usePortalStore.getState();
    portal.finishIntro();
    if (source && destination) portal.align(source.key, destination.key);
    const t = setTimeout(() => {
      const p = usePortalStore.getState();
      if (crossing > 0) {
        p.beginCrossing({ glyph, symbol: glyph.toUpperCase() });
        p.setCrossing(Math.min(1, crossing));
      } else if (phase && PHASES.includes(phase)) {
        p.setPhase(phase);
      }
      const after = usePortalStore.getState();
      const locked = after.phase !== "idle" && after.phase !== "aligning" && after.phase !== "dormant" && after.phase !== "error";
      primeSim({ energy: targetEnergy(after), lock: locked ? 1 : 0, sweep: after.phase === "bridging" && crossing >= 0.45 && crossing < 0.8 ? 1 : 0 });
      setLabel(`${after.phase} · crossing ${crossing}`);
    }, 1200);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="mx-auto max-w-[1400px] px-4 pt-20">
      <div className="label mb-2">Portal inspector · {label}</div>
      <div className="h-[700px] w-full">
        <Portal className="h-full w-full" />
      </div>
    </div>
  );
}
