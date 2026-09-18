"use client";

import { ConnectButton as RainbowConnect } from "@rainbow-me/rainbowkit";
import { clsx } from "clsx";
import { Wallet } from "lucide-react";
import { chainById } from "@/config/chains";
import { shortAddress } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { ChainGlyph } from "@/components/ui/Icons";

/** RainbowKit under a PORTAL skin: mono labels, no avatar, chain glyph instead of a logo. */
export function ConnectButton({ compact = false }: { compact?: boolean }) {
  return (
    <RainbowConnect.Custom>
      {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
        const ready = mounted;
        const connected = ready && account && chain;
        if (!ready) return <div className="h-11 w-36 rounded-[10px] bg-graphite" aria-hidden />;
        if (!connected) {
          return (
            <Button variant="ghost" onClick={openConnectModal} icon={<Wallet size={14} />} className={clsx(compact && "h-10 px-3")}>
              Connect wallet
            </Button>
          );
        }
        const known = chainById(chain.id);
        return (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={openChainModal}
              data-portal-interactive=""
              className={clsx("field flex h-11 items-center gap-2 px-3 text-xs", chain.unsupported && "text-danger", compact && "h-10")}
              aria-label="Switch network"
              title={chain.name}
            >
              {known ? <ChainGlyph chainKey={known.key} hue={known.hue} size={16} /> : <span className="size-2 rounded-full bg-danger" />}
              <span className="label hidden text-white sm:inline">{chain.unsupported ? "Unsupported" : (known?.label ?? chain.name)}</span>
            </button>
            <button type="button" onClick={openAccountModal} data-portal-interactive="" className={clsx("field mono flex h-11 items-center gap-2 px-3 text-xs text-white", compact && "h-10")}>
              <span className="size-1.5 rounded-full bg-energy" aria-hidden />
              {shortAddress(account.address)}
            </button>
          </div>
        );
      }}
    </RainbowConnect.Custom>
  );
}
