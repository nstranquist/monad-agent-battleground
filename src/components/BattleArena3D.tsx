"use client";

/**
 * BattleArena3D — Three.js battle visualization
 *
 * Fighter classes → geometry + color:
 *   BERSERKER  (STR≥6)  red icosahedron
 *   SPEEDSTER  (SPD≥6)  gold octahedron
 *   ORACLE     (INT≥6)  blue torus knot
 *   WARRIOR    (STR top) orange icosahedron
 *   PHANTOM    (SPD top) yellow octahedron
 *   SAGE       (default) monad-purple sphere
 *
 * Phase sequence driven by parent:
 *   idle → charging → clash → done
 */

import { useRef, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Sparkles, Stars, Grid, Float, Html } from "@react-three/drei";
import * as THREE from "three";
import type { Agent } from "@/lib/types";

export type BattlePhase = "idle" | "charging" | "clash" | "done";

// ─── Class visuals ─────────────────────────────────────────────────────────────

interface AgentVisuals {
  label: string;
  color: string;
  emissive: string;
  geo: "icosahedron" | "octahedron" | "torusknot" | "sphere";
}

function getVisuals(str: number, spd: number, intel: number): AgentVisuals {
  if (str >= 6) return { label: "BERSERKER", color: "#ff4455", emissive: "#cc0011", geo: "icosahedron" };
  if (spd >= 6) return { label: "SPEEDSTER", color: "#ffd700", emissive: "#ff8800", geo: "octahedron" };
  if (intel >= 6) return { label: "ORACLE", color: "#44aaff", emissive: "#0055ee", geo: "torusknot" };
  if (str >= spd && str >= intel) return { label: "WARRIOR", color: "#ff6633", emissive: "#cc2200", geo: "icosahedron" };
  if (spd >= intel) return { label: "PHANTOM", color: "#ffcc44", emissive: "#ff8800", geo: "octahedron" };
  return { label: "SAGE", color: "#836ef9", emissive: "#4422cc", geo: "sphere" };
}

// ─── Glow shell (fake bloom) ───────────────────────────────────────────────────

function GlowShell({ color, phase }: { color: string; phase: BattlePhase }) {
  const m1 = useRef<THREE.MeshBasicMaterial>(null!);
  const m2 = useRef<THREE.MeshBasicMaterial>(null!);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const pulse = Math.sin(t * 2.5) * 0.5 + 0.5;
    const base = phase === "clash" ? 0.12 : 0.05;
    if (m1.current) m1.current.opacity = base + pulse * 0.04;
    if (m2.current) m2.current.opacity = (base * 0.5) + pulse * 0.02;
  });

  return (
    <>
      <mesh>
        <sphereGeometry args={[1.25, 16, 16]} />
        <meshBasicMaterial ref={m1} color={color} transparent opacity={0.05} side={THREE.BackSide} depthWrite={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[1.8, 12, 12]} />
        <meshBasicMaterial ref={m2} color={color} transparent opacity={0.02} side={THREE.BackSide} depthWrite={false} />
      </mesh>
    </>
  );
}

// ─── Individual fighter ────────────────────────────────────────────────────────

function Fighter({
  agent,
  side,
  phase,
}: {
  agent: Agent | undefined;
  side: "left" | "right";
  phase: BattlePhase;
}) {
  const groupRef = useRef<THREE.Group>(null!);
  const meshRef = useRef<THREE.Mesh>(null!);
  const ringRef = useRef<THREE.Mesh>(null!);
  const lightRef = useRef<THREE.PointLight>(null!);

  const vis = useMemo(
    () =>
      agent
        ? getVisuals(agent.strength, agent.speed, agent.intelligence)
        : { label: "???", color: "#836ef9", emissive: "#4422cc", geo: "sphere" as const },
    [agent]
  );

  const sign = side === "left" ? -1 : 1;

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (!groupRef.current || !meshRef.current) return;

    // Spin
    meshRef.current.rotation.y += 0.014;

    // Target position per phase
    let tx = sign * 3.3;
    let ty = 0;

    if (phase === "charging") {
      tx = sign * 0.7;
      ty = 0.25;
    } else if (phase === "clash") {
      tx = sign * 0.1;
      ty = 0;
    } else if (phase === "done") {
      tx = sign * 2.6;
      ty = 0;
    }

    // Lerp position
    groupRef.current.position.x = THREE.MathUtils.lerp(
      groupRef.current.position.x,
      tx,
      0.085
    );
    groupRef.current.position.y = THREE.MathUtils.lerp(
      groupRef.current.position.y,
      ty + Math.sin(t * 1.6 + (side === "left" ? 0 : Math.PI)) * 0.09,
      0.06
    );

    // Floor ring opacity pulse
    if (ringRef.current) {
      const mat = ringRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = phase === "clash"
        ? 0.6 + Math.sin(t * 10) * 0.3
        : 0.1 + Math.sin(t * 2.2) * 0.07;
    }

    // Light intensity
    if (lightRef.current) {
      lightRef.current.intensity = phase === "clash"
        ? 8 + Math.sin(t * 12) * 3
        : 3 + Math.sin(t * 2) * 0.5;
    }
  });

  const sparkCount = phase === "clash" ? 70 : phase === "charging" ? 30 : 14;
  const sparkScale = phase === "clash" ? 4 : 2.2;
  const sparkSize = phase === "clash" ? 5 : 2.5;
  const sparkSpeed = phase === "clash" ? 2.5 : 0.6;
  const emissiveIntensity = phase === "clash" ? 5 : 2;

  return (
    <group ref={groupRef} position={[sign * 3.3, 0, 0]}>
      {/* Floor glow ring */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.92, 0]}>
        <ringGeometry args={[0.8, 1.15, 48]} />
        <meshBasicMaterial color={vis.color} transparent opacity={0.1} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>

      {/* Main fighter body */}
      <Float speed={1.4} floatIntensity={0.13} rotationIntensity={0}>
        <mesh ref={meshRef} castShadow>
          {vis.geo === "icosahedron" && <icosahedronGeometry args={[0.72, 1]} />}
          {vis.geo === "octahedron"  && <octahedronGeometry args={[0.72, 0]} />}
          {vis.geo === "torusknot"   && <torusKnotGeometry args={[0.42, 0.17, 80, 8]} />}
          {vis.geo === "sphere"      && <sphereGeometry args={[0.65, 32, 32]} />}
          <meshStandardMaterial
            color={vis.color}
            emissive={vis.emissive}
            emissiveIntensity={emissiveIntensity}
            metalness={0.35}
            roughness={0.1}
          />
        </mesh>
      </Float>

      {/* Fake bloom shells */}
      <GlowShell color={vis.color} phase={phase} />

      {/* Fighter point light */}
      <pointLight ref={lightRef} color={vis.color} intensity={3} distance={6} />

      {/* Particle sparkles */}
      <Sparkles
        count={sparkCount}
        scale={sparkScale}
        size={sparkSize}
        speed={sparkSpeed}
        color={vis.color}
      />

      {/* HTML name label */}
      {agent && (
        <Html center distanceFactor={7} position={[0, 1.6, 0]}>
          <div className="text-center pointer-events-none select-none">
            <div
              className="font-bold text-sm tracking-wider text-white"
              style={{ textShadow: `0 0 12px ${vis.color}, 0 0 24px ${vis.color}66` }}
            >
              {agent.name}
            </div>
            <div className="text-[10px] font-bold mt-0.5 tracking-widest" style={{ color: vis.color }}>
              {vis.label}
            </div>
            <div className="text-[9px] text-gray-400 mt-0.5 font-mono">
              ⚔{agent.strength} ⚡{agent.speed} 🧠{agent.intelligence}
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}

// ─── Central clash explosion ───────────────────────────────────────────────────

function ClashBurst({ active }: { active: boolean }) {
  const coreRef = useRef<THREE.Mesh>(null!);
  const outerRef = useRef<THREE.Mesh>(null!);
  const lightRef = useRef<THREE.PointLight>(null!);

  useFrame((state) => {
    if (!coreRef.current || !lightRef.current || !outerRef.current) return;

    if (!active) {
      coreRef.current.scale.setScalar(0.001);
      outerRef.current.scale.setScalar(0.001);
      lightRef.current.intensity = 0;
      return;
    }

    const t = state.clock.elapsedTime;
    const pulse = Math.abs(Math.sin(t * 12)) * 0.7 + 0.3;
    const outerPulse = Math.abs(Math.sin(t * 8 + 1)) * 0.5 + 0.5;

    coreRef.current.scale.setScalar(pulse * 1.6);
    outerRef.current.scale.setScalar(outerPulse * 2.8);
    (outerRef.current.material as THREE.MeshBasicMaterial).opacity = outerPulse * 0.18;
    lightRef.current.intensity = pulse * 30;
  });

  return (
    <group position={[0, 0, 0]}>
      <pointLight ref={lightRef} color="#ffffff" intensity={0} distance={14} />

      {/* Bright core */}
      <mesh ref={coreRef}>
        <sphereGeometry args={[0.38, 16, 16]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>

      {/* Outer halo */}
      <mesh ref={outerRef}>
        <sphereGeometry args={[0.8, 16, 16]} />
        <meshBasicMaterial color="#c8b4ff" transparent opacity={0.15} side={THREE.BackSide} depthWrite={false} />
      </mesh>

      {/* Burst sparkles — only when active */}
      {active && (
        <>
          <Sparkles count={120} scale={7} size={6} speed={3} color="#ffffff" />
          <Sparkles count={60} scale={4} size={4} speed={2} color="#836ef9" />
        </>
      )}
    </group>
  );
}

// ─── Camera controller ─────────────────────────────────────────────────────────

function CameraController({ phase }: { phase: BattlePhase }) {
  const { camera } = useThree();
  const shakeStrength = useRef(0);

  useFrame((state) => {
    const t = state.clock.elapsedTime;

    // Ramp shake up on clash, decay otherwise
    if (phase === "clash") {
      shakeStrength.current = Math.min(shakeStrength.current + 0.02, 0.14);
    } else {
      shakeStrength.current *= 0.88;
    }

    const sx = (Math.random() - 0.5) * 2 * shakeStrength.current;
    const sy = (Math.random() - 0.5) * 2 * shakeStrength.current;

    // Gentle breathe + shake
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, sx, 0.12);
    camera.position.y = THREE.MathUtils.lerp(
      camera.position.y,
      2 + sy + Math.sin(t * 0.35) * 0.12,
      0.05
    );
  });

  return null;
}

// ─── Arena floor ───────────────────────────────────────────────────────────────

function ArenaFloor() {
  return (
    <>
      <Grid
        args={[26, 26]}
        cellSize={1}
        cellThickness={0.4}
        cellColor="#1a0a50"
        sectionSize={4}
        sectionThickness={0.8}
        sectionColor="#836ef9"
        fadeDistance={18}
        fadeStrength={1.3}
        position={[0, -1, 0]}
      />
      {/* Dark base plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.01, 0]} receiveShadow>
        <planeGeometry args={[34, 34]} />
        <meshStandardMaterial color="#030310" metalness={0.55} roughness={0.75} />
      </mesh>
    </>
  );
}

// ─── VS label (center, only during idle/charging) ─────────────────────────────

function VSLabel({ phase }: { phase: BattlePhase }) {
  if (phase === "clash" || phase === "done") return null;
  return (
    <Html center position={[0, 0, 0]}>
      <div
        className="text-xs font-bold tracking-[0.3em] text-gray-600 pointer-events-none select-none"
        style={{ textShadow: "0 0 8px #836ef9" }}
      >
        VS
      </div>
    </Html>
  );
}

// ─── Full scene ────────────────────────────────────────────────────────────────

function Scene({
  myAgent,
  oppAgent,
  phase,
}: {
  myAgent: Agent | undefined;
  oppAgent: Agent | undefined;
  phase: BattlePhase;
}) {
  return (
    <>
      <color attach="background" args={["#04040f"]} />
      <fog attach="fog" args={["#04040f", 14, 30]} />

      <ambientLight intensity={0.06} />
      <directionalLight position={[0, 8, 4]} intensity={0.35} color="#836ef9" />

      <Stars radius={65} depth={45} count={2800} factor={3} fade speed={0.4} />

      <ArenaFloor />

      <Fighter agent={myAgent} side="left"  phase={phase} />
      <Fighter agent={oppAgent} side="right" phase={phase} />

      <ClashBurst active={phase === "clash"} />
      <VSLabel phase={phase} />
      <CameraController phase={phase} />
    </>
  );
}

// ─── Exported wrapper ──────────────────────────────────────────────────────────

export function BattleArena3D({
  myAgent,
  oppAgent,
  phase,
}: {
  myAgent: Agent | undefined;
  oppAgent: Agent | undefined;
  phase: BattlePhase;
}) {
  return (
    <Canvas
      camera={{ position: [0, 2, 8.5], fov: 52 }}
      gl={{ antialias: true, alpha: false }}
      shadows
      style={{ background: "#04040f" }}
    >
      <Scene myAgent={myAgent} oppAgent={oppAgent} phase={phase} />
    </Canvas>
  );
}
