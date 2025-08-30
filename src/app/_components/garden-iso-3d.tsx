"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree, invalidate, useFrame } from "@react-three/fiber";
import { OrthographicCamera, Bounds } from "@react-three/drei";
import * as THREE from "three";

// Global cloud manager to decouple clouds from React lifecycles
type CloudSlot = { g: THREE.Group; active: boolean; speed: number; scale: number };
type CloudBounds = { left: number; right: number; minY: number; maxY: number; minZ: number; maxZ: number };

const cloudManager = (() => {
  const root = new THREE.Group();
  root.matrixAutoUpdate = true;
  (root as any).raycast = () => null;
  const slots: CloudSlot[] = [];
  const maxClouds = 4;
  let bounds: CloudBounds = { left: -10, right: 10, minY: 1, maxY: 10, minZ: -0.2, maxZ: 0.25 };
  // randomized spawn interval
  const spawnMinSec = 1.2;
  const spawnMaxSec = 3.2;
  let nextSpawnAtSec = 0;
  let running = false;
  let rafId: number | null = null;
  let lastTs = 0;

  const ensureInit = () => {
    if (slots.length) return;
    for (let i = 0; i < maxClouds; i++) {
      const g = new THREE.Group();
      (g as any).raycast = () => null;
      const mat = (o: number) => new THREE.MeshStandardMaterial({ color: new THREE.Color('#ffffff'), roughness: 1, transparent: true, opacity: o });
      const add = (geo: THREE.SphereGeometry, x: number, y: number, z: number, o: number) => {
        const m = new THREE.Mesh(geo, mat(o));
        m.position.set(x, y, z);
        (m as any).raycast = () => null;
        g.add(m);
      };
      add(new THREE.SphereGeometry(0.35, 16, 16), 0, 0, 0, 0.95);
      add(new THREE.SphereGeometry(0.28, 16, 16), 0.3, 0.05, -0.05, 0.92);
      add(new THREE.SphereGeometry(0.26, 16, 16), -0.32, 0.02, 0.04, 0.92);
      add(new THREE.SphereGeometry(0.22, 16, 16), 0.05, 0.12, 0.06, 0.9);
      g.visible = false;
      root.add(g);
      slots.push({ g, active: false, speed: 0.3, scale: 1 });
    }
  };

  const activate = (slot: CloudSlot) => {
    slot.active = true;
    slot.scale = 0.7 + Math.random() * 0.5;
    slot.speed = 0.25 + Math.random() * 0.25;
    const y = bounds.minY + Math.random() * (bounds.maxY - bounds.minY);
    const z = bounds.minZ + Math.random() * (bounds.maxZ - bounds.minZ);
    slot.g.position.set(bounds.left, y, z);
    slot.g.scale.set(slot.scale, slot.scale, slot.scale);
    slot.g.visible = true;
  };

  const deactivate = (slot: CloudSlot) => {
    slot.active = false;
    slot.g.visible = false;
  };

  const tick = (ts: number) => {
    if (!running) return;
    if (!lastTs) lastTs = ts;
    const delta = Math.min(0.05, (ts - lastTs) / 1000); // clamp delta
    lastTs = ts;

    // move active
    for (const s of slots) {
      if (!s.active) continue;
      s.g.position.x += s.speed * delta;
      if (s.g.position.x > bounds.right + 0.2) deactivate(s);
    }

    // spawn with randomized interval
    const nowSec = lastTs / 1000;
    if (nowSec >= nextSpawnAtSec) {
      const open = slots.find((s) => !s.active);
      if (open) activate(open);
      const delay = spawnMinSec + Math.random() * (spawnMaxSec - spawnMinSec);
      nextSpawnAtSec = nowSec + delay;
    }

    // ensure renderer draws this frame even in demand mode
    try { invalidate(); } catch {}

    rafId = window.requestAnimationFrame(tick);
  };

  return {
    root,
    attach(scene: THREE.Scene) {
      ensureInit();
      if (!scene.children.includes(root)) scene.add(root);
      if (!running) {
        running = true;
        lastTs = 0;
        // schedule first spawn randomly
        const startSec = 0;
        const delay = spawnMinSec + Math.random() * (spawnMaxSec - spawnMinSec);
        nextSpawnAtSec = startSec + delay;
        rafId = window.requestAnimationFrame(tick);
      }
    },
    setBounds(b: CloudBounds) {
      bounds = b;
    },
    stop() {
      running = false;
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
    },
  };
})();

export type TreeType = "empty" | "sapling" | "young" | "mature" | "withered";

export type GardenIso3DProps = {
  cols?: number; // default 10
  rows?: number; // default 10
  tiles: TreeType[]; // length = rows * cols
  onTileClick?: (index: number) => void;
  className?: string;
  height?: string; // CSS height, default "min(520px, 60vh)"
  projection?: "dimetric" | "isometric"; // camera style
};

function isTree(t: TreeType | undefined): t is Exclude<TreeType, "empty"> {
  return t !== undefined && t !== "empty";
}

function useGridPositions(cols: number, rows: number, spacing = 1, gap = 0.1) {
  const tile = spacing;
  const step = tile + gap;
  const width = cols * step - gap;
  const depth = rows * step - gap;
  const originX = -width / 2 + tile / 2;
  const originZ = -depth / 2 + tile / 2;
  const positions: [number, number, number][] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      positions.push([originX + c * step, 0, originZ + r * step]);
    }
  }
  return { positions, tile, step, width, depth };
}

function TileMesh({
  i,
  position,
  hovered,
  checker,
  geoms,
}: {
  i: number;
  position: [number, number, number];
  hovered: boolean;
  checker: boolean;
  geoms: { base: THREE.BoxGeometry; top: THREE.BoxGeometry; edge: THREE.BoxGeometry };
}) {
  const ref = useRef<THREE.Mesh>(null!);
  // Stylized grass tile colors, memoized to avoid recreating per render
  const topColor = useMemo(() => new THREE.Color(checker ? "#a3e635" : "#84cc16"), [checker]);
  const topColorHover = useMemo(() => new THREE.Color("#b4f03b"), []);
  const sideColor = useMemo(() => new THREE.Color("#7c4b2d"), []);
  const outline = useMemo(() => new THREE.Color(1, 1, 1).multiplyScalar(0.3), []);
  const outlineHover = useMemo(() => new THREE.Color(1, 1, 1).multiplyScalar(0.5), []);

  // Apply scale to the top slab when hovered changes
  useEffect(() => {
    if (!ref.current) return;
    ref.current.scale.set(hovered ? 1.06 : 1, 1, hovered ? 1.06 : 1);
  }, [hovered]);

  return (
    <group position={position}>
      {/* Dirt skirt */}
      <mesh position={[0, -0.14, 0]}>
        <primitive object={geoms.base} />
        <meshStandardMaterial color={sideColor} roughness={1} metalness={0} />
      </mesh>
      {/* Grass top slab (slightly inset for bevel illusion) */}
      <mesh ref={ref} position={[0, 0.02, 0]}>
        <primitive object={geoms.top} />
        <meshStandardMaterial color={hovered ? topColorHover : topColor} emissive={hovered ? topColorHover : undefined} emissiveIntensity={hovered ? 0.25 : 0} roughness={0.8} metalness={0} />
      </mesh>
      {/* outline */}
      <lineSegments position={[0, 0.04, 0]} raycast={() => null}>
        <edgesGeometry args={[geoms.edge]} />
        <lineBasicMaterial color={hovered ? outlineHover : outline} transparent opacity={hovered ? 1 : 0.85} />
      </lineSegments>
    </group>
  );
}

const MemoTileMesh = React.memo(TileMesh);

const TRUNK_COLOR = new THREE.Color("#065f46");
const GRAY_COLOR = new THREE.Color("#6b7280");
const GREEN_A = new THREE.Color("#10b981");
const GREEN_A_EM = new THREE.Color("#064e3b");
const GREEN_B = new THREE.Color("#34d399");
const GREEN_C = new THREE.Color("#22c55e");
const GREEN_D = new THREE.Color("#16a34a");

function TreeMesh({ type, animated = true }: { type: Exclude<TreeType, "empty">; animated?: boolean }) {
  const group = useRef<THREE.Group>(null!);
  // Slight idle sway for foliage when animations enabled
  useFrame(({ clock }) => {
    if (!animated) return;
    const t = clock.getElapsedTime();
    if (group.current) {
      group.current.rotation.z = Math.sin(t * 0.4) * 0.02;
    }
  });

  switch (type) {
    case "sapling":
      return (
        <group ref={group} position={[0, 0.08, 0]} scale={[1.35, 1.35, 1.35]} raycast={() => null}>
          {/* canopy cluster */}
          <mesh position={[0, 0.25, 0]}>
            <sphereGeometry args={[0.25, 18, 18]} />
            <meshStandardMaterial color={GREEN_A} emissive={GREEN_A_EM} emissiveIntensity={0.25} />
          </mesh>
          <mesh position={[0.16, 0.22, 0]}>
            <sphereGeometry args={[0.16, 16, 16]} />
            <meshStandardMaterial color={GREEN_B} />
          </mesh>
          {/* trunk */}
          <mesh position={[0, 0.06, 0]}>
            <cylinderGeometry args={[0.05, 0.06, 0.22, 12]} />
            <meshStandardMaterial color={TRUNK_COLOR} roughness={0.9} />
          </mesh>
        </group>
      );
    case "young":
      return (
        <group position={[0, 0.08, 0]} scale={[1.35, 1.35, 1.35]} raycast={() => null}>
          <mesh position={[0, 0.42, 0]}>
            <sphereGeometry args={[0.34, 18, 18]} />
            <meshStandardMaterial color={GREEN_C} emissive={GREEN_A_EM} emissiveIntensity={0.3} />
          </mesh>
          <mesh position={[0.26, 0.3, 0]}>
            <sphereGeometry args={[0.22, 16, 16]} />
            <meshStandardMaterial color={GREEN_B} />
          </mesh>
          <mesh position={[-0.22, 0.28, 0.05]}>
            <sphereGeometry args={[0.18, 16, 16]} />
            <meshStandardMaterial color={GREEN_D} />
          </mesh>
          <mesh position={[0, 0.12, 0]}>
            <cylinderGeometry args={[0.07, 0.07, 0.34, 14]} />
            <meshStandardMaterial color={TRUNK_COLOR} roughness={0.95} />
          </mesh>
        </group>
      );
    case "mature":
      return (
        <group position={[0, 0.08, 0]} scale={[1.55, 1.55, 1.55]} raycast={() => null}>
          {/* Layered cones + extra crown */}
          <mesh position={[0, 0.5, 0]}>
            <coneGeometry args={[0.36, 0.65, 14]} />
            <meshStandardMaterial color={GREEN_C} />
          </mesh>
          <mesh position={[0, 0.25, 0]}>
            <coneGeometry args={[0.28, 0.5, 14]} />
            <meshStandardMaterial color={new THREE.Color("#4ade80")} />
          </mesh>
          <mesh position={[0, 0.04, 0]}>
            <cylinderGeometry args={[0.06, 0.06, 0.22, 12]} />
            <meshStandardMaterial color={TRUNK_COLOR} roughness={0.95} />
          </mesh>
        </group>
      );
    case "withered":
      return (
        <group position={[0, 0.08, 0]} scale={[1.35, 1.35, 1.35]} raycast={() => null}>
          <mesh position={[0, 0.22, 0]}>
            <sphereGeometry args={[0.2, 12, 12]} />
            <meshStandardMaterial color={GRAY_COLOR} />
          </mesh>
          <mesh position={[0, 0.06, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 0.2, 8]} />
            <meshStandardMaterial color={new THREE.Color("#374151")} />
          </mesh>
        </group>
      );
  }
}

function AimCamera({ target = [0, 0, 0] as [number, number, number] }) {
  const { camera } = useThree();
  useEffect(() => {
    camera.lookAt(...target);
  }, [camera, target[0], target[1], target[2]]);
  return null;
}

export function GardenIso3D({ cols = 10, rows = 10, tiles, onTileClick, className = "", height = "min(520px, 60vh)", projection = "isometric" }: GardenIso3DProps) {
  const total = rows * cols;
  const normalized = tiles.slice(0, total).concat(Array(Math.max(0, total - tiles.length)).fill("empty"));
  const { positions, width, depth } = useGridPositions(cols, rows);
  // Ensure a frame is rendered when data-driven visuals change under frameloop="demand"
  useEffect(() => {
    invalidate();
  }, [tiles, cols, rows]);
  // Reduced motion preference
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReducedMotion(!!m.matches);
    apply();
    try { m.addEventListener('change', apply); } catch { m.addListener(apply); }
    return () => { try { m.removeEventListener('change', apply); } catch { m.removeListener(apply); } };
  }, []);
  // Hover handling via global plane
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  // grid metrics (must match useGridPositions defaults: spacing=1, gap=0.1)
  const tile = 1;
  const gap = 0.1;
  const step = tile + gap;
  const originX = -width / 2 + tile / 2;
  const originZ = -depth / 2 + tile / 2;

  const indexFromXZ = (x: number, z: number) => {
    const c = Math.floor((x - originX + step / 2) / step);
    const r = Math.floor((z - originZ + step / 2) / step);
    if (c < 0 || c >= cols || r < 0 || r >= rows) return null;
    return r * cols + c;
  };
  // Shared geometries for all tiles to reduce allocations and improve perf
  const geoms = useMemo(() => ({
    base: new THREE.BoxGeometry(1, 0.28, 1),
    top: new THREE.BoxGeometry(0.94, 0.04, 0.94),
    edge: new THREE.BoxGeometry(0.94, 0.04, 0.94),
  }), []);

  const handleTile = (i: number) => onTileClick?.(i);

  const ambientColor = useMemo(() => new THREE.Color(0xffffff), []);

  // No continuous ticker; clouds and interactions will invalidate on demand

  // (Background removed per request)

  // Decorative: moving cloud spawner (max 4), crossing X over the garden
  const Clouds = () => {
    const left = -width / 2 - 2.0;
    const right = width / 2 + 2.0;
    const minY = 2.2, maxY = 4.5;
    const minZ = -0.2, maxZ = 0.25;
    const { scene } = useThree();

    useEffect(() => {
      if (!reducedMotion) cloudManager.attach(scene);
      return () => cloudManager.stop();
    }, [scene, reducedMotion]);

    useEffect(() => {
      cloudManager.setBounds({ left, right, minY, maxY, minZ, maxZ });
    }, [left, right, minY, maxY, minZ, maxZ]);

    return null;
  };


  // Decorative: perimeter fence using instanced pickets
  const Fence = () => {
    const picketCount = Math.max(8, Math.round((width + depth) * 4));
    const meshRef = useRef<THREE.InstancedMesh>(null!);
    useEffect(() => {
      if (!meshRef.current) return;
      const dummy = new THREE.Object3D();
      let idx = 0;
      const y = 0.25;
      const spacing = 0.35;
      // along X sides
      const halfW = (width + 1.2) / 2;
      const halfD = (depth + 1.2) / 2;
      const countX = Math.floor((width + 1.2) / spacing);
      const countZ = Math.floor((depth + 1.2) / spacing);
      for (let i = 0; i <= countX; i++) {
        const x = -halfW + i * spacing;
        // front (near camera)
        dummy.position.set(x, y, halfD);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        meshRef.current.setMatrixAt(idx++, dummy.matrix);
        // back
        dummy.position.set(x, y, -halfD);
        dummy.updateMatrix();
        meshRef.current.setMatrixAt(idx++, dummy.matrix);
      }
      for (let i = 0; i <= countZ; i++) {
        const z = -halfD + i * spacing;
        // right
        dummy.position.set(halfW, y, z);
        dummy.rotation.set(0, Math.PI / 2, 0);
        dummy.updateMatrix();
        meshRef.current.setMatrixAt(idx++, dummy.matrix);
        // left
        dummy.position.set(-halfW, y, z);
        dummy.updateMatrix();
        meshRef.current.setMatrixAt(idx++, dummy.matrix);
      }
      meshRef.current.instanceMatrix.needsUpdate = true;
    }, [width, depth]);
    return (
      <instancedMesh ref={meshRef} args={[undefined as any, undefined as any, picketCount]} raycast={() => null}>
        <boxGeometry args={[0.08, 0.6, 0.08]} />
        <meshStandardMaterial color={new THREE.Color('#8b5e3c')} roughness={0.95} />
      </instancedMesh>
    );
  };

  // Camera position by projection
  const k = 8;
  // Classic isometric uses equal axes (x=y=z). Dimetric tilts the Y axis more.
  const camPos: [number, number, number] =
    projection === "isometric" ? [k, k, k] : [k, k * Math.SQRT2, k];

  return (
    <div className={className} style={{ width: "100%", height }}>
      <Canvas
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, depth: true }}
        shadows={false}
        frameloop="demand"
      >
        {/* Lights (warmer) */}
        <hemisphereLight color={0xfff1e0} groundColor={0x5b6b7a} intensity={0.6} />
        <ambientLight color={new THREE.Color('#fff4e6')} intensity={0.35} />
        <directionalLight position={[3, 6, 3]} intensity={0.7} color={new THREE.Color('#ffd7a8')} />

        {/* Orthographic camera with isometric-like angle */}
        {/* Camera: 45–45 dimetric or classic isometric (equal-axes) */}
        <OrthographicCamera makeDefault position={camPos} near={0.1} far={100} zoom={75} />
        <AimCamera target={[0, 0, 0]} />
        {/* Moving clouds across X (outside Bounds) */}
        {!reducedMotion && <Clouds />}
        {/* Auto-fit the scene into view with a margin (garden only) */}
        <Bounds fit observe margin={1.05} clip>
          {/* World un-rotated; isometric comes purely from camera */}
          <group rotation={[0, 0, 0]} scale={[1, 1, 1]}>
            {/* Island base: dirt block with grass carpet (lowered so tiles are above it) */}
            <group position={[0, -0.35, 0]}>
              <mesh raycast={() => null}>
                <boxGeometry args={[width + 1.2, 0.6, depth + 1.2]} />
                <meshStandardMaterial color={new THREE.Color("#6b4226")} roughness={1} />
              </mesh>
              <mesh position={[0, 0.31, 0]} raycast={() => null}>
                <boxGeometry args={[width + 1.1, 0.06, depth + 1.1]} />
                <meshStandardMaterial color={new THREE.Color("#84cc16")} roughness={0.9} />
              </mesh>
            </group>
            {/* Decorative perimeter */}
            {!reducedMotion && <Fence />}
            {/* Tiles */}
            {positions.map((pos, i) => {
              const t = normalized[i];
              return (
                <group key={i} position={pos}>
                  <MemoTileMesh i={i} position={[0, 0, 0]} hovered={i === hoveredIndex} checker={(i + Math.floor(i / cols)) % 2 === 0} geoms={geoms} />
                  {/* Tree */}
                  {isTree(t) ? <TreeMesh type={t} animated={!reducedMotion} /> : null}
                </group>
              );
            })}
            {/* Interaction plane: captures pointer move/clicks for hover and selection */}
            <mesh
              position={[0, 0.06, 0]}
              rotation={[-Math.PI / 2, 0, 0]}
              onPointerMove={(e) => {
                const p = e.point; // world coords intersecting this plane
                const idx = indexFromXZ(p.x, p.z);
                if (idx !== hoveredIndex) {
                  setHoveredIndex(idx);
                  if (typeof document !== 'undefined') document.body.style.cursor = idx !== null ? 'pointer' : 'default';
                  invalidate();
                }
              }}
              onClick={(e) => {
                const p = e.point;
                const idx = indexFromXZ(p.x, p.z);
                if (idx !== null) handleTile(idx);
                invalidate();
              }}
              onPointerLeave={() => {
                if (hoveredIndex !== null) {
                  setHoveredIndex(null);
                  if (typeof document !== 'undefined') document.body.style.cursor = 'default';
                  invalidate();
                }
              }}
            >
              <planeGeometry args={[width + 0.2, depth + 0.2]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
          </group>
        </Bounds>
      </Canvas>
    </div>
  );
}
