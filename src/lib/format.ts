import { formatUnits, parseUnits } from "viem";

/** 1.000000 → "1", 0.9963218 → "0.9963", 1234.5 → "1,234.5". */
export const formatAmount = (amount: bigint, decimals: number, maxFraction = 4): string => {
  const value = Number(formatUnits(amount, decimals));
  if (!Number.isFinite(value)) return "—";
  if (value === 0) return "0";
  if (Math.abs(value) < 1e-4) return value.toLocaleString("en-US", { maximumSignificantDigits: 3 });
  const fraction = Math.abs(value) >= 1000 ? 2 : maxFraction;
  return value.toLocaleString("en-US", { maximumFractionDigits: fraction });
};

export const formatUsd = (value: number | undefined, opts: { compact?: boolean } = {}): string => {
  if (value === undefined || !Number.isFinite(value)) return "—";
  if (opts.compact && Math.abs(value) >= 10_000) {
    return `$${value.toLocaleString("en-US", { notation: "compact", maximumFractionDigits: 1 })}`;
  }
  const fraction = Math.abs(value) < 10 ? 2 : Math.abs(value) < 1000 ? 2 : 0;
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: fraction, maximumFractionDigits: fraction })}`;
};

export const formatDuration = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  if (seconds < 60) return `~${Math.round(seconds)} sec`;
  if (seconds < 3600) return `~${Math.round(seconds / 60)} min`;
  if (seconds < 86_400) return `~${(seconds / 3600).toFixed(seconds % 3600 === 0 ? 0 : 1)} h`;
  return `~${Math.round(seconds / 86_400)} d`;
};

export const formatElapsed = (ms: number): string => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

export const shortAddress = (address: string, chars = 4): string => {
  if (!address) return "";
  return `${address.slice(0, chars + 2)}…${address.slice(-3)}`;
};

export const shortHash = (hash: string): string => (hash.length > 14 ? `${hash.slice(0, 8)}…${hash.slice(-6)}` : hash);

export const parseAmount = (input: string, decimals: number): bigint | undefined => {
  const clean = input.trim().replace(/,/g, "");
  if (!clean || !/^\d*\.?\d*$/.test(clean) || clean === ".") return undefined;
  try {
    return parseUnits(clean, decimals);
  } catch {
    return undefined;
  }
};

export const bpsToPct = (bps: number): string => `${(bps / 100).toFixed(2)}%`;

export const percentOf = (part: bigint, whole: bigint): number => (whole === 0n ? 0 : Number((part * 1_000_000n) / whole) / 10_000);
