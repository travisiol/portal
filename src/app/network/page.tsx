import type { Metadata } from "next";
import { NetworkMap } from "@/components/network/NetworkMap";
import { Label } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Network" };

export default function NetworkPage() {
  return (
    <section className="mx-auto max-w-[1400px] px-4 pb-10 pt-24 sm:px-6 lg:pt-28">
      <div className="mb-6">
        <Label>Network</Label>
        <h1 className="display mt-3 text-4xl text-white sm:text-5xl">The network.</h1>
        <p className="mt-3 max-w-xl text-sm text-muted">Robinhood Chain in the centre. A line glows when at least one live provider can route the pair; it stays graphite otherwise. Hover a chain for its routes.</p>
      </div>
      <NetworkMap tall />
    </section>
  );
}
