"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";

/**
 * Procedural AEGIS shield mark, rebuilt in three.js from the reference art:
 * an outer + inner shield outline in a light-blue → sui → aqua gradient,
 * circuit traces with node rings on each half, and a glowing mini shield
 * at the core. Static usages render once (frameloop="demand"); animated
 * usages sway gently for the preloader.
 */

const LIGHT = new THREE.Color("#cfe8ff");
const SUI = new THREE.Color("#4da2ff");
const AQUA = new THREE.Color("#6ff7ff");

function makeShieldShape() {
  const s = new THREE.Shape();
  s.moveTo(0, 1.08); // top center peak
  s.lineTo(-0.84, 0.9);
  s.lineTo(-0.84, 0.18);
  s.quadraticCurveTo(-0.84, -0.5, 0, -1.08); // taper to bottom tip
  s.quadraticCurveTo(0.84, -0.5, 0.84, 0.18);
  s.lineTo(0.84, 0.9);
  s.closePath();
  return s;
}

function shieldOutline(shape: THREE.Shape): [number, number, number][] {
  const pts = shape.getPoints(48).map((p) => [p.x, p.y, 0] as [number, number, number]);
  const [fx, fy] = pts[0];
  const [lx, ly] = pts[pts.length - 1];
  if (fx !== lx || fy !== ly) pts.push([fx, fy, 0]);
  return pts;
}

/* light from the top-left, aqua pooling at the bottom tip — like the art */
function gradientColors(points: [number, number, number][]): [number, number, number][] {
  return points.map(([x, y]) => {
    const u = (x + 0.84) / 1.68; // 0 left → 1 right
    const v = (y + 1.08) / 2.16; // 0 bottom → 1 top
    const c = LIGHT.clone()
      .lerp(SUI, THREE.MathUtils.clamp(u * 0.9 + (1 - v) * 0.25, 0, 1))
      .lerp(AQUA, THREE.MathUtils.clamp((1 - v) * 0.65, 0, 1));
    return [c.r, c.g, c.b];
  });
}

function CircuitNode({ position, color }: { position: [number, number, number]; color: string }) {
  return (
    <mesh position={position}>
      <ringGeometry args={[0.035, 0.062, 20]} />
      <meshBasicMaterial color={color} />
    </mesh>
  );
}

function Mark({ animated }: { animated: boolean }) {
  const group = useRef<THREE.Group>(null);
  const shape = useMemo(makeShieldShape, []);
  const outline = useMemo(() => shieldOutline(shape), [shape]);
  const colors = useMemo(() => gradientColors(outline), [outline]);

  useFrame((state) => {
    if (!animated || !group.current) return;
    const t = state.clock.elapsedTime;
    group.current.rotation.y = Math.sin(t * 0.7) * 0.35;
    group.current.rotation.x = Math.sin(t * 0.45) * 0.08;
  });

  return (
    <group ref={group}>
      {/* outer shield */}
      <Line points={outline} vertexColors={colors} linewidth={2.4} />

      {/* inner shield, floated forward for parallax when it sways */}
      <group scale={0.72} position={[0, 0, 0.12]}>
        <Line points={outline} vertexColors={colors} linewidth={1.9} />
      </group>

      {/* faint center split, echoing the two-tone halves of the art */}
      <Line
        points={[
          [0, 1.02, 0.06],
          [0, -1.02, 0.06],
        ]}
        color="#8ecbff"
        transparent
        opacity={0.25}
        linewidth={1}
      />

      {/* circuit traces: node → run → elbow toward the core */}
      <Line
        points={[
          [-0.38, 0.38, 0.12],
          [-0.38, -0.08, 0.12],
          [-0.18, -0.3, 0.12],
        ]}
        color="#8ecbff"
        linewidth={1.6}
      />
      <CircuitNode position={[-0.38, 0.47, 0.12]} color="#8ecbff" />
      <Line
        points={[
          [0.38, -0.32, 0.12],
          [0.38, 0.14, 0.12],
          [0.18, 0.36, 0.12],
        ]}
        color="#4da2ff"
        linewidth={1.6}
      />
      <CircuitNode position={[0.38, -0.41, 0.12]} color="#4da2ff" />

      {/* glowing core shield */}
      <group position={[0, 0, 0.24]} scale={0.3}>
        <mesh>
          <shapeGeometry args={[shape]} />
          <meshBasicMaterial color="#59d8f0" transparent opacity={0.9} />
        </mesh>
        <Line points={outline} color="#bffbff" linewidth={1.3} />
      </group>
    </group>
  );
}

export default function AegisMark({
  className = "",
  animated = false,
}: {
  className?: string;
  animated?: boolean;
}) {
  return (
    <div
      className={`relative ${className}`}
      style={{ filter: "drop-shadow(0 0 14px rgba(77, 162, 255, 0.45))" }}
    >
      <Canvas
        frameloop={animated ? "always" : "demand"}
        camera={{ position: [0, 0, 3.1], fov: 42 }}
        dpr={[1, 2]}
        gl={{ alpha: true, antialias: true }}
      >
        <Mark animated={animated} />
      </Canvas>
    </div>
  );
}
