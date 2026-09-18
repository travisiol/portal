import * as THREE from "three";
import { RING_ORDER } from "@/config/chains";
import type { ChainKey } from "@/types/chain";

/** Dimensions of the rig, in scene units. The housing's outer radius is 2.05. */
export const RIG = {
  housing: { inner: 1.76, outer: 2.05, half: 0.16 },
  sourceRing: { inner: 1.42, outer: 1.72, z: 0.03 },
  destinationRing: { inner: 1.1, outer: 1.38, z: 0.05 },
  bezel: { inner: 0.98, outer: 1.09, half: 0.09 },
  energyRadius: 1.0,
  ledRadius: 1.9,
  ledCount: 72,
  clampCount: 8,
  boltCount: 24,
} as const;

/** A machined ring: closed profile revolved around Y, then laid flat in the XY plane. */
export function latheRing(inner: number, outer: number, half: number, chamfer = 0.04, segments = 160): THREE.LatheGeometry {
  const c = Math.min(chamfer, half * 0.6, (outer - inner) * 0.3);
  const profile = [
    new THREE.Vector2(inner, -half + c),
    new THREE.Vector2(inner + c, -half),
    new THREE.Vector2(outer - c, -half),
    new THREE.Vector2(outer, -half + c),
    new THREE.Vector2(outer, half - c),
    new THREE.Vector2(outer - c, half),
    new THREE.Vector2(inner + c, half),
    new THREE.Vector2(inner, half - c),
    new THREE.Vector2(inner, -half + c),
  ];
  const geometry = new THREE.LatheGeometry(profile, segments);
  geometry.rotateX(Math.PI / 2); // revolve axis Y → Z so the ring faces the camera
  geometry.computeVertexNormals();
  return geometry;
}

export const SLOT_COUNT = RING_ORDER.length;
export const slotAngle = (key: ChainKey): number => (RING_ORDER.indexOf(key) * Math.PI * 2) / SLOT_COUNT;

/** Source engravings align at 9 o'clock (π), destination at 3 o'clock (0). */
export const sourceTarget = (key: ChainKey) => Math.PI - slotAngle(key);
export const destinationTarget = (key: ChainKey) => -slotAngle(key);

/** Signed shortest angular difference a → b. */
export const angleDelta = (a: number, b: number): number => {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
};

export const easeInCubic = (t: number) => t * t * t;
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const clamp01 = (t: number) => Math.max(0, Math.min(1, t));

/** Where the crossing asset is, for a timeline progress 0..1. */
export interface AssetPose {
  visible: boolean;
  x: number;
  y: number;
  z: number;
  scale: number;
  spin: number;
  /** 0..1 camera dolly through the ring. */
  dolly: number;
  flash: number;
}

/**
 * `reach` is how far from the centre the asset starts and rests, derived from
 * the visible half-width at the asset's depth. Wide canvases park it outside
 * the housing; narrow ones park it smaller, in front of the destination
 * engraving (the ring's 3 o'clock).
 */
export function assetPose(t: number, time: number, reach = 3.4): AssetPose {
  const narrow = reach < 2.7;
  const restX = narrow ? 1.25 : reach;
  const restScale = narrow ? 0.62 : 1;
  const start = narrow ? 2.3 : reach + 0.2;
  const startScale = narrow ? 0.62 : 1;
  const lift = 0;
  if (t <= 0) return { visible: false, x: -start, y: lift, z: 0.9, scale: startScale, spin: 0, dolly: 0, flash: 0 };
  if (t < 0.45) {
    const s = t / 0.45;
    const e = easeInCubic(s);
    return { visible: true, x: -start + start * e, y: 0.12 * Math.sin(s * Math.PI), z: 0.9 * (1 - e), scale: startScale - (startScale - 0.12) * e, spin: s * s * 9, dolly: 0, flash: 0 };
  }
  if (t < 0.62) {
    const u = (t - 0.45) / 0.17;
    const bump = Math.sin(u * Math.PI);
    return { visible: false, x: 0, y: 0, z: 0, scale: 0, spin: 0, dolly: bump, flash: bump * 0.6 };
  }
  if (t < 0.8) {
    const u = (t - 0.62) / 0.18;
    const e = easeOutCubic(u);
    return { visible: true, x: 0.15 + (restX - 0.15) * e, y: 0.08 * Math.sin(u * Math.PI), z: 0.9 * e, scale: 0.12 + (restScale - 0.12) * e, spin: 9 + u * 2, dolly: 0, flash: 0 };
  }
  const rest = clamp01((t - 0.8) / 0.2);
  return { visible: true, x: restX, y: 0.06 * Math.sin(time * 1.4), z: 0.9, scale: restScale, spin: 11 + time * 0.25, dolly: 0, flash: rest < 0.3 ? 1 - rest / 0.3 : 0 };
}
