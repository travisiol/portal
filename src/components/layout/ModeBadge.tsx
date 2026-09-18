"use client";

import { clsx } from "clsx";
import { useMounted } from "@/lib/hooks";
import { useModeStore } from "@/lib/store/mode";

/**
 * DEMO / LIVE switch. Demo shows simulated, labeled routes; live only shows
 * what configured providers return. The badge itself is the label.
 */
export function ModeBadge({ className }: { className?: string }) {
  const mode = useModeStore((s) => s.mode);
  const setMode = useModeStore((s) => s.setMode);
  const mounted = useMounted();
  const live = mode === "live";
  return (
    <button
      type="button"
      onClick={() => setMode(live ? "demo" : "live")}
      data-portal-interactive=""
      title={live ? "LIVE MODE — real provider quotes. Click for demo mode." : "DEMO MODE — simulated routes. Click for live quotes."}
      aria-pressed={live}
      className={clsx(
        "field flex h-9 items-center gap-2 px-2.5 text-[10px]",
        !mounted && "opacity-0",
        className,
      )}
    >
      <span className={clsx("size-1.5 rounded-full", live ? "bg-energy shadow-[0_0_8px_#70E7FF]" : "bg-muted")} aria-hidden />
      <span className={clsx("label", live ? "text-energy" : "text-white")}>{live ? "Live" : "Demo"}</span>
      <span className="label hidden text-muted-2 sm:inline">mode</span>
    </button>
  );
}
