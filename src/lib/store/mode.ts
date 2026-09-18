import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_MODE } from "@/lib/env";
import type { DataSource } from "@/types/route";

interface ModeState {
  mode: DataSource;
  setMode: (mode: DataSource) => void;
}

/**
 * DEMO / LIVE. Persisted, but hydrated explicitly from Providers after mount so
 * the server and the first client render agree (no hydration mismatch).
 */
export const useModeStore = create<ModeState>()(
  persist(
    (set) => ({
      mode: DEFAULT_MODE,
      setMode: (mode) => set({ mode }),
    }),
    { name: "portal.mode", skipHydration: true },
  ),
);

export const useMode = () => useModeStore((s) => s.mode);
