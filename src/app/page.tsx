import { Hero } from "@/components/landing/Hero";
import { FinalCta, NetworkSection, OneRoute, RecentCrossings, TokenSection, WhyPortal } from "@/components/landing/Sections";

export default function HomePage() {
  return (
    <>
      <Hero />
      <OneRoute />
      <NetworkSection />
      <WhyPortal />
      <TokenSection />
      <RecentCrossings />
      <FinalCta />
    </>
  );
}
