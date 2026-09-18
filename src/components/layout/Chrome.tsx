"use client";

import { clsx } from "clsx";
import { Activity, ArrowLeftRight, Route, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { site } from "@/config/site";
import { PROVIDERS } from "@/config/providers";
import { usePortalStore } from "@/lib/store/portal";
import { Logo } from "@/components/ui/Logo";

/** A subtle cyan light that follows the pointer only over interactive portal areas. The cursor itself stays normal. */
export function CursorGlow() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (window.matchMedia("(pointer: coarse)").matches) return;
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    let x = 0;
    let y = 0;
    const paint = () => {
      raf = 0;
      el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    };
    const onMove = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
      const on = Boolean((e.target as Element | null)?.closest?.("[data-portal-interactive], .btn, a, button, input, [role=listbox]"));
      el.classList.toggle("is-on", on);
      if (!raf) raf = requestAnimationFrame(paint);
    };
    const onLeave = () => el.classList.remove("is-on");
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  return <div ref={ref} className="cursor-glow" aria-hidden />;
}

/** A 1 px energy line crosses the viewport every time a route is found. */
export function RoutePulse() {
  const pulseCount = usePortalStore((s) => s.pulseCount);
  if (!pulseCount) return null;
  return <div key={pulseCount} className="route-pulse" aria-hidden />;
}

const MOBILE = [
  { href: "/bridge", label: "Bridge", Icon: ArrowLeftRight },
  { href: "/routes", label: "Routes", Icon: Route },
  { href: "/activity", label: "Activity", Icon: Activity },
  { href: "/dashboard", label: "Profile", Icon: UserRound },
];

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-graphite bg-bg/90 backdrop-blur-sm md:hidden" aria-label="Mobile">
      <ul className="grid grid-cols-4">
        {MOBILE.map(({ href, label, Icon }) => {
          const current = pathname === href || (href === "/bridge" && pathname === "/");
          return (
            <li key={href}>
              <Link href={href} className={clsx("flex flex-col items-center gap-1 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]", current ? "text-energy" : "text-muted")}>
                <Icon size={18} strokeWidth={1.6} />
                <span className="label text-[9px]">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function Footer() {
  const live = PROVIDERS.filter((p) => p.status === "live").length;
  return (
    <footer className="mt-24 border-t border-graphite pb-24 md:pb-10">
      <div className="mx-auto grid max-w-[1400px] gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1fr_auto_auto]">
        <div>
          <div className="flex items-center gap-2.5 text-white">
            <Logo size={20} />
            <span className="label text-white">PORTAL</span>
          </div>
          <p className="mt-3 max-w-md text-sm text-muted">{site.tagline} PORTAL is a routing interface: every crossing is executed by an existing provider through its own contracts. PORTAL never holds funds.</p>
        </div>
        <div className="grid grid-cols-2 gap-x-10 gap-y-2 text-sm text-muted md:grid-cols-1">
          <Link href="/routes" className="hover:text-white">Routes</Link>
          <Link href="/network" className="hover:text-white">Network</Link>
          <Link href="/activity" className="hover:text-white">Activity</Link>
          <Link href="/dashboard" className="hover:text-white">Passport</Link>
          <Link href="/token" className="hover:text-white">$PORTAL</Link>
        </div>
        <div className="label leading-5 text-muted-2">
          {PROVIDERS.length} adapters · {live} live
          <br />
          Robinhood Chain · 4663
          <br />
          No fee taken by PORTAL today
        </div>
      </div>
    </footer>
  );
}
