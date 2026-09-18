import * as THREE from "three";
import { CHAINS, RING_ORDER } from "@/config/chains";
import { mulberry32 } from "./sim";

/**
 * Every texture on the portal is painted on a canvas at mount: engraved ticks
 * and index numbers for the housing, the chain engravings for the glyph
 * rings. Nothing is downloaded.
 */
const canvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};

/** Roughness/bump strip for a lathe ring: u = around, v = along the profile. */
export function tickTexture(opts: { width?: number; height?: number; ticks?: number; majorEvery?: number; base?: number } = {}): THREE.CanvasTexture {
  const { width = 2048, height = 128, ticks = 180, majorEvery = 10, base = 150 } = opts;
  const c = canvas(width, height);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = `rgb(${base},${base},${base})`;
  ctx.fillRect(0, 0, width, height);
  // brushed grain: faint horizontal streaks (seeded, so every mount paints the same metal)
  const rnd = mulberry32(4663);
  for (let i = 0; i < 900; i++) {
    const y = rnd() * height;
    const v = base + (rnd() - 0.5) * 34;
    ctx.strokeStyle = `rgba(${v},${v},${v},0.55)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  for (let i = 0; i < ticks; i++) {
    const x = (i / ticks) * width;
    const major = i % majorEvery === 0;
    ctx.fillStyle = major ? "rgb(230,230,230)" : "rgb(205,205,205)";
    const h = major ? height * 0.42 : height * 0.22;
    ctx.fillRect(x, height * 0.5 - h / 2, major ? 3 : 2, h);
    if (major) {
      ctx.fillStyle = "rgb(215,215,215)";
      ctx.font = `${Math.round(height * 0.16)}px ui-monospace, Menlo, monospace`;
      ctx.textAlign = "left";
      ctx.fillText(String(i * (360 / ticks)).padStart(3, "0"), x + 7, height * 0.5 - h / 2 + height * 0.14);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.anisotropy = 4;
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

export interface GlyphRingOptions {
  size?: number;
  innerRadius: number; // 0..1 of the texture's half size
  outerRadius: number;
  labels?: string[];
  /** Angle (radians) of the first label. */
  start?: number;
  fontPx?: number;
}

/**
 * The engravings: the chain names placed at equal angles around a ring, read
 * along the circumference. Returns the colour map (metal + lighter text).
 * Slot i sits at angle start + i * 2π/n, measured counter-clockwise from +x
 * in three.js world space (the canvas y axis is flipped to match).
 */
const monoFamily = (): string => {
  if (typeof window === "undefined") return "ui-monospace, Menlo, monospace";
  const v = getComputedStyle(document.documentElement).getPropertyValue("--font-geist-mono").trim();
  return v ? `${v}, ui-monospace, Menlo, monospace` : "ui-monospace, Menlo, monospace";
};

export interface GlyphRing {
  texture: THREE.CanvasTexture;
  /** Redraw (after web fonts load) and flag the texture for upload. */
  repaint: () => void;
}

export function createGlyphRing(opts: GlyphRingOptions): GlyphRing {
  const { size = 1024, innerRadius, outerRadius, labels = RING_ORDER.map((k) => CHAINS.find((c) => c.key === k)!.label), start = 0, fontPx = 34 } = opts;
  const c = canvas(size, size);
  const ctx = c.getContext("2d")!;
  const half = size / 2;
  const paint = () => {
    ctx.clearRect(0, 0, size, size);
    // base metal, slightly darker than the housing
    ctx.fillStyle = "rgb(58,63,70)";
    ctx.beginPath();
    ctx.arc(half, half, outerRadius * half, 0, Math.PI * 2);
    ctx.arc(half, half, innerRadius * half, 0, Math.PI * 2, true);
    ctx.fill();
    // faint circular brushing (deterministic so repaint is stable)
    for (let i = 0; i < 40; i++) {
      const f = (i * 0.618) % 1;
      const rr = (innerRadius + (outerRadius - innerRadius) * f) * half;
      const v = 58 + ((i * 7) % 18) - 9;
      ctx.strokeStyle = `rgba(${v},${v + 4},${v + 8},0.6)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(half, half, rr, 0, Math.PI * 2);
      ctx.stroke();
    }
    const n = labels.length;
    const mid = ((innerRadius + outerRadius) / 2) * half;
    ctx.font = `600 ${fontPx}px ${monoFamily()}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    labels.forEach((label, i) => {
      const angle = start + (i * Math.PI * 2) / n;
      // canvas y grows downward; world y grows upward → negate the angle
      const cx = half + Math.cos(angle) * mid;
      const cy = half - Math.sin(angle) * mid;
      ctx.save();
      ctx.translate(cx, cy);
      // text reads along the circumference, upright at the top of the ring
      ctx.rotate(-angle + Math.PI / 2);
      ctx.fillStyle = "rgba(226,230,234,0.92)";
      const chars = label.split("");
      const spacing = fontPx * 0.32;
      const widths = chars.map((ch) => ctx.measureText(ch).width + spacing);
      const total = widths.reduce((a, b) => a + b, 0) - spacing;
      let x = -total / 2;
      chars.forEach((ch, j) => {
        ctx.fillText(ch, x + widths[j] / 2 - spacing / 2, 0);
        x += widths[j];
      });
      ctx.restore();
      // separator tick between slots
      const sep = angle + Math.PI / n;
      ctx.save();
      ctx.translate(half + Math.cos(sep) * mid, half - Math.sin(sep) * mid);
      ctx.rotate(-sep);
      ctx.fillStyle = "rgba(200,205,210,0.7)";
      ctx.fillRect(-((outerRadius - innerRadius) * half * 0.28), -1, (outerRadius - innerRadius) * half * 0.56, 2);
      ctx.restore();
    });
  };
  paint();
  const texture = new THREE.CanvasTexture(c);
  texture.anisotropy = 8;
  texture.colorSpace = THREE.SRGBColorSpace;
  return {
    texture,
    repaint: () => {
      paint();
      texture.needsUpdate = true;
    },
  };
}
