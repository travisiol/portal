"use client";

import { Canvas } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { usePortalStore } from "@/lib/store/portal";
import type { TokenGlyph } from "@/types/token";
import { Rig } from "./Rig";
import { applyStudioEnvironment, QualityContext, resetSim } from "./sim";

interface PortalSceneProps {
  quality: "high" | "low";
  glyph: TokenGlyph;
  /** Camera starts far away and dollies in while the intro plays. */
  intro: boolean;
  className?: string;
}

/**
 * The React Three Fiber canvas. Renders only while on screen; pointer position
 * feeds the parallax and the energy shader.
 */
export function PortalScene({ quality, glyph, intro, className }: PortalSceneProps) {
  const host = useRef<HTMLDivElement>(null);
  const [onScreen, setOnScreen] = useState(true);

  // Render only while the stage is on screen. Background tabs are handled by
  // the browser itself, which stops requestAnimationFrame.
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), { rootMargin: "80px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const setPointer = usePortalStore.getState().setPointer;
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * 2 - 1;
      const y = -(((e.clientY - r.top) / r.height) * 2 - 1);
      setPointer(Math.max(-1, Math.min(1, x)), Math.max(-1, Math.min(1, y)));
    };
    const onLeave = () => setPointer(0, 0);
    el.addEventListener("pointermove", onMove, { passive: true });
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <div ref={host} className={className} data-portal-interactive="">
      <Canvas
        frameloop={onScreen ? "always" : "never"}
        dpr={quality === "high" ? [1, 1.75] : 1}
        camera={{ position: [0, 0, intro ? 16 : 7.6], fov: 32, near: 0.1, far: 60 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05, preserveDrawingBuffer: process.env.NODE_ENV !== "production" }}
        onCreated={({ gl, scene }) => {
          resetSim(quality);
          gl.setClearColor(0x000000, 0);
          applyStudioEnvironment(gl, scene);
        }}
        style={{ background: "transparent" }}
      >
        <QualityContext value={quality}>
          <ambientLight intensity={0.12} color="#9fb3c0" />
          <directionalLight position={[3.5, 4.5, 6]} intensity={2.4} color="#e6edf2" />
          <directionalLight position={[-5, -2, 3]} intensity={0.55} color="#8fb4c4" />
          <pointLight position={[0, 0, -2.6]} intensity={6} distance={9} color="#70E7FF" />
          <Rig glyph={glyph} />
        </QualityContext>
      </Canvas>
    </div>
  );
}

export default PortalScene;
