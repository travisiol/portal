"use client";

import { clsx } from "clsx";
import dynamic from "next/dynamic";
import { useEffect } from "react";
import { tokenBySymbol } from "@/config/tokens";
import { useCoarsePointer, useMounted, useNarrow, useReducedMotion } from "@/lib/hooks";
import { useBridgeStore } from "@/lib/store/bridge";
import { usePortalStore } from "@/lib/store/portal";
import { PortalLite } from "./PortalLite";

const INTRO_KEY = "portal.intro.v1";

/** First visit only, and never for reduced motion. */
export const shouldPlayIntro = (): boolean => {
  if (typeof window === "undefined") return false;
  try {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
    if (window.matchMedia("(max-width: 767px)").matches) return false;
    return window.localStorage.getItem(INTRO_KEY) !== "1";
  } catch {
    return false;
  }
};

export const markIntroSeen = () => {
  try {
    window.localStorage.setItem(INTRO_KEY, "1");
  } catch {
    /* private mode */
  }
};

const PortalScene = dynamic(() => import("./PortalScene"), {
  ssr: false,
  loading: () => <PortalPlaceholder />,
});

function PortalPlaceholder() {
  return (
    <div className="flex h-full w-full items-center justify-center" aria-hidden>
      <div className="size-[52%] rounded-full border border-graphite-2 opacity-60" />
    </div>
  );
}

/**
 * Chooses the full R3F portal or the lite SVG one. Phones, coarse pointers on
 * narrow screens and reduced motion get the lite version; everything else the
 * machine.
 */
export function Portal({ className, compact = false, withIntro = false }: { className?: string; compact?: boolean; withIntro?: boolean }) {
  const mounted = useMounted();
  const reduced = useReducedMotion();
  const narrow = useNarrow();
  const coarse = useCoarsePointer();
  const symbol = useBridgeStore((s) => s.sourceTokenSymbol);
  const finishIntro = usePortalStore((s) => s.finishIntro);
  const glyph = tokenBySymbol(symbol)?.glyph ?? "eth";
  const lite = reduced || narrow || compact;
  // The opening sequence exists only where an IntroOverlay is mounted (the landing hero);
  // everywhere else the machine goes straight to alignment.
  const intro = withIntro && !lite && shouldPlayIntro();
  useEffect(() => {
    if (!intro) finishIntro();
  }, [intro, finishIntro]);

  if (!mounted) {
    return (
      <div className={clsx("relative", className)}>
        <PortalPlaceholder />
      </div>
    );
  }
  if (lite) {
    return (
      <div className={clsx("relative flex items-center justify-center", className)}>
        <PortalLite compact={compact || narrow} />
      </div>
    );
  }
  return <PortalScene quality={coarse ? "low" : "high"} glyph={glyph} intro={intro} className={clsx("relative h-full w-full", className)} />;
}
