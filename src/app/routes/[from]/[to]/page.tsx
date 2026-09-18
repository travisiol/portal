import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CHAINS, chainByKey } from "@/config/chains";
import { RouteDetail } from "@/components/routes/RouteExplorer";
import { ChainGlyph } from "@/components/ui/Icons";
import { Label } from "@/components/ui/primitives";

export function generateStaticParams() {
  return CHAINS.flatMap((a) => CHAINS.filter((b) => b.id !== a.id).map((b) => ({ from: a.key, to: b.key })));
}

export async function generateMetadata({ params }: PageProps<"/routes/[from]/[to]">): Promise<Metadata> {
  const { from, to } = await params;
  const a = chainByKey(from);
  const b = chainByKey(to);
  return { title: a && b ? `${a.name} → ${b.name}` : "Route" };
}

export default async function RoutePage({ params }: PageProps<"/routes/[from]/[to]">) {
  const { from, to } = await params;
  const a = chainByKey(from);
  const b = chainByKey(to);
  if (!a || !b || a.id === b.id) notFound();
  return (
    <section className="mx-auto max-w-[1400px] px-4 pb-10 pt-24 sm:px-6 lg:pt-28">
      <Link href="/routes" className="label hover:text-white">
        ← All routes
      </Link>
      <div className="mb-8 mt-4 flex flex-wrap items-center gap-4">
        <span className="flex items-center gap-2">
          <ChainGlyph chainKey={a.key} hue={a.hue} size={28} active={a.home} />
          <h1 className="display text-3xl text-white sm:text-5xl">{a.label}</h1>
        </span>
        <span className="display text-3xl text-muted-2 sm:text-5xl">→</span>
        <span className="flex items-center gap-2">
          <ChainGlyph chainKey={b.key} hue={b.hue} size={28} active={b.home} />
          <h1 className="display text-3xl text-white sm:text-5xl">{b.label}</h1>
        </span>
      </div>
      <div className="mb-6">
        <Label>
          {a.name} · chain {a.id} → {b.name} · chain {b.id}
        </Label>
      </div>
      <RouteDetail from={a} to={b} />
    </section>
  );
}
