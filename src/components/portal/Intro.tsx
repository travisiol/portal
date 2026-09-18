"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useBridgeStore } from "@/lib/store/bridge";
import { usePortalStore } from "@/lib/store/portal";
import { requireChain } from "@/config/chains";
import { Logo } from "@/components/ui/Logo";
import { markIntroSeen, shouldPlayIntro } from "./Portal";

type Stage = "black" | "approach" | "logo" | "done";

/**
 * Opening experience, first visit only, under 3 s, skippable:
 * black → INITIALIZING ROUTE → the dormant rig comes into view → one ring
 * rotates, the other locks → energy turns on → PORTAL → the interface.
 * Not played on refresh (localStorage) nor for reduced motion.
 */
export function IntroOverlay() {
  const [stage, setStage] = useState<Stage>(() => (shouldPlayIntro() ? "black" : "done"));
  const finishIntro = usePortalStore((s) => s.finishIntro);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  // Decided once at mount; the timeline must not restart (or be cancelled) when the stage advances.
  const play = useRef(stage === "black");

  useEffect(() => {
    if (!play.current) {
      finishIntro();
      return;
    }
    const { align } = usePortalStore.getState();
    const bridge = useBridgeStore.getState();
    const source = requireChain(bridge.sourceChainId).key;
    const destination = requireChain(bridge.destinationChainId).key;
    const at = (ms: number, fn: () => void) => timers.current.push(setTimeout(fn, ms));
    at(500, () => setStage("approach"));
    // one ring rotates, the other locks into position
    at(1100, () => align(source === "polygon" ? "optimism" : "polygon", destination));
    at(1500, () => align(source, destination));
    at(2000, () => finishIntro());
    at(2100, () => setStage("logo"));
    at(2850, () => {
      markIntroSeen();
      setStage("done");
    });
    const scheduled = timers.current;
    return () => {
      scheduled.forEach(clearTimeout);
    };
  }, [finishIntro]);

  const skip = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    const bridge = useBridgeStore.getState();
    usePortalStore.getState().align(requireChain(bridge.sourceChainId).key, requireChain(bridge.destinationChainId).key);
    finishIntro();
    markIntroSeen();
    setStage("done");
  };

  return (
    <AnimatePresence>
      {stage !== "done" && (
        <motion.div
          key="intro"
          className="fixed inset-0 z-[70] flex items-center justify-center"
          initial={{ backgroundColor: "rgba(5,6,7,1)" }}
          animate={{ backgroundColor: stage === "black" ? "rgba(5,6,7,1)" : "rgba(5,6,7,0)" }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          style={{ pointerEvents: "none" }}
        >
          <AnimatePresence mode="wait">
            {stage === "black" && (
              <motion.div key="init" className="label text-[10px] tracking-[0.3em] text-muted" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
                Initializing route
              </motion.div>
            )}
            {stage === "logo" && (
              <motion.div
                key="logo"
                className="flex flex-col items-center gap-4 text-white"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              >
                <Logo size={56} active />
                <div className="label text-[13px] tracking-[0.34em] text-white">PORTAL</div>
              </motion.div>
            )}
          </AnimatePresence>
          <button type="button" onClick={skip} className="label absolute bottom-8 right-8 text-[10px] text-muted transition-colors hover:text-white" style={{ pointerEvents: "auto" }}>
            Skip
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default IntroOverlay;
