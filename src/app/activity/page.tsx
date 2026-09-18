import type { Metadata } from "next";
import { RecentCrossings } from "@/components/landing/Sections";
import { Label } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Activity" };

export default function ActivityPage() {
  return (
    <>
      <section className="mx-auto max-w-[1400px] px-4 pt-24 sm:px-6 lg:pt-28">
        <Label>Activity</Label>
        <h1 className="display mt-3 text-4xl text-white sm:text-5xl">Crossings.</h1>
        <p className="mt-3 max-w-xl text-sm text-muted">Addresses are abbreviated. In demo mode the feed is simulated and labelled; in live mode only your own journeys are shown until an indexer is connected.</p>
      </section>
      <RecentCrossings limit={24} full />
    </>
  );
}
