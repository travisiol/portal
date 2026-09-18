"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { chainByKey } from "@/config/chains";
import { usePortalStore } from "@/lib/store/portal";

/**
 * The words under the ring: ETHEREUM → ROBINHOOD CHAIN LOCKED, then ROUTE
 * FOUND. Driven by the lock counter, so every re-alignment speaks once.
 */
export function LockLabel() {
  const lockCount = usePortalStore((s) => s.lockCount);
  const phase = usePortalStore((s) => s.phase);
  const sourceKey = usePortalStore((s) => s.sourceKey);
  const destinationKey = usePortalStore((s) => s.destinationKey);
  const [shown, setShown] = useState<number>(0);

  useEffect(() => {
    if (!lockCount) return;
    const t1 = setTimeout(() => setShown(lockCount), 0);
    const t2 = setTimeout(() => setShown(0), 2600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [lockCount]);

  const source = chainByKey(sourceKey);
  const destination = chainByKey(destinationKey);
  const text =
    phase === "aligning"
      ? "Aligning"
      : shown
        ? `${destination?.name.toUpperCase()} LOCKED`
        : phase === "building" || phase === "confirming"
          ? "Route found"
          : phase === "error"
            ? "No route"
            : phase === "bridging" || phase === "open"
              ? "Portal open"
              : phase === "complete"
                ? "Arrived"
                : "";

  return (
    <div className="pointer-events-none flex h-6 items-center justify-center" aria-live="polite">
      <AnimatePresence mode="wait">
        {text && (
          <motion.div
            key={text}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25 }}
            className="label flex items-center gap-2 text-[10px] tracking-[0.24em]"
          >
            <span className="text-muted">{source?.label}</span>
            <span className="text-muted-2">→</span>
            <span className={phase === "error" ? "text-danger" : shown || phase === "building" || phase === "confirming" || phase === "complete" ? "text-energy" : "text-white"}>{text}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** ARRIVED. — the moment after the asset emerges. */
export function CrossingOverlay({ amount, symbol, chainName }: { amount?: string; symbol?: string; chainName?: string }) {
  const phase = usePortalStore((s) => s.phase);
  const crossing = usePortalStore((s) => s.crossing);
  const show = phase === "complete" && crossing >= 1 && amount;
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="pointer-events-none absolute inset-x-0 bottom-3 flex flex-col items-center gap-1"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="display text-2xl text-white">Arrived.</div>
          <div className="mono text-sm text-energy">
            {amount} {symbol}
          </div>
          <div className="label">{chainName}</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
