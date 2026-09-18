import { notFound } from "next/navigation";
import { PortalInspector } from "@/components/portal/PortalInspector";

/** Development only: /dev/portal?phase=bridging&crossing=0.95&source=ethereum&destination=robinhood&glyph=eth */
export default function DevPortalPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <PortalInspector />;
}
