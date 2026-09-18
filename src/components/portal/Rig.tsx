"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useContext, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { targetEnergy, usePortalStore } from "@/lib/store/portal";
import type { TokenGlyph } from "@/types/token";
import { angleDelta, assetPose, destinationTarget, latheRing, RIG, sourceTarget } from "./geometry";
import { ENERGY_FRAGMENT, ENERGY_VERTEX, PARTICLE_FRAGMENT, PARTICLE_VERTEX } from "./shaders";
import { mulberry32, QualityContext, sim } from "./sim";
import { createGlyphRing, tickTexture } from "./textures";

export const ENERGY_A = new THREE.Color("#70E7FF");
export const ENERGY_B = new THREE.Color("#B9F7FF");
const TITANIUM = new THREE.Color("#2A2F36");
const GRAPHITE = new THREE.Color("#14171B");
const LED_OFF = new THREE.Color("#1a1e23");
const LED_DIM = new THREE.Color("#6c7680");

/** Brushed dark titanium. One texture and one material per use; disposed with the component. */
function useTitanium(roughness = 0.38) {
  const quality = useContext(QualityContext);
  const ticks = useMemo(() => tickTexture(), []);
  const material = useMemo(() => {
    const m = new THREE.MeshPhysicalMaterial({
      color: TITANIUM,
      metalness: 0.94,
      roughness,
      roughnessMap: ticks,
      bumpMap: ticks,
      bumpScale: 0.012,
      envMapIntensity: 1.0,
      clearcoat: 0.08,
      clearcoatRoughness: 0.5,
      anisotropy: quality === "high" ? 0.7 : 0,
      anisotropyRotation: Math.PI / 2,
    });
    return m;
  }, [ticks, roughness, quality]);
  useEffect(
    () => () => {
      material.dispose();
      ticks.dispose();
    },
    [material, ticks],
  );
  return material;
}

export function Housing() {
  const quality = useContext(QualityContext);
  const material = useTitanium();
  const geometry = useMemo(() => latheRing(RIG.housing.inner, RIG.housing.outer, RIG.housing.half, 0.045, quality === "high" ? 192 : 96), [quality]);
  const bolts = useRef<THREE.InstancedMesh>(null);
  const clamps = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    const mesh = bolts.current;
    if (!mesh) return;
    const r = (RIG.housing.inner + RIG.housing.outer) / 2 + 0.06;
    for (let i = 0; i < RIG.boltCount; i++) {
      const a = (i / RIG.boltCount) * Math.PI * 2 + Math.PI / RIG.boltCount;
      dummy.position.set(Math.cos(a) * r, Math.sin(a) * r, RIG.housing.half);
      dummy.rotation.set(Math.PI / 2, 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [dummy]);

  useFrame(() => {
    const mesh = clamps.current;
    if (!mesh) return;
    for (let i = 0; i < RIG.clampCount; i++) {
      const a = (i / RIG.clampCount) * Math.PI * 2 + Math.PI / 8;
      // clamps breathe slowly when idle and close by 3 cm when locked
      const breathe = Math.sin(sim.time * 0.8 + i * 1.3) * 0.012 * (1 - sim.lock);
      const r = RIG.housing.outer + 0.07 - sim.lock * 0.03 + breathe;
      dummy.position.set(Math.cos(a) * r, Math.sin(a) * r, 0);
      dummy.rotation.set(0, 0, a);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <mesh geometry={geometry} material={material} />
      <instancedMesh ref={bolts} args={[undefined, undefined, RIG.boltCount]} material={material}>
        <cylinderGeometry args={[0.028, 0.028, 0.02, 12]} />
      </instancedMesh>
      <instancedMesh ref={clamps} args={[undefined, undefined, RIG.clampCount]} material={material}>
        <boxGeometry args={[0.16, 0.22, 0.44]} />
      </instancedMesh>
    </group>
  );
}

export function Bezel() {
  const material = useTitanium(0.3);
  const geometry = useMemo(() => latheRing(RIG.bezel.inner, RIG.bezel.outer, RIG.bezel.half, 0.03, 128), []);
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.z -= dt * (0.05 + sim.energy * 0.25 + sim.sweep * 1.4);
  });
  return <mesh ref={ref} geometry={geometry} material={material} />;
}

/**
 * One engraved ring. Rotates toward the slot that must face the lock (9 or
 * 3 o'clock) with damping, then reports "settled" once.
 */
export function GlyphRing({ side, inner, outer, z, onSettle }: { side: "source" | "destination"; inner: number; outer: number; z: number; onSettle: () => void }) {
  const ring = useMemo(() => createGlyphRing({ innerRadius: inner / outer, outerRadius: 1, fontPx: side === "source" ? 36 : 30 }), [inner, outer, side]);
  useEffect(() => {
    let alive = true;
    document.fonts?.ready.then(() => alive && ring.repaint());
    return () => {
      alive = false;
      ring.texture.dispose();
    };
  }, [ring]);
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: ring.texture,
        metalness: 0.85,
        roughness: 0.42,
        transparent: true,
        envMapIntensity: 0.9,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      }),
    [ring],
  );
  useEffect(() => () => material.dispose(), [material]);
  const mesh = useRef<THREE.Mesh>(null);
  const settled = useRef(true);
  const rotation = useRef(side === "source" ? sourceTarget("ethereum") : destinationTarget("robinhood"));

  useFrame((_, dt) => {
    const state = usePortalStore.getState();
    const target = side === "source" ? sourceTarget(state.sourceKey) : destinationTarget(state.destinationKey);
    const delta = angleDelta(rotation.current, target);
    const step = delta * (1 - Math.exp(-Math.min(dt, 0.05) * 7.5));
    rotation.current += step;
    if (Math.abs(delta) > 0.004) {
      settled.current = false;
    } else if (!settled.current) {
      rotation.current = target;
      settled.current = true;
      onSettle();
    } else if (state.phase === "aligning") {
      // already on target when the request came in (same chain re-selected)
      onSettle();
    }
    if (mesh.current) {
      mesh.current.rotation.z = rotation.current;
      // a hair of lift while turning: the ring is a physical part on a bearing
      mesh.current.position.z = z + Math.abs(step) * 0.6;
    }
  });

  return (
    <mesh ref={mesh} position={[0, 0, z]} material={material}>
      <ringGeometry args={[inner, outer, 128]} />
    </mesh>
  );
}

export function Leds() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);
  useEffect(() => {
    const m = mesh.current;
    if (!m) return;
    for (let i = 0; i < RIG.ledCount; i++) {
      const a = (i / RIG.ledCount) * Math.PI * 2;
      dummy.position.set(Math.cos(a) * RIG.ledRadius, Math.sin(a) * RIG.ledRadius, RIG.housing.half + 0.006);
      dummy.rotation.set(0, 0, a);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
      m.setColorAt(i, LED_OFF);
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [dummy]);

  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    const { phase } = usePortalStore.getState();
    const chase = (sim.time * (0.6 + sim.energy * 2.2)) % 1;
    for (let i = 0; i < RIG.ledCount; i++) {
      const f = i / RIG.ledCount;
      let on = 0;
      if (phase === "dormant") on = 0;
      else if (phase === "idle" || phase === "aligning") on = i % 6 === 0 ? 0.35 : 0;
      else if (phase === "locked") on = i % 3 === 0 ? 0.6 : 0.05;
      else if (phase === "building" || phase === "confirming") {
        const d = Math.abs(((f - chase + 1.5) % 1) - 0.5);
        on = Math.max(i % 3 === 0 ? 0.35 : 0.05, 1 - d * 9);
      } else if (phase === "bridging" && sim.sweep > 0.05) {
        // loading: a comet with a fading tail circles the ring, three tails apart
        const head = (sim.sweepAngle / (Math.PI * 2)) % 1;
        const tail = Math.pow(1 - ((head - f + 1) % 1), 6);
        on = 0.08 + 0.92 * tail * sim.sweep + 0.25 * (1 - sim.sweep);
      } else if (phase === "open" || phase === "bridging") on = 0.75 + 0.25 * Math.sin(sim.time * 6 + f * 12);
      else if (phase === "complete") on = 0.5 + sim.flash * 0.5;
      else on = i % 2 === 0 ? 0.4 : 0;
      const energetic = phase !== "idle" && phase !== "aligning" && phase !== "dormant";
      color.copy(LED_OFF).lerp(energetic ? ENERGY_A : LED_DIM, Math.min(1, on));
      if (sim.flash > 0) color.lerp(ENERGY_B, sim.flash * 0.7);
      m.setColorAt(i, color);
    }
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, RIG.ledCount]}>
      <boxGeometry args={[0.022, 0.05, 0.01]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}

/** The two lock chevrons at 9 and 3 o'clock. They close ("clac") when the rings settle. */
export function Chevrons() {
  const material = useTitanium(0.32);
  const left = useRef<THREE.Group>(null);
  const right = useRef<THREE.Group>(null);
  const glowL = useRef<THREE.MeshBasicMaterial>(null);
  const glowR = useRef<THREE.MeshBasicMaterial>(null);
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0, -0.16);
    shape.lineTo(0.34, -0.16);
    shape.lineTo(0.46, 0);
    shape.lineTo(0.34, 0.16);
    shape.lineTo(0, 0.16);
    shape.lineTo(-0.08, 0);
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2 });
    g.translate(0, 0, -0.06);
    return g;
  }, []);
  useFrame(() => {
    const travel = 0.06 * sim.lock;
    if (left.current) left.current.position.x = -(RIG.housing.outer + 0.34) + travel;
    if (right.current) right.current.position.x = RIG.housing.outer + 0.34 - travel;
    const glow = sim.lock * (0.5 + 0.5 * sim.energy);
    if (glowL.current) glowL.current.color.copy(GRAPHITE).lerp(ENERGY_A, glow);
    if (glowR.current) glowR.current.color.copy(GRAPHITE).lerp(ENERGY_A, glow);
  });
  return (
    <>
      <group ref={left} position={[-(RIG.housing.outer + 0.34), 0, 0]}>
        <mesh geometry={geometry} material={material} />
        <mesh position={[0.36, 0, 0.07]}>
          <boxGeometry args={[0.05, 0.16, 0.01]} />
          <meshBasicMaterial ref={glowL} toneMapped={false} />
        </mesh>
      </group>
      <group ref={right} position={[RIG.housing.outer + 0.34, 0, 0]} rotation={[0, 0, Math.PI]}>
        <mesh geometry={geometry} material={material} />
        <mesh position={[0.36, 0, -0.07]}>
          <boxGeometry args={[0.05, 0.16, 0.01]} />
          <meshBasicMaterial ref={glowR} toneMapped={false} />
        </mesh>
      </group>
    </>
  );
}

export function EnergySurface() {
  const quality = useContext(QualityContext);
  const material = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uEnergy: { value: 0 },
      uFlash: { value: 0 },
      uSweep: { value: 0 },
      uSweepAngle: { value: 0 },
      uPointer: { value: new THREE.Vector2() },
      uColorA: { value: ENERGY_A },
      uColorB: { value: ENERGY_B },
    }),
    [],
  );
  useFrame(() => {
    const m = material.current;
    if (!m) return;
    const { pointer } = usePortalStore.getState();
    m.uniforms.uTime.value = sim.time;
    m.uniforms.uEnergy.value = sim.energy;
    m.uniforms.uFlash.value = sim.flash;
    m.uniforms.uSweep.value = sim.sweep;
    m.uniforms.uSweepAngle.value = sim.sweepAngle;
    (m.uniforms.uPointer.value as THREE.Vector2).set(pointer.x, pointer.y);
  });
  return (
    <mesh position={[0, 0, -0.02]} renderOrder={1}>
      <circleGeometry args={[RIG.energyRadius, quality === "high" ? 96 : 48]} />
      <shaderMaterial ref={material} vertexShader={ENERGY_VERTEX} fragmentShader={ENERGY_FRAGMENT} uniforms={uniforms} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

export function Particles({ count = 520 }: { count?: number }) {
  const { gl } = useThree();
  const material = useRef<THREE.ShaderMaterial>(null);
  const attributes = useMemo(() => {
    const rnd = mulberry32(70);
    const positions = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    const speed = new Float32Array(count);
    const size = new Float32Array(count);
    const angle = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      seed[i] = rnd();
      speed[i] = 0.35 + rnd() * 0.9;
      size[i] = 1.2 + rnd() * 2.2;
      angle[i] = rnd() * Math.PI * 2;
    }
    return { positions, seed, speed, size, angle };
  }, [count]);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uEnergy: { value: 0 }, uSweep: { value: 0 }, uPixelRatio: { value: gl.getPixelRatio() }, uColor: { value: ENERGY_B } }), [gl]);
  useFrame(() => {
    const m = material.current;
    if (!m) return;
    m.uniforms.uTime.value = sim.time;
    m.uniforms.uEnergy.value = sim.energy;
    m.uniforms.uSweep.value = sim.sweep;
  });
  return (
    <points frustumCulled={false} renderOrder={2}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[attributes.positions, 3]} />
        <bufferAttribute attach="attributes-aSeed" args={[attributes.seed, 1]} />
        <bufferAttribute attach="attributes-aSpeed" args={[attributes.speed, 1]} />
        <bufferAttribute attach="attributes-aSize" args={[attributes.size, 1]} />
        <bufferAttribute attach="attributes-aAngle" args={[attributes.angle, 1]} />
      </bufferGeometry>
      <shaderMaterial ref={material} vertexShader={PARTICLE_VERTEX} fragmentShader={PARTICLE_FRAGMENT} uniforms={uniforms} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </points>
  );
}

/** The crossing asset: a dark metallic sphere with ETH geometry inside, or a flat token. */
export function Asset({ glyph }: { glyph: TokenGlyph }) {
  const group = useRef<THREE.Group>(null);
  const glow = useRef<THREE.MeshBasicMaterial>(null);
  const metal = useTitanium(0.28);
  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    const { crossing, phase } = usePortalStore.getState();
    const active = phase === "open" || phase === "bridging" || phase === "complete";
    // visible half-width at the asset's depth (z = 0.9, camera at 7.6), minus the asset itself
    const reach = Math.min(3.4, (state.viewport.width / 2) * (6.7 / 7.6) - 0.55);
    const pose = assetPose(active ? crossing : 0, sim.time, reach);
    g.visible = active && pose.visible;
    g.position.set(pose.x, pose.y, pose.z);
    g.scale.setScalar(pose.scale);
    g.rotation.set(pose.spin * 0.35, pose.spin, 0);
    sim.dolly = active ? pose.dolly : 0;
    if (glow.current) glow.current.color.copy(ENERGY_A).multiplyScalar(0.5 + 0.5 * sim.energy);
  });
  return (
    <group ref={group} visible={false}>
      {glyph === "eth" ? (
        <>
          <mesh material={metal}>
            <sphereGeometry args={[0.42, 48, 32]} />
          </mesh>
          <mesh>
            <octahedronGeometry args={[0.28, 0]} />
            <meshBasicMaterial ref={glow} toneMapped={false} wireframe />
          </mesh>
        </>
      ) : glyph === "pol" ? (
        <>
          <mesh material={metal}>
            <cylinderGeometry args={[0.42, 0.42, 0.14, 6]} />
          </mesh>
          <mesh>
            <torusGeometry args={[0.3, 0.02, 8, 6]} />
            <meshBasicMaterial ref={glow} toneMapped={false} />
          </mesh>
        </>
      ) : (
        <>
          <mesh material={metal} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.44, 0.44, 0.08, 64]} />
          </mesh>
          <mesh position={[0, 0, 0.045]}>
            <ringGeometry args={[0.3, 0.34, 64]} />
            <meshBasicMaterial ref={glow} toneMapped={false} side={THREE.DoubleSide} />
          </mesh>
        </>
      )}
    </group>
  );
}

/**
 * The whole rig: keeps the simulation values (energy, flash, lock) in step
 * with the store, tilts toward the pointer and drives the camera.
 */
export function Rig({ glyph }: { glyph: TokenGlyph }) {
  const quality = useContext(QualityContext);
  const group = useRef<THREE.Group>(null);
  const lastPhase = useRef(usePortalStore.getState().phase);
  const settle = useRef({ source: false, destination: false });

  const onSettle = (side: "source" | "destination") => {
    settle.current[side] = true;
    if (settle.current.source && settle.current.destination) {
      settle.current = { source: false, destination: false };
      usePortalStore.getState().lock();
    }
  };

  useFrame((state, dt) => {
    const step = Math.min(dt, 0.05);
    sim.time += step;
    const store = usePortalStore.getState();
    const target = targetEnergy(store);
    sim.energy += (target - sim.energy) * (1 - Math.exp(-step * 3));
    const locked = store.phase !== "idle" && store.phase !== "aligning" && store.phase !== "dormant" && store.phase !== "error";
    sim.lock += ((locked ? 1 : 0) - sim.lock) * (1 - Math.exp(-step * 22));
    if (store.phase === "complete" && lastPhase.current !== "complete") sim.flash = 1;
    lastPhase.current = store.phase;
    sim.flash = Math.max(0, sim.flash - step * 1.6);
    // "loading" while the asset is in transit: the sweep runs, then stops dead on arrival
    const inTransit = store.phase === "bridging" && store.crossing >= 0.45 && store.crossing < 0.8;
    sim.sweep += ((inTransit ? 1 : 0) - sim.sweep) * (1 - Math.exp(-step * (inTransit ? 3 : 9)));
    if (sim.sweep > 0.01) sim.sweepAngle += step * (2.2 + 2.6 * sim.sweep);
    if (group.current) {
      const tx = -store.pointer.y * 0.12;
      const ty = store.pointer.x * 0.16;
      group.current.rotation.x += (tx - group.current.rotation.x) * (1 - Math.exp(-step * 4));
      group.current.rotation.y += (ty - group.current.rotation.y) * (1 - Math.exp(-step * 4));
    }
    // camera: intro dolly, and the pass-through during a crossing
    const cam = state.camera;
    const baseZ = 7.6;
    const targetZ = store.introDone ? baseZ - sim.dolly * 5.6 : Math.max(baseZ, cam.position.z - step * 5.5);
    cam.position.z += (targetZ - cam.position.z) * (1 - Math.exp(-step * (sim.dolly > 0 ? 6 : 2.4)));
  });

  return (
    <group ref={group}>
      <Housing />
      <GlyphRing side="source" inner={RIG.sourceRing.inner} outer={RIG.sourceRing.outer} z={RIG.sourceRing.z} onSettle={() => onSettle("source")} />
      <GlyphRing side="destination" inner={RIG.destinationRing.inner} outer={RIG.destinationRing.outer} z={RIG.destinationRing.z} onSettle={() => onSettle("destination")} />
      <Bezel />
      <Leds />
      <Chevrons />
      <EnergySurface />
      {quality === "high" && <Particles />}
      <Asset glyph={glyph} />
    </group>
  );
}
