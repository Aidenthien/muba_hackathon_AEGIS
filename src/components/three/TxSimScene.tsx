"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html, Line } from "@react-three/drei";
import * as THREE from "three";
import type { Line2 } from "three-stdlib";
import { useCanvasGate } from "@/lib/useCanvasGate";

/**
 * A looping pre-execution simulation, told literally:
 *
 *  Phase 0 — a transaction packet leaves the SENDER wallet toward the contract
 *  Phase 1 — AEGIS dry-runs the contract (scan pulses)
 *  Phase 2 — the hidden drain is revealed: the sender's own assets stream
 *            through the contract to an UNKNOWN WALLET (affected parts go red)
 *  Phase 3 — verdict: ABORT — the drain dissolves, the signature never happens
 */

const LOOP = 9; // seconds

const SENDER = new THREE.Vector3(-2.25, 0.95, 0);
const CONTRACT = new THREE.Vector3(0, 0.15, 0);
const RECEIVER = new THREE.Vector3(2.25, 0.95, 0);
const ATTACKER = new THREE.Vector3(1.5, -1.65, 0);

const ASSETS = [
  new THREE.Vector3(-2.65, 0.35, 0.25),
  new THREE.Vector3(-2.2, 0.22, -0.2),
  new THREE.Vector3(-1.8, 0.55, 0.15),
];

// drain packet schedule: [start, duration] within the loop
const DRAINS: [number, number][] = [
  [4.2, 1.5],
  [4.9, 1.5],
  [5.6, 1.5],
];

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const seg = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
const ease = (x: number) => x * x * (3 - 2 * x);

function phaseOf(t: number) {
  if (t < 2.2) return 0;
  if (t < 4.0) return 1;
  if (t < 7.0) return 2;
  return 3;
}

function NodeLabel({
  position,
  children,
  tone = "border-line text-[#dbe7f4]",
}: {
  position: THREE.Vector3;
  children: React.ReactNode;
  tone?: string;
}) {
  return (
    <Html position={position} center zIndexRange={[10, 0]}>
      <div
        className={`pointer-events-none mt-11 whitespace-nowrap rounded-md border bg-ink/85 px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.18em] backdrop-blur-sm ${tone}`}
      >
        {children}
      </div>
    </Html>
  );
}

function Simulation({ onPhase }: { onPhase?: (i: number) => void }) {
  const group = useRef<THREE.Group>(null);
  const lastPhase = useRef(-1);

  // animated refs
  const txPacket = useRef<THREE.Mesh>(null);
  const scanRing = useRef<THREE.Mesh>(null);
  const verdictRing = useRef<THREE.Mesh>(null);
  const attacker = useRef<THREE.Mesh>(null);
  const contract = useRef<THREE.Mesh>(null);
  const drainRefs = useRef<(THREE.Mesh | null)[]>([]);
  const assetRefs = useRef<(THREE.Mesh | null)[]>([]);
  const sendEdge = useRef<Line2>(null);
  const recvEdge = useRef<Line2>(null);
  const drainEdge = useRef<Line2>(null);

  const tmp = useMemo(() => new THREE.Vector3(), []);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime % LOOP;

    // notify caption of phase changes
    const ph = phaseOf(t);
    if (ph !== lastPhase.current) {
      lastPhase.current = ph;
      onPhase?.(ph);
    }

    // subtle pointer parallax only — the scene itself stays readable
    if (group.current) {
      const tx = state.pointer.x * 0.1;
      const ty = -state.pointer.y * 0.07;
      group.current.rotation.y += (tx - group.current.rotation.y) * delta * 2;
      group.current.rotation.x += (ty - group.current.rotation.x) * delta * 2;
    }

    /* Phase 0 — tx packet: sender → contract */
    if (txPacket.current) {
      const p = ease(seg(t, 0.2, 2.0));
      txPacket.current.position.lerpVectors(SENDER, CONTRACT, p);
      const mat = txPacket.current.material as THREE.MeshStandardMaterial;
      mat.opacity = seg(t, 0.2, 0.5) * (1 - seg(t, 1.85, 2.1));
      txPacket.current.rotation.x += delta * 2;
      txPacket.current.rotation.y += delta * 1.4;
    }

    // sender edge glows while the packet travels
    if (sendEdge.current) {
      sendEdge.current.material.opacity = 0.18 + (1 - seg(t, 1.9, 2.4)) * seg(t, 0.1, 0.5) * 0.5;
    }

    /* Phase 1 — scan pulses around the contract */
    if (scanRing.current) {
      const w = seg(t, 2.2, 4.0);
      const pulse = (w * 2) % 1; // two pulses
      const active = w > 0 && w < 1 ? 1 : 0;
      scanRing.current.scale.setScalar(0.45 + pulse * 1.5);
      (scanRing.current.material as THREE.MeshBasicMaterial).opacity =
        active * (1 - pulse) * 0.85;
    }
    if (contract.current) {
      const mat = contract.current.material as THREE.MeshStandardMaterial;
      const hot = seg(t, 2.2, 2.6) * (1 - seg(t, 6.8, 7.6));
      mat.emissiveIntensity = 0.7 + hot * 1.3;
      contract.current.rotation.y += delta * 0.35;
    }

    /* Phase 2 — hidden drain revealed */
    const reveal = seg(t, 4.0, 4.6) * (1 - seg(t, 7.0, 7.9));
    if (drainEdge.current) drainEdge.current.material.opacity = reveal * 0.9;

    if (attacker.current) {
      const grow = seg(t, 4.0, 5.2);
      const gone = seg(t, 7.2, 8.4);
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 6) * 0.12 * grow;
      attacker.current.scale.setScalar((0.55 + grow * 0.5) * pulse * (1 - gone * 0.6));
      (attacker.current.material as THREE.MeshStandardMaterial).opacity =
        (0.2 + grow * 0.8) * (1 - gone);
      attacker.current.rotation.y += delta * 1.2;
    }

    // the expected transfer never arrives — its edge starves during the drain
    if (recvEdge.current) {
      recvEdge.current.material.opacity = 0.22 - seg(t, 4.0, 5.0) * 0.16 + seg(t, 7.5, 8.5) * 0.16;
    }

    // drained asset packets: asset → contract → attacker
    DRAINS.forEach(([start, dur], i) => {
      const mesh = drainRefs.current[i];
      const asset = assetRefs.current[i];
      if (mesh) {
        const p = seg(t, start, start + dur);
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (p <= 0 || p >= 1) {
          mat.opacity = 0;
        } else {
          if (p < 0.5) tmp.lerpVectors(ASSETS[i], CONTRACT, ease(p * 2));
          else tmp.lerpVectors(CONTRACT, ATTACKER, ease((p - 0.5) * 2));
          mesh.position.copy(tmp);
          mat.opacity = Math.min(1, p * 8) * (1 - seg(p, 0.9, 1));
          mesh.rotation.x += delta * 3;
        }
      }
      if (asset) {
        // the owned object visibly hollows out as it is stolen, restored on verdict
        const stolen = seg(t, start, start + 0.8);
        const restored = seg(t, 7.2, 8.4);
        const mat = asset.material as THREE.MeshStandardMaterial;
        const red = stolen * (1 - restored);
        mat.color.lerpColors(new THREE.Color("#9fd4ff"), new THREE.Color("#ff5c6e"), red);
        mat.emissive.lerpColors(new THREE.Color("#4da2ff"), new THREE.Color("#ff5c6e"), red);
        mat.opacity = 1 - stolen * 0.75 * (1 - restored);
      }
    });

    /* Phase 3 — verdict: abort ring washes the board clean */
    if (verdictRing.current) {
      const p = seg(t, 7.0, 8.4);
      verdictRing.current.scale.setScalar(0.4 + ease(p) * 2.6);
      (verdictRing.current.material as THREE.MeshBasicMaterial).opacity =
        p > 0 && p < 1 ? (1 - p) * 0.9 : 0;
    }
  });

  return (
    <group ref={group}>
      {/* ── edges ── */}
      <Line
        ref={sendEdge}
        points={[SENDER, CONTRACT]}
        color="#4da2ff"
        lineWidth={1.5}
        transparent
        opacity={0.3}
      />
      <Line
        ref={recvEdge}
        points={[CONTRACT, RECEIVER]}
        color="#8ca3bd"
        lineWidth={1}
        dashed
        dashSize={0.12}
        gapSize={0.08}
        transparent
        opacity={0.22}
      />
      <Line
        ref={drainEdge}
        points={[CONTRACT, ATTACKER]}
        color="#ff5c6e"
        lineWidth={1.8}
        transparent
        opacity={0}
      />

      {/* ── sender wallet + its owned objects ── */}
      <mesh position={SENDER}>
        <sphereGeometry args={[0.26, 32, 32]} />
        <meshStandardMaterial
          color="#12518f"
          emissive="#4da2ff"
          emissiveIntensity={1.2}
          metalness={0.7}
          roughness={0.25}
        />
      </mesh>
      {ASSETS.map((p, i) => (
        <mesh
          key={i}
          position={p}
          ref={(el) => {
            assetRefs.current[i] = el;
          }}
        >
          <boxGeometry args={[0.13, 0.13, 0.13]} />
          <meshStandardMaterial
            color="#9fd4ff"
            emissive="#4da2ff"
            emissiveIntensity={1}
            transparent
            metalness={0.6}
            roughness={0.3}
          />
        </mesh>
      ))}
      <NodeLabel position={SENDER}>Sender Wallet</NodeLabel>

      {/* ── the contract under test ── */}
      <mesh ref={contract} position={CONTRACT} rotation={[0.5, 0.6, 0]}>
        <boxGeometry args={[0.52, 0.52, 0.52]} />
        <meshStandardMaterial
          color="#0d3157"
          emissive="#4da2ff"
          emissiveIntensity={0.7}
          metalness={0.85}
          roughness={0.2}
        />
      </mesh>
      <mesh position={CONTRACT} rotation={[0.5, 0.6, 0]} scale={1.3}>
        <boxGeometry args={[0.52, 0.52, 0.52]} />
        <meshBasicMaterial color="#6fb8ff" wireframe transparent opacity={0.3} />
      </mesh>
      <NodeLabel position={CONTRACT}>Smart Contract</NodeLabel>

      {/* AEGIS scan ring + verdict ring (both live at the contract) */}
      <mesh ref={scanRing} position={CONTRACT}>
        <torusGeometry args={[1, 0.015, 8, 64]} />
        <meshBasicMaterial color="#6ff7ff" transparent opacity={0} />
      </mesh>
      <mesh ref={verdictRing} position={CONTRACT}>
        <torusGeometry args={[1, 0.02, 8, 64]} />
        <meshBasicMaterial color="#6ff7ff" transparent opacity={0} />
      </mesh>

      {/* ── expected receiver (the transfer that never happens) ── */}
      <mesh position={RECEIVER}>
        <sphereGeometry args={[0.22, 32, 32]} />
        <meshStandardMaterial
          color="#1a2c40"
          emissive="#8ca3bd"
          emissiveIntensity={0.4}
          metalness={0.5}
          roughness={0.4}
        />
      </mesh>
      <NodeLabel position={RECEIVER}>Expected Receiver</NodeLabel>

      {/* ── the hidden attacker wallet ── */}
      <mesh ref={attacker} position={ATTACKER}>
        <octahedronGeometry args={[0.32, 0]} />
        <meshStandardMaterial
          color="#7a1f2a"
          emissive="#ff5c6e"
          emissiveIntensity={1.6}
          transparent
          opacity={0.2}
          metalness={0.6}
          roughness={0.3}
        />
      </mesh>
      <NodeLabel position={ATTACKER} tone="border-danger/40 text-danger">
        0x?? · Unknown Wallet
      </NodeLabel>

      {/* travelling transaction packet */}
      <mesh ref={txPacket}>
        <boxGeometry args={[0.12, 0.12, 0.12]} />
        <meshStandardMaterial
          color="#9fd4ff"
          emissive="#4da2ff"
          emissiveIntensity={2.2}
          transparent
          opacity={0}
        />
      </mesh>

      {/* drain packets */}
      {DRAINS.map((_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            drainRefs.current[i] = el;
          }}
        >
          <boxGeometry args={[0.1, 0.1, 0.1]} />
          <meshStandardMaterial
            color="#ff8b98"
            emissive="#ff5c6e"
            emissiveIntensity={2.4}
            transparent
            opacity={0}
          />
        </mesh>
      ))}
    </group>
  );
}

export default function TxSimScene({ onPhase }: { onPhase?: (i: number) => void }) {
  const gate = useCanvasGate();
  return (
    <div ref={gate.ref} className="h-full w-full">
      <Canvas
        frameloop={gate.frameloop}
        camera={{ position: [0, -0.2, 7.6], fov: 45 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
        // let the node labels render past the square canvas instead of clipping
        style={{ overflow: "visible" }}
      >
        <ambientLight intensity={0.5} />
        <pointLight position={[3, 3, 5]} intensity={30} color="#4da2ff" />
        <pointLight position={[-3, -2, 4]} intensity={18} color="#6ff7ff" />
        <Simulation onPhase={onPhase} />
      </Canvas>
    </div>
  );
}
