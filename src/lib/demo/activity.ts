import { CHAINS, HOME_CHAIN } from "@/config/chains";
import type { ProviderId } from "@/types/route";

export interface Crossing {
  id: string;
  /** Already abbreviated — the full address is never generated. */
  wallet: string;
  sourceChain: number;
  destinationChain: number;
  amount: string;
  symbol: string;
  provider: ProviderId;
  providerName: string;
  seconds: number;
  /** Epoch ms. */
  at: number;
  source: "demo";
}

/** Seeded generator so the DEMO ACTIVITY feed is stable between renders and hydration-safe. */
const mulberry = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const PROVIDER_POOL: { id: ProviderId; name: string; seconds: [number, number] }[] = [
  { id: "relay", name: "Relay", seconds: [9, 22] },
  { id: "across", name: "Across", seconds: [12, 35] },
  { id: "lifi", name: "LI.FI", seconds: [20, 60] },
  { id: "stargate", name: "Stargate", seconds: [35, 90] },
];

const HEX = "0123456789abcdef";

/**
 * Demo crossings anchored to a fixed base time so server and client render
 * the same list. `anchor` is the epoch ms the list counts back from.
 */
export function demoCrossings(count = 12, anchor = 1_789_700_000_000): Crossing[] {
  const rnd = mulberry(4663);
  const others = CHAINS.filter((c) => !c.home);
  const list: Crossing[] = [];
  let at = anchor;
  for (let i = 0; i < count; i++) {
    const other = others[Math.floor(rnd() * others.length)];
    const inbound = rnd() < 0.7;
    const provider = PROVIDER_POOL[Math.floor(rnd() * PROVIDER_POOL.length)];
    const useStable = rnd() < 0.3;
    const amount = useStable ? (Math.round(rnd() * 4800 + 200) as number).toString() : (Math.round((rnd() * 3.2 + 0.05) * 100) / 100).toFixed(2);
    const wallet = `0x${Array.from({ length: 2 }, () => HEX[Math.floor(rnd() * 16)]).join("")}…${Array.from({ length: 3 }, () => HEX[Math.floor(rnd() * 16)].toUpperCase()).join("")}`;
    at -= Math.floor(rnd() * 240_000 + 20_000);
    list.push({
      id: `demo-${i}`,
      wallet,
      sourceChain: inbound ? other.id : HOME_CHAIN.id,
      destinationChain: inbound ? HOME_CHAIN.id : other.id,
      amount,
      symbol: useStable ? (other.key === "polygon" || other.key === "base" ? "USDC" : "USDG") : "ETH",
      provider: provider.id,
      providerName: provider.name,
      seconds: Math.round(provider.seconds[0] + rnd() * (provider.seconds[1] - provider.seconds[0])),
      at,
      source: "demo",
    });
  }
  return list;
}
