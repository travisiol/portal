"use client";

import { motion, useMotionValue, useSpring } from "framer-motion";
import { clsx } from "clsx";
import { forwardRef, useCallback, useRef, type ButtonHTMLAttributes, type MouseEvent, type ReactNode } from "react";

export type ButtonVariant = "primary" | "ghost" | "quiet";

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart"> {
  variant?: ButtonVariant;
  /** Magnetic cursor attraction, up to `magnet` px. 0 disables it. */
  magnet?: number;
  icon?: ReactNode;
}

/**
 * Buttons feel physical: they drift a few pixels toward the pointer and
 * spring back. Reduced motion or coarse pointers get a static button.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant = "quiet", magnet = 4, icon, className, children, onMouseMove, onMouseLeave, ...rest }, ref) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 300, damping: 20, mass: 0.4 });
  const sy = useSpring(y, { stiffness: 300, damping: 20, mass: 0.4 });
  const box = useRef<HTMLButtonElement | null>(null);

  const setRefs = useCallback(
    (node: HTMLButtonElement | null) => {
      box.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    },
    [ref],
  );

  const handleMove = (e: MouseEvent<HTMLButtonElement>) => {
    onMouseMove?.(e);
    if (!magnet || !box.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = box.current.getBoundingClientRect();
    const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    x.set(Math.max(-1, Math.min(1, dx)) * magnet);
    y.set(Math.max(-1, Math.min(1, dy)) * magnet);
  };
  const handleLeave = (e: MouseEvent<HTMLButtonElement>) => {
    onMouseLeave?.(e);
    x.set(0);
    y.set(0);
  };

  return (
    <motion.button
      ref={setRefs}
      data-portal-interactive=""
      style={{ x: sx, y: sy }}
      className={clsx("btn", variant === "primary" && "btn-primary", variant === "ghost" && "btn-ghost", variant === "quiet" && "btn-quiet", className)}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      {...rest}
    >
      {icon}
      {children}
    </motion.button>
  );
});
