"use client";

import { clsx } from "clsx";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CHAINS, HOME_CHAIN } from "@/config/chains";
import { providersForPair } from "@/config/providers";
import { useMode } from "@/lib/store/mode";
import type { ChainConfig } from "@/types/chain";
import { ChainGlyph } from "@/components/ui/Icons";
import { Label, Tag } from "@/components/ui/primitives";

const NetworkScene = dynamic(() => import("./NetworkScene"), { ssr: false, loading: () => <div className="h-full w-full" /> });

/**
 * THE NETWORK. Robinhood Chain in the centre, the others orbiting; a line
 * glows when at least one provider can route the pair, stays graphite
 * otherwise. The scene mounts only when the section scrolls into view.
 * Volume figures appear only when a live source exists — there is none yet.
 */
export function NetworkMap({ className, tall = false }: { className?: string; tall?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [hovered, setHovered] = useState<ChainConfig | undefined>();
  const mode = useMode();

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setMounted(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const routes = hovered ? (hovered.home ? CHAINS.length - 1 : providersForPair(hovered.id, HOME_CHAIN.id).filter((p) => p.status !== "demo-only").length) : 0;

  return (
    <div ref={host} className={clsx("relative w-full overflow-hidden rounded-[14px] border border-graphite bg-bg-2", tall ? "h-[70vh] min-h-[520px]" : "h-[420px] sm:h-[520px]", className)}>
      {mounted && <NetworkScene onHover={setHovered} hovered={hovered} />}
      <div className="pointer-events-none absolute left-4 top-4 flex flex-col gap-2">
        <Label className="text-white">The network</Label>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="h-px w-5 bg-energy" /> <Label className="text-[10px]">route available</Label>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-px w-5 bg-graphite-3" /> <Label className="text-[10px]">not routed</Label>
          </span>
        </div>
      </div>
      <div className={clsx("pointer-events-none absolute right-4 top-4 w-56 transition-opacity duration-200", hovered ? "opacity-100" : "opacity-0")}>
        {hovered && (
          <div className="panel p-3">
            <div className="flex items-center gap-2">
              <ChainGlyph chainKey={hovered.key} hue={hovered.hue} size={18} active={hovered.home} />
              <span className="text-sm font-medium text-white">{hovered.name}</span>
            </div>
            <div className="mt-2 flex flex-col gap-1">
              <span className="label">
                <span className="text-white">{routes}</span> {hovered.home ? "chains connected" : `route${routes === 1 ? "" : "s"} available`}
              </span>
              <span className="label">
                Routed today: <span className="text-muted-2">— {mode === "demo" ? "(no live source)" : "(indexer not configured)"}</span>
              </span>
            </div>
          </div>
        )}
      </div>
      <div className="pointer-events-auto absolute bottom-4 left-4 flex flex-wrap items-center gap-2">
        {CHAINS.filter((c) => !c.home).map((c) => {
          const n = providersForPair(c.id, HOME_CHAIN.id).filter((p) => p.status !== "demo-only").length;
          return (
            <Link key={c.key} href={`/routes/${c.key}/${HOME_CHAIN.key}`} className="tag hover:border-graphite-3 hover:text-white">
              {c.label} · {n}
            </Link>
          );
        })}
        <Tag>Robinhood Chain · centre</Tag>
      </div>
    </div>
  );
}
