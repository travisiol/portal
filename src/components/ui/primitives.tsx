"use client";

import { clsx } from "clsx";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { useEffect, useRef, type HTMLAttributes, type MouseEvent, type ReactNode } from "react";
import type { DataSource } from "@/types/route";

/** Panel with a subtle perspective tilt toward the pointer (≤ 1.5°). */
export function Panel({ className, children, tilt = true, ...rest }: HTMLAttributes<HTMLDivElement> & { tilt?: boolean }) {
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const reduced = useReducedMotion();
  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!tilt || reduced) return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    ry.set(px * 3);
    rx.set(-py * 3);
  };
  const onLeave = () => {
    animate(rx, 0, { duration: 0.4 });
    animate(ry, 0, { duration: 0.4 });
  };
  return (
    <motion.div
      className={clsx("panel", className)}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 1200, transformStyle: "preserve-3d" }}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      {...(rest as object)}
    >
      {children}
    </motion.div>
  );
}

export function Tag({ children, tone = "muted", className }: { children: ReactNode; tone?: "muted" | "energy" | "danger" | "demo"; className?: string }) {
  return <span className={clsx("tag", tone === "energy" && "tag-energy", tone === "danger" && "tag-danger", tone === "demo" && "tag-demo", className)}>{children}</span>;
}

/** The one tag that decides how data is read. Always rendered next to route data. */
export function SourceTag({ source, className }: { source: DataSource; className?: string }) {
  return source === "demo" ? (
    <Tag tone="demo" className={className}>
      Demo data
    </Tag>
  ) : (
    <Tag tone="energy" className={className}>
      <span className="inline-block size-1.5 rounded-full bg-energy" />
      Live
    </Tag>
  );
}

export function Label({ children, className, ...rest }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={clsx("label", className)} {...rest}>
      {children}
    </span>
  );
}

/** Numbers animate between values instead of jumping. */
export function AnimatedNumber({ value, format, className }: { value: number; format: (v: number) => string; className?: string }) {
  const mv = useMotionValue(value);
  const text = useTransform(mv, (v) => format(v));
  const reduced = useReducedMotion();
  const first = useRef(true);
  useEffect(() => {
    if (first.current || reduced) {
      first.current = false;
      mv.set(value);
      return;
    }
    const controls = animate(mv, value, { duration: 0.55, ease: [0.22, 1, 0.36, 1] });
    return () => controls.stop();
  }, [value, mv, reduced]);
  return <motion.span className={className}>{text}</motion.span>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("animate-pulse rounded-md bg-graphite-2", className)} aria-hidden />;
}

export function Hairline({ className }: { className?: string }) {
  return <div className={clsx("hairline", className)} aria-hidden />;
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="mono rounded border border-graphite-2 bg-graphite px-1.5 py-0.5 text-[10px] text-muted">{children}</kbd>;
}
