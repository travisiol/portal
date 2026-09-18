import type { Metadata } from "next";
import { PROVIDERS } from "@/config/providers";
import { RouteGrid } from "@/components/routes/RouteExplorer";
import { Label, Tag } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Routes" };

export default function RoutesPage() {
  const live = PROVIDERS.filter((p) => p.status === "live").length;
  return (
    <section className="mx-auto max-w-[1400px] px-4 pb-10 pt-24 sm:px-6 lg:pt-28">
      <div className="mb-8 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Label>Route explorer</Label>
          <h1 className="display mt-3 text-4xl text-white sm:text-5xl">Supported routes.</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Tag tone="energy">{live} live providers</Tag>
          <Tag>{PROVIDERS.length - live} adapters pending configuration</Tag>
        </div>
      </div>
      <RouteGrid />
    </section>
  );
}
