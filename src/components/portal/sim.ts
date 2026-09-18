import { createContext } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

/**
 * Per-frame simulation values shared by every part of the rig. A module
 * singleton (one portal scene exists at a time) so frame callbacks can write
 * to it freely; React never reads it during render.
 */
export interface Sim {
  energy: number;
  flash: number;
  time: number;
  /** 1 while the chevrons are closed. */
  lock: number;
  /** 0..1 camera dolly through the ring during a crossing. */
  dolly: number;
  quality: "high" | "low";
}

export const sim: Sim = { energy: 0, flash: 0, time: 0, lock: 0, dolly: 0, quality: "high" };

/** Static per-scene quality tier, read during render (never from the mutable sim). */
export const QualityContext = createContext<Sim["quality"]>("high");

export const resetSim = (quality: Sim["quality"]) => {
  sim.energy = 0;
  sim.flash = 0;
  sim.time = 0;
  sim.lock = 0;
  sim.dolly = 0;
  sim.quality = quality;
};

/** Procedural studio reflections — no HDRI file. Called from Canvas onCreated. */
export const applyStudioEnvironment = (gl: THREE.WebGLRenderer, scene: THREE.Scene, intensity = 0.55) => {
  const pmrem = new THREE.PMREMGenerator(gl);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = env;
  scene.environmentIntensity = intensity;
  pmrem.dispose();
  return env;
};

/** Deterministic PRNG so geometry built in render is pure and captures are stable. */
export const mulberry32 = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
