import type { DataSource } from "@/types/route";

/**
 * Global environment: DEMO or LIVE. The build-time default comes from
 * NEXT_PUBLIC_PORTAL_MODE; the mode store (src/lib/store/mode.ts) lets the
 * visitor switch at runtime, and every quote carries its own `source` so the
 * two can never be displayed as one.
 */
export const DEFAULT_MODE: DataSource = process.env.NEXT_PUBLIC_PORTAL_MODE === "live" ? "live" : "demo";

export const WALLETCONNECT_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim() || undefined;

/** Placeholder used for indicative quotes when no wallet is connected. */
export const PLACEHOLDER_ADDRESS = "0x000000000000000000000000000000000000dEaD" as const;

export const QUOTE_TIMEOUT_MS = 12_000;
export const STATUS_POLL_MS = 5_000;
export const DEFAULT_SLIPPAGE_BPS = 50;
