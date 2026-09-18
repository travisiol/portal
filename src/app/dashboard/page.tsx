import type { Metadata } from "next";
import { Passport } from "@/components/passport/Passport";
import { Label } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Passport" };

export default function DashboardPage() {
  return (
    <section className="mx-auto max-w-[1400px] px-4 pb-10 pt-24 sm:px-6 lg:pt-28">
      <div className="mb-8">
        <Label>Dashboard</Label>
        <h1 className="display mt-3 text-4xl text-white sm:text-5xl">Portal passport.</h1>
      </div>
      <Passport />
    </section>
  );
}
