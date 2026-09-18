import Link from "next/link";
import { Label } from "@/components/ui/primitives";

export default function NotFound() {
  return (
    <section className="mx-auto flex max-w-[1400px] flex-col items-start gap-4 px-4 pb-10 pt-32 sm:px-6">
      <Label className="text-danger">No route available</Label>
      <h1 className="display text-4xl text-white">This page cannot be reached.</h1>
      <Link href="/" className="btn btn-ghost">
        Back to the portal
      </Link>
    </section>
  );
}
