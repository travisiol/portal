import { create } from "zustand";
import { persist } from "zustand/middleware";
import { chainById } from "@/config/chains";
import type { Journey, PassportLevel, SavedRoute } from "@/types/passport";

interface PassportState {
  journeys: Journey[];
  savedRoutes: SavedRoute[];
  addJourney: (journey: Journey) => void;
  updateJourney: (id: string, patch: Partial<Journey>) => void;
  saveRoute: (route: Omit<SavedRoute, "id">) => void;
  removeRoute: (id: string) => void;
  clear: () => void;
}

const routeId = (r: Omit<SavedRoute, "id">) => `${r.sourceChain}-${r.destinationChain}-${r.tokenSymbol}`;

/** Local-only passport: journeys and saved routes live in this browser. */
export const usePassportStore = create<PassportState>()(
  persist(
    (set) => ({
      journeys: [],
      savedRoutes: [],
      addJourney: (journey) => set((s) => ({ journeys: [journey, ...s.journeys].slice(0, 200) })),
      updateJourney: (id, patch) => set((s) => ({ journeys: s.journeys.map((j) => (j.id === id ? { ...j, ...patch } : j)) })),
      saveRoute: (route) =>
        set((s) => {
          const id = routeId(route);
          if (s.savedRoutes.some((r) => r.id === id)) return s;
          return { savedRoutes: [...s.savedRoutes, { ...route, id }] };
        }),
      removeRoute: (id) => set((s) => ({ savedRoutes: s.savedRoutes.filter((r) => r.id !== id) })),
      clear: () => set({ journeys: [], savedRoutes: [] }),
    }),
    { name: "portal.passport", skipHydration: true },
  ),
);

export interface PassportStats {
  chainsVisited: number;
  routesCompleted: number;
  routesTotal: number;
  volumeUsd: number;
  assets: number;
  feesUsd: number;
  favorite?: { sourceChain: number; destinationChain: number; count: number };
  level: PassportLevel;
  liveCompleted: number;
  demoCompleted: number;
}

export const LEVELS: { level: PassportLevel; min: number }[] = [
  { level: "Explorer", min: 0 },
  { level: "Navigator", min: 10 },
  { level: "Gatekeeper", min: 50 },
];

/** Stats are derived from completed journeys. Demo journeys count for the UX, never as volume. */
export const passportStats = (journeys: Journey[]): PassportStats => {
  const completed = journeys.filter((j) => j.state === "arrived");
  const live = completed.filter((j) => j.mode === "live");
  const chains = new Set<number>();
  const assets = new Set<string>();
  const pairs = new Map<string, number>();
  let volumeUsd = 0;
  for (const j of completed) {
    chains.add(j.sourceChain);
    chains.add(j.destinationChain);
    assets.add(j.tokenSymbol);
    const key = `${j.sourceChain}>${j.destinationChain}`;
    pairs.set(key, (pairs.get(key) ?? 0) + 1);
  }
  for (const j of live) volumeUsd += j.usd ?? 0;
  let favorite: PassportStats["favorite"];
  for (const [key, count] of pairs) {
    if (!favorite || count > favorite.count) {
      const [a, b] = key.split(">").map(Number);
      favorite = { sourceChain: a, destinationChain: b, count };
    }
  }
  const level = [...LEVELS].reverse().find((l) => live.length >= l.min)?.level ?? "Explorer";
  return {
    chainsVisited: [...chains].filter((id) => chainById(id)).length,
    routesCompleted: completed.length,
    routesTotal: journeys.length,
    volumeUsd,
    assets: assets.size,
    feesUsd: 0,
    favorite,
    level,
    liveCompleted: live.length,
    demoCompleted: completed.length - live.length,
  };
};
