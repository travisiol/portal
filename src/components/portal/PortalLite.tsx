"use client";

import { clsx } from "clsx";
import { useEffect } from "react";
import { CHAINS, RING_ORDER } from "@/config/chains";
import { targetEnergy, usePortalStore } from "@/lib/store/portal";
import { destinationTarget, sourceTarget } from "./geometry";

const LABELS = RING_ORDER.map((k) => CHAINS.find((c) => c.key === k)!.label);
const deg = (rad: number) => (-rad * 180) / Math.PI; // SVG rotates clockwise

/**
 * The lightweight portal for phones and reduced motion: the same rings,
 * engravings, chevrons and energy core in SVG + CSS, driven by the same store.
 * The rotation transition doubles as the mechanical alignment; the lock is
 * reported when it ends.
 */
export function PortalLite({ className, compact = false }: { className?: string; compact?: boolean }) {
  const phase = usePortalStore((s) => s.phase);
  const hover = usePortalStore((s) => s.hoverBoost);
  const sourceKey = usePortalStore((s) => s.sourceKey);
  const destinationKey = usePortalStore((s) => s.destinationKey);
  const crossing = usePortalStore((s) => s.crossing);
  const lock = usePortalStore((s) => s.lock);
  const finishIntro = usePortalStore((s) => s.finishIntro);
  const energy = targetEnergy({ phase, hoverBoost: hover });
  const locked = phase !== "idle" && phase !== "aligning" && phase !== "dormant" && phase !== "error";

  // The lite portal has no intro: hand the machine straight to alignment.
  useEffect(() => {
    finishIntro();
  }, [finishIntro]);

  // No animation frames here: the ring transition ends, the lock closes.
  useEffect(() => {
    if (phase !== "aligning") return;
    const t = setTimeout(() => lock(), 720);
    return () => clearTimeout(t);
  }, [phase, sourceKey, destinationKey, lock]);

  const size = compact ? 220 : 320;
  const assetX = crossing < 0.45 ? -150 + (crossing / 0.45) * 150 : crossing < 0.62 ? 0 : 150 * Math.min(1, (crossing - 0.62) / 0.18);
  const assetVisible = (phase === "open" || phase === "bridging" || phase === "complete") && (crossing < 0.45 || crossing >= 0.62);
  const assetScale = crossing < 0.45 ? 1 - 0.85 * (crossing / 0.45) : Math.min(1, 0.15 + 0.85 * ((crossing - 0.62) / 0.18));

  return (
    <div className={clsx("relative mx-auto select-none", className)} style={{ width: size, height: size }} aria-hidden>
      <svg viewBox="-200 -200 400 400" width={size} height={size} className="block overflow-visible">
        <defs>
          <radialGradient id="lite-energy" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#B9F7FF" stopOpacity="0.95" />
            <stop offset="35%" stopColor="#70E7FF" stopOpacity="0.55" />
            <stop offset="75%" stopColor="#70E7FF" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#050607" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="lite-metal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3A4048" />
            <stop offset="100%" stopColor="#1F2429" />
          </linearGradient>
          {[
            { id: "src", r: 150 },
            { id: "dst", r: 118 },
          ].map(({ id, r }) => (
            <path key={id} id={`lite-${id}-path`} d={`M ${r} 0 A ${r} ${r} 0 1 0 ${-r} 0 A ${r} ${r} 0 1 0 ${r} 0`} fill="none" />
          ))}
        </defs>

        {/* housing */}
        <circle r="185" fill="none" stroke="url(#lite-metal)" strokeWidth="26" />
        <circle r="185" fill="none" stroke="#5a626b" strokeWidth="1" strokeDasharray="1 11.6" opacity="0.9" />
        <circle r="197" fill="none" stroke="#0F1215" strokeWidth="1.5" />
        <circle r="172" fill="none" stroke="#0F1215" strokeWidth="1.5" />

        {/* LEDs */}
        <g>
          {Array.from({ length: 36 }).map((_, i) => {
            const a = (i / 36) * Math.PI * 2;
            const on = phase === "open" || phase === "bridging" || phase === "complete" ? 1 : phase === "building" || phase === "confirming" || phase === "locked" ? (i % 3 === 0 ? 0.8 : 0.15) : i % 6 === 0 ? 0.35 : 0.05;
            return <circle key={i} cx={Math.cos(a) * 185} cy={Math.sin(a) * 185} r="2" fill={locked ? "#70E7FF" : "#8a949e"} opacity={on} />;
          })}
        </g>

        {/* source ring */}
        <g style={{ transform: `rotate(${deg(sourceTarget(sourceKey))}deg)`, transition: "transform 700ms cubic-bezier(0.22,1,0.36,1)" }}>
          <circle r="150" fill="none" stroke="#30363d" strokeWidth="28" />
          <text fontFamily="var(--font-geist-mono), ui-monospace, monospace" fontSize="12" fontWeight="600" letterSpacing="3" fill="#dfe4e8">
            {LABELS.map((label, i) => (
              <textPath key={label} href="#lite-src-path" startOffset={`${((i / LABELS.length) * 100 + 100 / LABELS.length / 2) % 100}%`} textAnchor="middle" dominantBaseline="middle">
                {label}
              </textPath>
            ))}
          </text>
        </g>
        {/* destination ring */}
        <g style={{ transform: `rotate(${deg(destinationTarget(destinationKey))}deg)`, transition: "transform 700ms cubic-bezier(0.22,1,0.36,1)" }}>
          <circle r="118" fill="none" stroke="#2a3037" strokeWidth="24" />
          <text fontFamily="var(--font-geist-mono), ui-monospace, monospace" fontSize="10" fontWeight="600" letterSpacing="2.5" fill="#d0d6db">
            {LABELS.map((label, i) => (
              <textPath key={label} href="#lite-dst-path" startOffset={`${((i / LABELS.length) * 100 + 100 / LABELS.length / 2) % 100}%`} textAnchor="middle" dominantBaseline="middle">
                {label}
              </textPath>
            ))}
          </text>
        </g>

        {/* bezel + energy */}
        <circle r="100" fill="#050607" />
        <circle r="100" fill="url(#lite-energy)" style={{ opacity: 0.08 + energy * 0.92, transition: "opacity 600ms ease", transformOrigin: "center", animation: energy > 0.3 ? "energy-breathe 3s ease-in-out infinite" : "none" }} />
        <circle r="100" fill="none" stroke="#3A4048" strokeWidth="8" />
        <circle r="96" fill="none" stroke="#70E7FF" strokeWidth="1" opacity={0.15 + energy * 0.6} />

        {/* chevrons */}
        <g style={{ transform: `translateX(${locked ? 8 : 0}px)`, transition: "transform 180ms cubic-bezier(0.3,1.6,0.5,1)" }}>
          <path d="M -226 -14 L -204 -14 L -196 0 L -204 14 L -226 14 Z" fill="#30363d" stroke="#0F1215" />
          <rect x="-206" y="-8" width="4" height="16" fill={locked ? "#70E7FF" : "#1C2025"} />
        </g>
        <g style={{ transform: `translateX(${locked ? -8 : 0}px)`, transition: "transform 180ms cubic-bezier(0.3,1.6,0.5,1)" }}>
          <path d="M 226 -14 L 204 -14 L 196 0 L 204 14 L 226 14 Z" fill="#30363d" stroke="#0F1215" />
          <rect x="202" y="-8" width="4" height="16" fill={locked ? "#70E7FF" : "#1C2025"} />
        </g>

        {/* crossing asset */}
        {assetVisible && (
          <g style={{ transform: `translateX(${assetX}px) scale(${assetScale})` }}>
            <circle r="22" fill="#262b31" stroke="#70E7FF" strokeWidth="1.5" />
            <path d="M 0 -12 L 10 4 L 0 9 L -10 4 Z" fill="none" stroke="#B9F7FF" strokeWidth="1.5" />
          </g>
        )}
      </svg>
    </div>
  );
}

export default PortalLite;
