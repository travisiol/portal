import { create } from "zustand";
import type { ChainKey } from "@/types/chain";
import type { TokenGlyph } from "@/types/token";

/**
 * The portal machine. One store, read by the 3D rig, the lite portal, the
 * CTA and the transaction modal. Phases follow the product flow:
 *
 * dormant → idle → aligning → locked → building → confirming → open → bridging → complete → idle
 */
export type PortalPhase = "dormant" | "idle" | "aligning" | "locked" | "building" | "confirming" | "open" | "bridging" | "complete" | "error";

export const ENERGY_BY_PHASE: Record<PortalPhase, number> = {
  dormant: 0,
  idle: 0.18,
  aligning: 0.3,
  locked: 0.45,
  building: 0.6,
  confirming: 0.75,
  open: 1,
  bridging: 1,
  complete: 0.35,
  error: 0.1,
};

export interface CrossingAsset {
  glyph: TokenGlyph;
  symbol: string;
}

interface PortalState {
  phase: PortalPhase;
  /** Extra energy while the pointer hovers OPEN PORTAL. */
  hoverBoost: boolean;
  sourceKey: ChainKey;
  destinationKey: ChainKey;
  /** Incremented every time the chevrons close; drives the "clac" and the lock label. */
  lockCount: number;
  /** Incremented when a route is found; drives the screen pulse. */
  pulseCount: number;
  /** Pointer in -1..1, for the parallax tilt. */
  pointer: { x: number; y: number };
  asset?: CrossingAsset;
  /** Progress of the crossing animation, 0..1, written by the modal timeline. */
  crossing: number;
  introDone: boolean;
  setPhase: (phase: PortalPhase) => void;
  align: (sourceKey: ChainKey, destinationKey: ChainKey) => void;
  lock: () => void;
  routeFound: () => void;
  setHoverBoost: (v: boolean) => void;
  setPointer: (x: number, y: number) => void;
  beginCrossing: (asset: CrossingAsset) => void;
  setCrossing: (t: number) => void;
  complete: () => void;
  resetToIdle: () => void;
  finishIntro: () => void;
}

export const usePortalStore = create<PortalState>()((set, get) => ({
  phase: "dormant",
  hoverBoost: false,
  sourceKey: "ethereum",
  destinationKey: "robinhood",
  lockCount: 0,
  pulseCount: 0,
  pointer: { x: 0, y: 0 },
  asset: undefined,
  crossing: 0,
  introDone: false,
  setPhase: (phase) => set({ phase }),
  align: (sourceKey, destinationKey) => {
    const s = get();
    if (s.sourceKey === sourceKey && s.destinationKey === destinationKey && s.phase !== "idle" && s.phase !== "dormant") return;
    set({ sourceKey, destinationKey, phase: s.phase === "dormant" ? "dormant" : "aligning" });
  },
  lock: () => {
    const s = get();
    if (s.phase !== "aligning" && s.phase !== "idle") return;
    set({ phase: "locked", lockCount: s.lockCount + 1 });
  },
  routeFound: () => {
    const s = get();
    if (s.phase === "locked" || s.phase === "idle") set({ phase: "building", pulseCount: s.pulseCount + 1 });
  },
  setHoverBoost: (hoverBoost) => set({ hoverBoost }),
  setPointer: (x, y) => set({ pointer: { x, y } }),
  beginCrossing: (asset) => set({ asset, crossing: 0, phase: "open" }),
  setCrossing: (crossing) => set({ crossing, phase: crossing >= 1 ? "complete" : "bridging" }),
  complete: () => set({ phase: "complete", crossing: 1 }),
  resetToIdle: () => set({ phase: "idle", crossing: 0, asset: undefined, hoverBoost: false }),
  finishIntro: () => set({ introDone: true, phase: get().phase === "dormant" ? "aligning" : get().phase }),
}));

export const targetEnergy = (s: Pick<PortalState, "phase" | "hoverBoost">): number => Math.min(1, ENERGY_BY_PHASE[s.phase] + (s.hoverBoost ? 0.15 : 0));
