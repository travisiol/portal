"use client";

import { clsx } from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { site } from "@/config/site";
import { useScrolled } from "@/lib/hooks";
import { usePortalStore } from "@/lib/store/portal";
import { Logo } from "@/components/ui/Logo";
import { ConnectButton } from "@/components/wallet/ConnectButton";
import { PortalBalance } from "@/components/wallet/PortalBalance";
import { ModeBadge } from "./ModeBadge";

const LINKS = [
  { href: "/bridge", label: "Bridge" },
  { href: "/routes", label: "Routes" },
  { href: "/network", label: "Network" },
  { href: "/activity", label: "Activity" },
];

/** Almost invisible: transparent black, a graphite hairline once the page scrolls. */
export function Navbar() {
  const scrolled = useScrolled(8);
  const pathname = usePathname();
  const phase = usePortalStore((s) => s.phase);
  const active = phase === "open" || phase === "bridging" || phase === "building" || phase === "confirming";
  return (
    <header className={clsx("fixed inset-x-0 top-0 z-50 border-b transition-colors duration-300", scrolled ? "border-graphite bg-bg/80 backdrop-blur-sm" : "border-transparent bg-transparent")}>
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 text-white" aria-label={`${site.name} home`}>
          <Logo size={22} active={active} />
          <span className="label text-[12px] tracking-[0.22em] text-white">PORTAL</span>
        </Link>
        <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 md:flex" aria-label="Primary">
          {LINKS.map((l) => {
            const current = pathname === l.href || (l.href === "/bridge" && pathname === "/");
            return (
              <Link key={l.href} href={l.href} data-portal-interactive="" className={clsx("label rounded-md px-3 py-2 transition-colors hover:text-white", current ? "text-white" : "text-muted")}>
                {l.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          <ModeBadge />
          <PortalBalance />
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}
