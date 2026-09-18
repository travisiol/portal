import type { Metadata } from "next";
import { BridgePanel } from "@/components/bridge/BridgePanel";

export const metadata: Metadata = { title: "Bridge" };

export default function BridgePage() {
  return (
    <section className="mx-auto max-w-[1400px] px-4 pb-10 pt-24 sm:px-6 lg:pt-28">
      <BridgePanel variant="app" />
    </section>
  );
}
