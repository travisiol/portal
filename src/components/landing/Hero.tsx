"use client";

import dynamic from "next/dynamic";
import { BridgePanel } from "@/components/bridge/BridgePanel";
import { Label } from "@/components/ui/primitives";

const IntroOverlay = dynamic(() => import("@/components/portal/Intro"), { ssr: false });

/** The application is the hero. Three lines of copy, then the machine. */
export function Hero() {
  return (
    <section className="relative mx-auto max-w-[1400px] px-4 pb-10 pt-24 sm:px-6 lg:pt-28">
      <IntroOverlay />
      <div className="mb-8 flex flex-col gap-4 lg:mb-10 lg:flex-row lg:items-end lg:justify-between">
        <div className="fade-up">
          <Label className="text-[10px] tracking-[0.3em] text-white">Portal</Label>
          <h1 className="display mt-3 text-[2.6rem] leading-[0.92] text-white sm:text-6xl lg:text-7xl">
            Move between
            <br />
            chains.
          </h1>
        </div>
        <p className="fade-up max-w-xs text-base leading-snug text-muted lg:text-right lg:text-lg" style={{ animationDelay: "120ms" }}>
          One route.
          <br />
          No bridge hunting.
        </p>
      </div>
      <BridgePanel variant="hero" className="fade-up" />
    </section>
  );
}
