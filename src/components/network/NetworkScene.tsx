"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { CHAINS, HOME_CHAIN } from "@/config/chains";
import { providersForPair } from "@/config/providers";
import type { ChainConfig } from "@/types/chain";
import { applyStudioEnvironment } from "@/components/portal/sim";

const ENERGY = new THREE.Color("#70E7FF");
const GRAPHITE = new THREE.Color("#262B31");

export interface NetworkNode {
  chain: ChainConfig;
  routes: number;
}

const ORBIT_RADIUS = 3.1;
const others = CHAINS.filter((c) => !c.home);

function labelTexture(text: string): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext("2d")!;
  ctx.clearRect(0, 0, c.width, c.height);
  const family = getComputedStyle(document.documentElement).getPropertyValue("--font-geist-mono").trim() || "ui-monospace";
  ctx.font = `600 44px ${family}, ui-monospace, monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(243,245,247,0.92)";
  const chars = text.split("");
  const spacing = 10;
  const widths = chars.map((ch) => ctx.measureText(ch).width + spacing);
  const total = widths.reduce((a, b) => a + b, 0) - spacing;
  let x = 256 - total / 2;
  chars.forEach((ch, i) => {
    ctx.fillText(ch, x + widths[i] / 2 - spacing / 2, 64);
    x += widths[i];
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function Label({ text, position, scale = 1 }: { text: string; position: [number, number, number]; scale?: number }) {
  const texture = useMemo(() => labelTexture(text), [text]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <sprite position={position} scale={[1.6 * scale, 0.4 * scale, 1]}>
      <spriteMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
    </sprite>
  );
}

/** A route line: a thin tube with a pulse of energy travelling along it. */
const LINK_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const LINK_FRAGMENT = /* glsl */ `
  uniform float uTime; uniform vec3 uColor; uniform float uActive; uniform float uSpeed;
  varying vec2 vUv;
  void main() {
    float base = uActive > 0.5 ? 0.18 : 0.6;
    float head = fract(vUv.x - uTime * uSpeed);
    float pulse = smoothstep(0.0, 0.12, head) * (1.0 - smoothstep(0.12, 0.18, head));
    float a = base + uActive * pulse * 0.9;
    gl_FragColor = vec4(uColor * (1.0 + uActive * pulse * 1.5), a);
  }
`;

function Link({ from, to, active, speed }: { from: THREE.Vector3; to: THREE.Vector3; active: boolean; speed: number }) {
  const material = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uColor: { value: active ? ENERGY : GRAPHITE }, uActive: { value: active ? 1 : 0 }, uSpeed: { value: speed } }), [active, speed]);
  const curve = useMemo(() => {
    const mid = from.clone().lerp(to, 0.5);
    mid.z += 0.35;
    return new THREE.QuadraticBezierCurve3(from, mid, to);
  }, [from, to]);
  useFrame((_, dt) => {
    if (material.current) material.current.uniforms.uTime.value += dt;
  });
  return (
    <mesh>
      <tubeGeometry args={[curve, 32, active ? 0.014 : 0.008, 6, false]} />
      <shaderMaterial ref={material} vertexShader={LINK_VERTEX} fragmentShader={LINK_FRAGMENT} uniforms={uniforms} transparent depthWrite={false} blending={active ? THREE.AdditiveBlending : THREE.NormalBlending} />
    </mesh>
  );
}

function Node({ chain, position, hovered, onHover, routes }: { chain: ChainConfig; position: THREE.Vector3; hovered: boolean; onHover: (c: ChainConfig | undefined) => void; routes: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const halo = useRef<THREE.MeshBasicMaterial>(null);
  useFrame((state) => {
    if (ref.current) ref.current.rotation.z = state.clock.elapsedTime * 0.2;
    if (halo.current) halo.current.opacity = (hovered ? 0.5 : 0.18) + (chain.home ? 0.15 : 0) + Math.sin(state.clock.elapsedTime * 1.4) * 0.04;
  });
  const size = chain.home ? 0.42 : 0.22;
  return (
    <group position={position}>
      <mesh
        ref={ref}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHover(chain);
        }}
        onPointerOut={() => onHover(undefined)}
      >
        {chain.home ? <torusGeometry args={[size, 0.06, 16, 64]} /> : <sphereGeometry args={[size, 32, 16]} />}
        <meshPhysicalMaterial color="#2A2F36" metalness={0.92} roughness={0.35} envMapIntensity={1.1} />
      </mesh>
      {chain.home && (
        <mesh>
          <circleGeometry args={[size - 0.08, 48]} />
          <meshBasicMaterial color={ENERGY} transparent opacity={0.55} toneMapped={false} />
        </mesh>
      )}
      <mesh>
        <sphereGeometry args={[size * 1.8, 24, 12]} />
        <meshBasicMaterial ref={halo} color={routes > 0 ? ENERGY : GRAPHITE} transparent opacity={0.18} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
      <Label text={chain.label} position={[0, -(size + 0.42), 0]} scale={chain.home ? 1.1 : 0.9} />
    </group>
  );
}

function Orbit({ onHover, hovered }: { onHover: (c: ChainConfig | undefined) => void; hovered?: ChainConfig }) {
  const group = useRef<THREE.Group>(null);
  const positions = useMemo(() => {
    const map = new Map<string, THREE.Vector3>();
    map.set(HOME_CHAIN.key, new THREE.Vector3(0, 0, 0));
    others.forEach((c, i) => {
      const a = (i / others.length) * Math.PI * 2 + Math.PI / 2;
      map.set(c.key, new THREE.Vector3(Math.cos(a) * ORBIT_RADIUS * 1.15, Math.sin(a) * ORBIT_RADIUS * 0.72, 0));
    });
    return map;
  }, []);
  useFrame((state) => {
    if (group.current) group.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.05) * 0.08;
  });
  const home = positions.get(HOME_CHAIN.key)!;
  const extra: [string, string][] = [
    ["ethereum", "base"],
    ["ethereum", "arbitrum"],
    ["base", "optimism"],
    ["arbitrum", "polygon"],
  ];
  return (
    <group ref={group}>
      {others.map((c, i) => {
        const p = positions.get(c.key)!;
        const routes = providersForPair(c.id, HOME_CHAIN.id).filter((m) => m.status === "live" || m.status === "needs-key").length;
        return <Link key={c.key} from={p} to={home} active={routes > 0} speed={0.12 + (i % 3) * 0.03} />;
      })}
      {extra.map(([a, b]) => {
        const pa = positions.get(a);
        const pb = positions.get(b);
        if (!pa || !pb) return null;
        return <Link key={`${a}-${b}`} from={pa} to={pb} active={false} speed={0.05} />;
      })}
      {CHAINS.map((c) => (
        <Node key={c.key} chain={c} position={positions.get(c.key)!} hovered={hovered?.key === c.key} onHover={onHover} routes={c.home ? others.length : providersForPair(c.id, HOME_CHAIN.id).length} />
      ))}
    </group>
  );
}

export default function NetworkScene({ onHover, hovered }: { onHover: (c: ChainConfig | undefined) => void; hovered?: ChainConfig }) {
  return (
    <Canvas
      frameloop="always"
      dpr={[1, 1.5]}
      camera={{ position: [0, -1.2, 8.5], fov: 34 }}
      gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping }}
      onCreated={({ gl, scene }) => {
        gl.setClearColor(0x000000, 0);
        applyStudioEnvironment(gl, scene, 0.6);
      }}
      style={{ background: "transparent" }}
    >
      <ambientLight intensity={0.15} />
      <directionalLight position={[3, 5, 6]} intensity={2} color="#e6edf2" />
      <pointLight position={[0, 0, 1.5]} intensity={4} distance={6} color="#70E7FF" />
      <Orbit onHover={onHover} hovered={hovered} />
    </Canvas>
  );
}
