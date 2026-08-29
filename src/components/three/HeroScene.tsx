"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import { useCanvasGate } from "@/lib/useCanvasGate";

/**
 * The scene tells the product story literally:
 * transaction packets stream in from the right, pass through the AEGIS
 * scan gate — malicious ones flash red and are ejected — and only clean
 * transactions reach the token vault, which sits guarded inside a
 * rotating ring of chained blocks.
 */

const VAULT_X = -2.3;
const GATE_X = 1.7;
const START_X = 8;

/* ── Token vault: hexagonal coin with glowing rim ── */
function TokenVault() {
  const coin = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    if (!coin.current) return;
    coin.current.rotation.y += delta * 0.45;
    coin.current.position.y = Math.sin(state.clock.elapsedTime * 0.9) * 0.12;
  });

  return (
    <group position={[VAULT_X, 0, 0]}>
      <group ref={coin} rotation={[Math.PI / 2, 0, 0]}>
        {/* hex token body */}
        <mesh>
          <cylinderGeometry args={[1, 1, 0.18, 6]} />
          <meshStandardMaterial
            color="#0d3157"
            emissive="#2f7fd8"
            emissiveIntensity={0.7}
            metalness={0.9}
            roughness={0.15}
          />
        </mesh>
        {/* glowing hex edge */}
        <mesh scale={[1.04, 1.2, 1.04]}>
          <cylinderGeometry args={[1, 1, 0.18, 6]} />
          <meshBasicMaterial color="#4da2ff" wireframe transparent opacity={0.7} />
        </mesh>
        {/* inner medallion */}
        <mesh>
          <cylinderGeometry args={[0.5, 0.5, 0.2, 32]} />
          <meshStandardMaterial
            color="#6ff7ff"
            emissive="#6ff7ff"
            emissiveIntensity={1.6}
            metalness={0.6}
            roughness={0.2}
          />
        </mesh>
      </group>
    </group>
  );
}

/* ── Blockchain: ring of linked blocks guarding the vault ── */
function BlockRing({ count = 10, radius = 2.15 }: { count?: number; radius?: number }) {
  const spin = useRef<THREE.Group>(null);

  const { blocks, linkPositions } = useMemo(() => {
    const pts = Array.from({ length: count }, (_, i) => {
      const a = (i / count) * Math.PI * 2;
      return new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius);
    });
    const lines = new Float32Array(count * 6);
    pts.forEach((p, i) => {
      const q = pts[(i + 1) % count];
      lines.set([p.x, p.y, p.z, q.x, q.y, q.z], i * 6);
    });
    return { blocks: pts, linkPositions: lines };
  }, [count, radius]);

  useFrame((_, delta) => {
    if (!spin.current) return;
    spin.current.rotation.y += delta * 0.22;
  });

  return (
    <group position={[VAULT_X, 0, 0]} rotation={[0.5, 0, -0.15]}>
      <group ref={spin}>
        {blocks.map((p, i) => (
          <group key={i} position={p} rotation={[0.4, (i / count) * Math.PI * 2, 0]}>
            <mesh>
              <boxGeometry args={[0.3, 0.3, 0.3]} />
              <meshStandardMaterial
                color="#0d3157"
                emissive="#4da2ff"
                emissiveIntensity={1}
                metalness={0.8}
                roughness={0.25}
              />
            </mesh>
            <mesh scale={1.25}>
              <boxGeometry args={[0.3, 0.3, 0.3]} />
              <meshBasicMaterial color="#6fb8ff" wireframe transparent opacity={0.35} />
            </mesh>
          </group>
        ))}
        <lineSegments>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[linkPositions, 3]} />
          </bufferGeometry>
          <lineBasicMaterial color="#4da2ff" transparent opacity={0.45} />
        </lineSegments>
      </group>
    </group>
  );
}

/* ── AEGIS scan gate: the checkpoint every transaction crosses ── */
function ScanGate() {
  const ring = useRef<THREE.Group>(null);
  const halo = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    if (ring.current) {
      ring.current.rotation.x += delta * 0.6;
      const pulse = 1 + Math.sin(t * 2.2) * 0.03;
      ring.current.scale.setScalar(pulse);
    }
    if (halo.current) {
      const m = halo.current.material as THREE.MeshBasicMaterial;
      m.opacity = 0.05 + (Math.sin(t * 2.2) + 1) * 0.03;
    }
  });

  return (
    <group position={[GATE_X, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
      <group ref={ring}>
        <mesh>
          <torusGeometry args={[1.3, 0.02, 12, 96]} />
          <meshStandardMaterial
            color="#6ff7ff"
            emissive="#6ff7ff"
            emissiveIntensity={2.2}
            toneMapped={false}
          />
        </mesh>
        <mesh rotation={[0, 0, Math.PI / 4]}>
          <torusGeometry args={[1.42, 0.008, 8, 96]} />
          <meshBasicMaterial color="#4da2ff" transparent opacity={0.45} />
        </mesh>
      </group>
      {/* scan membrane */}
      <mesh ref={halo}>
        <circleGeometry args={[1.3, 48]} />
        <meshBasicMaterial
          color="#6ff7ff"
          transparent
          opacity={0.06}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

/* ── Transaction stream: packets scanned at the gate ── */
function TxStream({ count = 22 }: { count?: number }) {
  const meshes = useRef<(THREE.Mesh | null)[]>([]);

  const packets = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        offset: i / count,
        speed: 0.05 + Math.random() * 0.028, // loops per second
        laneY: (Math.random() - 0.5) * 2.2,
        laneZ: (Math.random() - 0.5) * 1.6,
        malicious: i % 5 === 2,
        eject: new THREE.Vector3(
          Math.random() * 0.8 - 0.1,
          1 + Math.random() * 0.8,
          (Math.random() - 0.5) * 1.2
        ).normalize(),
        spin: 0.8 + Math.random() * 1.4,
      })),
    [count]
  );

  const taperGate = (GATE_X - VAULT_X) / (START_X - VAULT_X);

  useFrame((state, delta) => {
    const time = state.clock.elapsedTime;
    packets.forEach((p, i) => {
      const mesh = meshes.current[i];
      if (!mesh) return;
      const mat = mesh.material as THREE.MeshStandardMaterial;

      const t = (time * p.speed + p.offset) % 1;
      const x = START_X + (VAULT_X - START_X) * t;
      const taper = (x - VAULT_X) / (START_X - VAULT_X);

      mesh.rotation.x += delta * p.spin;
      mesh.rotation.y += delta * p.spin * 0.6;

      if (p.malicious && x < GATE_X) {
        // flagged at the gate: flash red, eject off the path, dissolve
        const d = Math.min(1, (GATE_X - x) / 2.4);
        mesh.position.set(
          GATE_X - d * 0.5 + p.eject.x * d * 2.6,
          p.laneY * taperGate + p.eject.y * d * 2.6,
          p.laneZ * taperGate + p.eject.z * d * 2.6
        );
        mat.color.set("#ff5c6e");
        mat.emissive.set("#ff5c6e");
        mat.emissiveIntensity = 2.6 * (1 - d);
        mat.opacity = 1 - d;
        mesh.scale.setScalar(0.9 - d * 0.5);
      } else {
        mesh.position.set(x, p.laneY * taper, p.laneZ * taper);
        mat.color.set("#9fd4ff");
        mat.emissive.set("#4da2ff");
        mat.emissiveIntensity = 1.8;
        // fade in at spawn, fade out as it deposits into the vault
        mat.opacity = t < 0.06 ? t / 0.06 : t > 0.92 ? (1 - t) / 0.08 : 1;
        mesh.scale.setScalar(1);
      }
    });
  });

  return (
    <>
      {packets.map((_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            meshes.current[i] = el;
          }}
        >
          <boxGeometry args={[0.11, 0.11, 0.11]} />
          <meshStandardMaterial transparent metalness={0.7} roughness={0.3} />
        </mesh>
      ))}
    </>
  );
}

/* ── Ambient star field ── */
function ParticleField() {
  const ref = useRef<THREE.Points>(null);

  const positions = useMemo(() => {
    const count = 1800;
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 4 + Math.random() * 4.5;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      arr[i * 3 + 2] = r * Math.cos(phi);
    }
    return arr;
  }, []);

  useFrame((state, delta) => {
    if (!ref.current) return;
    ref.current.rotation.y += delta * 0.02;
    ref.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.07) * 0.1;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.026}
        color="#7cc0ff"
        transparent
        opacity={0.7}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/* ── Mouse-driven parallax on the whole rig ── */
function Rig({ children }: { children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    if (!ref.current) return;
    const targetX = state.pointer.x * 0.22;
    const targetY = state.pointer.y * 0.14;
    ref.current.rotation.y += (targetX - ref.current.rotation.y) * delta * 2.2;
    ref.current.rotation.x += (-targetY - ref.current.rotation.x) * delta * 2.2;
  });

  return <group ref={ref}>{children}</group>;
}

export default function HeroScene() {
  const gate = useCanvasGate();
  return (
    <div ref={gate.ref} className="h-full w-full">
    <Canvas
      frameloop={gate.frameloop}
      camera={{ position: [0, 0.4, 7.6], fov: 45 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
    >
      <ambientLight intensity={0.35} />
      <pointLight position={[VAULT_X, 3, 4]} intensity={55} color="#4da2ff" />
      <pointLight position={[GATE_X, -2, 3]} intensity={30} color="#6ff7ff" />
      <pointLight position={[5, 2, -3]} intensity={18} color="#2f7fd8" />

      <Rig>
        <Float speed={1.3} rotationIntensity={0.15} floatIntensity={0.5}>
          <TokenVault />
          <BlockRing />
        </Float>
        <ScanGate />
        <TxStream />
        <ParticleField />
      </Rig>

      <EffectComposer>
        <Bloom
          intensity={1.2}
          luminanceThreshold={0.18}
          luminanceSmoothing={0.9}
          mipmapBlur
        />
        <Vignette eskil={false} offset={0.25} darkness={0.75} />
      </EffectComposer>
    </Canvas>
    </div>
  );
}
