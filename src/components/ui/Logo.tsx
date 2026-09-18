import type { SVGProps } from "react";

/**
 * PORTAL symbol: two incomplete concentric rings, one tangential break that
 * reads as something passing through them. The inner ring is the energy.
 * Works from 16 px (favicon) to 400 px (profile picture).
 */
export function Logo({ size = 24, active = false, ...props }: { size?: number; active?: boolean } & SVGProps<SVGSVGElement>) {
  // Ring circumferences for r=26 and r=16 in a 64-unit box; both gaps cover 62°, aligned at 40°.
  const outer = 2 * Math.PI * 26;
  const inner = 2 * Math.PI * 16;
  const gap = 62 / 360;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true" {...props}>
      <circle cx="32" cy="32" r="26" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeDasharray={`${outer * (1 - gap)} ${outer * gap}`} transform="rotate(-49 32 32)" />
      <circle cx="32" cy="32" r="16" stroke={active ? "#70E7FF" : "currentColor"} strokeWidth="4" strokeLinecap="round" strokeDasharray={`${inner * (1 - gap)} ${inner * gap}`} transform="rotate(-49 32 32)" opacity={active ? 1 : 0.7} />
    </svg>
  );
}
