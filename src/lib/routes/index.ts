import type { RouteProvider } from "@/types/provider";
import type { DataSource, ProviderId } from "@/types/route";
import { acrossProvider } from "./across";
import { canonicalProvider } from "./canonical";
import { ccipProvider } from "./ccip";
import { DEMO_PROVIDERS } from "./demo";
import { lifiProvider } from "./lifi";
import { relayProvider } from "./relay";
import { stargateProvider } from "./stargate";

/** Real adapters, in the order they are asked. */
export const LIVE_PROVIDERS: readonly RouteProvider[] = [lifiProvider, acrossProvider, relayProvider, stargateProvider, canonicalProvider, ccipProvider];

/**
 * The registry is the only place the mode chooses providers. DEMO returns the
 * simulated set, LIVE the real one — never a mix.
 */
export const providersFor = (mode: DataSource): readonly RouteProvider[] => (mode === "live" ? LIVE_PROVIDERS : DEMO_PROVIDERS);

export const providerById = (mode: DataSource, id: ProviderId): RouteProvider | undefined => providersFor(mode).find((p) => p.id === id);
