import type { ChainKey } from "@/types/chain";
import type { TokenGlyph } from "@/types/token";

/**
 * Chain and token glyphs are simple monochrome geometry drawn in code — no
 * brand assets, no colour except the chain's faint tint. Cyan stays reserved
 * for energy.
 */
const tint = (hue: number) => `hsl(${hue} 18% 78%)`;

export function ChainGlyph({ chainKey, hue = 210, size = 20, active = false }: { chainKey: ChainKey; hue?: number; size?: number; active?: boolean }) {
  const stroke = active ? "#70E7FF" : tint(hue);
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke, strokeWidth: 1.6, strokeLinejoin: "round" as const, strokeLinecap: "round" as const, "aria-hidden": true };
  switch (chainKey) {
    case "ethereum":
      return (
        <svg {...common}>
          <path d="M12 3l6 9-6 3.6L6 12l6-9z" />
          <path d="M6 13.5l6 7.5 6-7.5-6 3.6-6-3.6z" />
        </svg>
      );
    case "base":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M3.5 12h9" />
        </svg>
      );
    case "arbitrum":
      return (
        <svg {...common}>
          <path d="M12 3l8 4.6v8.8L12 21l-8-4.6V7.6L12 3z" />
          <path d="M9 16l3-8 3 8M10.2 13h3.6" />
        </svg>
      );
    case "optimism":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.5" />
          <circle cx="12" cy="12" r="3.2" />
        </svg>
      );
    case "polygon":
      return (
        <svg {...common}>
          <path d="M8 6.5l4-2.3 4 2.3v4.6l-4 2.3-4-2.3V6.5z" />
          <path d="M8 13.4v4.6l4 2.3 4-2.3v-4.6" />
        </svg>
      );
    case "robinhood":
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.5" strokeDasharray="40 13.4" transform="rotate(-49 12 12)" />
          <circle cx="12" cy="12" r="3.4" fill={stroke} stroke="none" />
        </svg>
      );
  }
}

export function TokenGlyphIcon({ glyph, size = 20 }: { glyph: TokenGlyph; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "#F3F5F7", strokeWidth: 1.6, strokeLinejoin: "round" as const, strokeLinecap: "round" as const, "aria-hidden": true };
  switch (glyph) {
    case "eth":
      return (
        <svg {...common}>
          <path d="M12 3l6 9-6 3.6L6 12l6-9z" fill="rgba(243,245,247,0.12)" />
          <path d="M6 13.5l6 7.5 6-7.5-6 3.6-6-3.6z" />
        </svg>
      );
    case "usdc":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M14.5 9.2c-.4-.9-1.3-1.4-2.5-1.4-1.6 0-2.6.8-2.6 1.9 0 2.6 5.4 1.1 5.4 3.9 0 1.3-1.1 2.1-2.8 2.1-1.4 0-2.4-.6-2.8-1.6M12 6v1.8M12 16.2V18" />
        </svg>
      );
    case "usdg":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M15 9.5a3.4 3.4 0 1 0 0 5h0v-2.3h-2.6" />
        </svg>
      );
    case "pol":
      return (
        <svg {...common}>
          <path d="M8 6.5l4-2.3 4 2.3v4.6l-4 2.3-4-2.3V6.5z" />
          <path d="M8 13.4v4.6l4 2.3 4-2.3v-4.6" />
        </svg>
      );
    case "portal":
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.5" strokeDasharray="40 13.4" transform="rotate(-49 12 12)" />
          <circle cx="12" cy="12" r="4.5" stroke="#70E7FF" strokeDasharray="21 7.3" transform="rotate(-49 12 12)" />
        </svg>
      );
  }
}
