"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree, invalidate, useFrame } from "@react-three/fiber";
import { OrthographicCamera, Bounds } from "@react-three/drei";
import * as THREE from "three";
import { houseIndices } from "@/lib/garden";

// Lightweight procedural texture generator (noise-based) for PBR-like detail
function createNoiseTexture({
  size = 128,
  scale = 8,
  contrast = 1,
  seed = 1,
}: { size?: number; scale?: number; contrast?: number; seed?: number } = {}) {
  const rand = (function () {
    // xorshift32 for deterministic noise
    let x = seed || 1;
    return () => {
      x ^= x << 13;
      x ^= x >>> 17;
      x ^= x << 5;
      return ((x < 0 ? ~x + 1 : x) % 100000) / 100000;
    };
  })();
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const img = ctx.createImageData(size, size);
  const data = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Simple value noise via multi-octave random hash (cheap)
      const nx = x / size;
      const ny = y / size;
      const f = (fx: number, fy: number) => {
        const i = Math.floor(fx * scale);
        const j = Math.floor(fy * scale);
        const h = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
        return (h - Math.floor(h));
      };
      let n = 0;
      let amp = 1;
      let freq = 1;
      for (let o = 0; o < 4; o++) {
        n += f(nx * freq + rand() * 0.01, ny * freq + rand() * 0.01) * amp;
        amp *= 0.5;
        freq *= 2;
      }
      n = Math.pow(n / 1.875, contrast);
      const v = Math.max(0, Math.min(255, Math.floor(n * 255)));
      const idx = (y * size + x) * 4;
      data[idx] = v;
      data[idx + 1] = v;
      data[idx + 2] = v;
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearMipMapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  return tex;
}

// Simple radial-gradient sun texture (top-level)
function createSunTexture({ size = 128, inner = '#fff7d6', outer = 'rgba(255, 183, 77, 0)' }: { size?: number; inner?: string; outer?: string } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.05, size / 2, size / 2, size * 0.5);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  (tex as any).colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearMipMapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

// Global cloud manager to decouple clouds from React lifecycles
type CloudSlot = { g: THREE.Group; active: boolean; speed: number; scale: number };
type CloudBounds = { left: number; right: number; minY: number; maxY: number; minZ: number; maxZ: number };

const cloudManager = (() => {
  const root = new THREE.Group();
  root.matrixAutoUpdate = true;
  (root as any).raycast = () => null;
  const slots: CloudSlot[] = [];
  const maxClouds = 4;
  let bounds: CloudBounds = { left: -10, right: 10, minY: 2.2, maxY: 4.5, minZ: 0, maxZ: 0.5 };
  // randomized spawn interval
  const spawnMinSec = 1.2;
  const spawnMaxSec = 3.2;
  let nextSpawnAtSec = 0;
  let running = false;

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
      add(new THREE.SphereGeometry(0.35, 16, 16), 0, 0, 0, 0.98);
      add(new THREE.SphereGeometry(0.28, 16, 16), 0.3, 0.05, -0.05, 0.96);
      add(new THREE.SphereGeometry(0.26, 16, 16), -0.32, 0.02, 0.04, 0.96);
      add(new THREE.SphereGeometry(0.22, 16, 16), 0.05, 0.12, 0.06, 0.94);
      g.visible = false;
      root.add(g);
      slots.push({ g, active: false, speed: 0.3, scale: 1 });
    }
  };

  const activate = (slot: CloudSlot) => {
    slot.active = true;
    slot.scale = 0.7 + Math.random() * 0.5;
    // Increase speed so motion is clearly visible
    slot.speed = 0.8 + Math.random() * 0.6; // units per second
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

  const frame = (dtSec: number) => {
    if (!running) return;
    const clamped = Math.min(0.05, Math.max(0, dtSec));
    // move active
    for (const s of slots) {
      if (!s.active) continue;
      s.g.position.x += s.speed * clamped;
      if (s.g.position.x > bounds.right + 0.2) deactivate(s);
    }
    // spawn with randomized interval (advance timer by dt)
    nextSpawnAtSec -= clamped;
    if (nextSpawnAtSec <= 0) {
      const open = slots.find((s) => !s.active);
      if (open) activate(open);
      const delay = spawnMinSec + Math.random() * (spawnMaxSec - spawnMinSec);
      nextSpawnAtSec = delay;
    }
  };

  return {
    root,
    attach(scene: THREE.Scene) {
      ensureInit();
      if (!scene.children.includes(root)) scene.add(root);
      if (!running) {
        running = true;
        // spawn one immediately for instant feedback
        const open = slots.find((s) => !s.active);
        if (open) activate(open);
        // schedule next spawn (seconds from now)
        const delay = spawnMinSec + Math.random() * (spawnMaxSec - spawnMinSec);
        nextSpawnAtSec = delay;
      }
    },
    setBounds(b: CloudBounds) {
      bounds = b;
    },
    stop() {
      running = false;
    },
    frame,
  };
})();

export type TreeType = "empty" | "pine" | "bamboo" | "maple" | "bonsai" | "sakura";

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
  maps,
  isDark,
}: {
  i: number;
  position: [number, number, number];
  hovered: boolean;
  checker: boolean;
  geoms: { base: THREE.BoxGeometry; top: THREE.BoxGeometry; edge: THREE.BoxGeometry };
  maps: { grass: THREE.Texture; grassRough?: THREE.Texture; dirt: THREE.Texture; dirtRough?: THREE.Texture };
  isDark: boolean;
}) {
  const ref = useRef<THREE.Mesh>(null!);
  // Stylized grass tile colors (lightened more), memoized to avoid recreating per render
  // Alternating tiles use slightly different light greens for realism
  const topColor = useMemo(() => new THREE.Color(checker ? "#baf7a1" : "#aef397"), [checker]);
  // Darker hover tint for stronger contrast
  const topColorHover = useMemo(() => new THREE.Color("#5fbf5a"), []);
  const sideColor = useMemo(() => new THREE.Color("#7c4b2d"), []);
  // Theme-aware outlines: darker lines for light theme, lighter for dark theme
  const outline = useMemo(() => (isDark ? new THREE.Color(1, 1, 1).multiplyScalar(0.3) : new THREE.Color('#1f2937')), [isDark]);
  const outlineHover = useMemo(() => (isDark ? new THREE.Color(1, 1, 1).multiplyScalar(0.5) : new THREE.Color('#111827')), [isDark]);

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
        <meshStandardMaterial color={sideColor} roughness={1} metalness={0} map={maps.dirt} roughnessMap={maps.dirtRough} />
      </mesh>
      {/* Grass top slab (slightly inset for bevel illusion) */}
      <mesh ref={ref} position={[0, 0.02, 0]}>
        <primitive object={geoms.top} />
        <meshStandardMaterial
          color={hovered ? topColorHover : topColor}
          emissive={undefined}
          emissiveIntensity={0}
          roughness={0.8}
          metalness={0}
          map={maps.grass}
          roughnessMap={maps.grassRough}
        />
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

function TreeMesh({ type, animated = true, maps }: { type: Exclude<TreeType, "empty">; animated?: boolean; maps: { bark: THREE.Texture; leaves: THREE.Texture } }) {
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
    case "pine":
      return (
        <group ref={group} position={[0, 0.08, 0]} scale={[1.45, 1.45, 1.45]} raycast={() => null}>
          {/* layered conical pine */}
          <mesh position={[0, 0.5, 0]}>
            <coneGeometry args={[0.32, 0.6, 10]} />
            <meshStandardMaterial color={GREEN_C} map={maps.leaves} />
          </mesh>
          <mesh position={[0, 0.28, 0]}>
            <coneGeometry args={[0.26, 0.45, 10]} />
            <meshStandardMaterial color={GREEN_B} map={maps.leaves} />
          </mesh>
          <mesh position={[0, 0.08, 0]}>
            <cylinderGeometry args={[0.06, 0.06, 0.24, 12]} />
            <meshStandardMaterial color={TRUNK_COLOR} roughness={0.95} map={maps.bark} />
          </mesh>
        </group>
      );
    case "bamboo":
      return (
        <group ref={group} position={[0, 0.08, 0]} scale={[1.2, 1.2, 1.2]} raycast={() => null}>
          {/* bamboo culms */}
          {[-0.08, 0, 0.08].map((x, i) => (
            <group key={i} position={[x, 0.1 + (i % 2) * 0.02, 0]}>
              {[0, 1, 2, 3].map((seg) => (
                <mesh key={seg} position={[0, 0.12 + seg * 0.18, 0]}>
                  <cylinderGeometry args={[0.035, 0.035, 0.16, 10]} />
                  <meshStandardMaterial color={new THREE.Color("#84cc16")} roughness={0.7} map={maps.leaves} />
                </mesh>
              ))}
              {/* nodes */}
              {[0, 1, 2, 3].map((seg) => (
                <mesh key={`n-${seg}`} position={[0, 0.2 + seg * 0.18, 0]}>
                  <torusGeometry args={[0.036, 0.008, 6, 14]} />
                  <meshStandardMaterial color={new THREE.Color("#65a30d")} roughness={0.9} />
                </mesh>
              ))}
            </group>
          ))}
          {/* leaves fan */}
          {[-0.12, 0.12].map((x, i) => (
            <mesh key={`leaf-${i}`} position={[x, 0.92, 0]} rotation={[Math.PI / 2.4, 0, 0]}>
              <coneGeometry args={[0.22, 0.36, 12]} />
              <meshStandardMaterial color={GREEN_A} map={maps.leaves} />
            </mesh>
          ))}
        </group>
      );
    case "maple":
      return (
        <group ref={group} position={[0, 0.08, 0]} scale={[1.4, 1.4, 1.4]} raycast={() => null}>
          {/* broad canopy */}
          <mesh position={[0, 0.42, 0]}>
            <sphereGeometry args={[0.34, 20, 20]} />
            <meshStandardMaterial color={new THREE.Color("#ef4444")} map={maps.leaves} />
          </mesh>
          <mesh position={[0.22, 0.34, 0.04]}>
            <sphereGeometry args={[0.22, 16, 16]} />
            <meshStandardMaterial color={new THREE.Color("#f97316")} map={maps.leaves} />
          </mesh>
          <mesh position={[-0.2, 0.3, -0.06]}>
            <sphereGeometry args={[0.2, 16, 16]} />
            <meshStandardMaterial color={new THREE.Color("#fb7185")} map={maps.leaves} />
          </mesh>
          <mesh position={[0, 0.12, 0]}>
            <cylinderGeometry args={[0.07, 0.07, 0.34, 14]} />
            <meshStandardMaterial color={new THREE.Color("#6b3f2b")} roughness={0.95} map={maps.bark} />
          </mesh>
        </group>
      );
    case "bonsai":
      return (
        <group ref={group} position={[0, 0.06, 0]} scale={[1.1, 1.1, 1.1]} raycast={() => null}>
          {/* pot */}
          <mesh position={[0, 0.02, 0]}>
            <cylinderGeometry args={[0.18, 0.2, 0.06, 16]} />
            <meshStandardMaterial color={new THREE.Color("#92400e")} roughness={0.9} />
          </mesh>
          {/* trunk with bend */}
          <mesh position={[0, 0.18, 0]} rotation={[0, 0, -0.3]}>
            <cylinderGeometry args={[0.04, 0.06, 0.28, 10]} />
            <meshStandardMaterial color={new THREE.Color("#5b3a2e")} map={maps.bark} />
          </mesh>
          {/* canopy pads */}
          <mesh position={[0.12, 0.34, 0]}>
            <sphereGeometry args={[0.16, 16, 16]} />
            <meshStandardMaterial color={GREEN_D} map={maps.leaves} />
          </mesh>
          <mesh position={[-0.08, 0.28, 0.06]}>
            <sphereGeometry args={[0.12, 14, 14]} />
            <meshStandardMaterial color={GREEN_C} map={maps.leaves} />
          </mesh>
        </group>
      );
    case "sakura":
      return (
        <group ref={group} position={[0, 0.08, 0]} scale={[1.45, 1.45, 1.45]} raycast={() => null}>
          {/* pink blossoms */}
          <mesh position={[0, 0.4, 0]}>
            <sphereGeometry args={[0.32, 18, 18]} />
            <meshStandardMaterial color={new THREE.Color("#f9a8d4")} emissive={new THREE.Color("#f472b6")} emissiveIntensity={0.12} map={maps.leaves} />
          </mesh>
          <mesh position={[0.22, 0.32, 0.06]}>
            <sphereGeometry args={[0.2, 16, 16]} />
            <meshStandardMaterial color={new THREE.Color("#fbcfe8")} map={maps.leaves} />
          </mesh>
          <mesh position={[-0.22, 0.3, -0.04]}>
            <sphereGeometry args={[0.18, 16, 16]} />
            <meshStandardMaterial color={new THREE.Color("#f472b6")} map={maps.leaves} />
          </mesh>
          <mesh position={[0, 0.12, 0]}>
            <cylinderGeometry args={[0.06, 0.06, 0.32, 12]} />
            <meshStandardMaterial color={new THREE.Color("#5b3a2e")} roughness={0.95} map={maps.bark} />
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
  // Compute center house tile indices in component scope
  const houseSet = useMemo(() => new Set<number>(houseIndices(cols, rows)), [cols, rows]);
  // Ensure a frame is rendered when data-driven visuals change under frameloop="demand"
  useEffect(() => {
    invalidate();
  }, [tiles, cols, rows]);
  // Reduced motion preference
  const [reducedMotion, setReducedMotion] = useState(false);
  // Page visibility to pause animations when hidden
  const [pageVisible, setPageVisible] = useState(true);
  // Theme detection (prefers-color-scheme and html.dark class)
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReducedMotion(!!m.matches);
    apply();
    try { m.addEventListener('change', apply); } catch { m.addListener(apply); }
    return () => { try { m.removeEventListener('change', apply); } catch { m.removeListener(apply); } };
  }, []);
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const compute = () => {
      const el = document.documentElement;
      const attr = el.getAttribute('data-theme');
      const byAttr = attr === 'dark' ? true : attr === 'light' ? false : null;
      const byClass = el.classList.contains('dark');
      setIsDark(byAttr ?? byClass ?? media.matches);
    };
    compute();
    try { media.addEventListener('change', compute); } catch { media.addListener(compute); }
    const mo = new MutationObserver(compute);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] });
    return () => { try { media.removeEventListener('change', compute); } catch { media.removeListener(compute); } mo.disconnect(); };
  }, []);
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onVis = () => setPageVisible(!document.hidden);
    onVis();
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);
  // Hover handling via global plane
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const moveRAF = useRef<number | null>(null);
  const lastMoveXZ = useRef<{ x: number; z: number } | null>(null);
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
  // Decorative scatter: rocks and tall grass clumps
  const ScatterDecor = ({ seed = 42 }: { seed?: number }) => {
    // Deterministic RNG (xorshift32)
    let s = seed | 0;
    const r = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 0xffffffff; };
    // House world-space AABB
    const cx0 = Math.floor(cols / 2) - 1;
    const cy0 = Math.floor(rows / 2) - 1;
    const houseMinX = originX + (cx0) * step - 0.5;
    const houseMaxX = originX + (cx0 + 2) * step - step + 0.5;
    const houseMinZ = originZ + (cy0) * step - 0.5;
    const houseMaxZ = originZ + (cy0 + 2) * step - step + 0.5;
    const inHouse = (x: number, z: number) => x >= houseMinX && x <= houseMaxX && z >= houseMinZ && z <= houseMaxZ;

    // Bounds inside the island grass top
    const minX = -width / 2 + 0.6;
    const maxX =  width / 2 - 0.6;
    const minZ = -depth / 2 + 0.6;
    const maxZ =  depth / 2 - 0.6;

    const area = width * depth;
    const rockCount = Math.max(6, Math.round(area * 0.6));
    const grassCount = Math.max(24, Math.round(area * 2.0));

    const rockMatrices: THREE.Matrix4[] = [];
    const rockColors: THREE.Color[] = [];
    for (let i = 0; i < rockCount; i++) {
      let tries = 0;
      while (tries++ < 10) {
        const x = minX + r() * (maxX - minX);
        const z = minZ + r() * (maxZ - minZ);
        if (inHouse(x, z)) continue;
        const y = 0.05;
        const scale = 0.12 + r() * 0.18;
        const m = new THREE.Matrix4();
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, r() * Math.PI * 2, 0));
        m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(scale * (0.9 + r() * 0.4), scale * (0.6 + r() * 0.7), scale * (0.9 + r() * 0.4)));
        rockMatrices.push(m);
        const c = new THREE.Color().setHSL(0, 0, 0.5 + r() * 0.15);
        rockColors.push(c);
        break;
      }
    }

    const grassMatrices: THREE.Matrix4[] = [];
    const grassColors: THREE.Color[] = [];
    for (let i = 0; i < grassCount; i++) {
      let tries = 0;
      while (tries++ < 10) {
        const x = minX + r() * (maxX - minX);
        const z = minZ + r() * (maxZ - minZ);
        if (inHouse(x, z)) continue;
        const y = 0.06;
        const height = 0.22 + r() * 0.22;
        const widthXZ = 0.04 + r() * 0.05;
        const m = new THREE.Matrix4();
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, r() * Math.PI * 2, 0));
        m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(widthXZ, height, widthXZ));
        grassMatrices.push(m);
        const c = new THREE.Color().setHSL(0.33, 0.65, 0.45 + r() * 0.2);
        grassColors.push(c);
        break;
      }
    }

    const rockRef = useRef<THREE.InstancedMesh>(null!);
    const grassRef = useRef<THREE.InstancedMesh>(null!);
    useEffect(() => {
      if (rockRef.current) {
        const dummy = new THREE.Object3D();
        rockMatrices.forEach((mat, i) => {
          dummy.position.setFromMatrixPosition(mat);
          dummy.quaternion.setFromRotationMatrix(mat);
          const s = new THREE.Vector3(); mat.decompose(new THREE.Vector3(), new THREE.Quaternion(), s);
          dummy.scale.copy(s);
          dummy.updateMatrix();
          rockRef.current!.setMatrixAt(i, dummy.matrix);
          rockRef.current!.setColorAt(i, rockColors[i]);
        });
        rockRef.current.instanceMatrix.needsUpdate = true;
        (rockRef.current as any).instanceColor.needsUpdate = true;
      }
      if (grassRef.current) {
        const dummy = new THREE.Object3D();
        grassMatrices.forEach((mat, i) => {
          dummy.position.setFromMatrixPosition(mat);
          dummy.quaternion.setFromRotationMatrix(mat);
          const s = new THREE.Vector3(); mat.decompose(new THREE.Vector3(), new THREE.Quaternion(), s);
          dummy.scale.copy(s);
          dummy.updateMatrix();
          grassRef.current!.setMatrixAt(i, dummy.matrix);
          grassRef.current!.setColorAt(i, grassColors[i]);
        });
        grassRef.current.instanceMatrix.needsUpdate = true;
        (grassRef.current as any).instanceColor.needsUpdate = true;
      }
    }, [width, depth, cols, rows, originX, originZ, step]);

    return (
      <group>
        <instancedMesh ref={rockRef} args={[undefined as any, undefined as any, rockMatrices.length]} raycast={() => null}>
          <icosahedronGeometry args={[1, 0]} />
          <meshStandardMaterial roughness={1} metalness={0} color={new THREE.Color('#9ca3af')} />
        </instancedMesh>
        <instancedMesh ref={grassRef} args={[undefined as any, undefined as any, grassMatrices.length]} raycast={() => null}>
          <coneGeometry args={[1, 1.8, 6]} />
          <meshStandardMaterial roughness={0.8} metalness={0} color={new THREE.Color('#22c55e')} />
        </instancedMesh>
      </group>
    );
  };
  // Shared geometries for all tiles to reduce allocations and improve perf
  const geoms = useMemo(() => ({
    base: new THREE.BoxGeometry(1, 0.28, 1),
    top: new THREE.BoxGeometry(0.94, 0.04, 0.94),
    edge: new THREE.BoxGeometry(0.94, 0.04, 0.94),
  }), []);

  // Shared lightweight textures (cached) for materials
  const textureMaps = useMemo(() => {
    // Soften grass noise so it doesn't look patchy/muddy
    const grass = createNoiseTexture({ size: 128, scale: 6, contrast: 0.6, seed: 11 });
    const grassRough = createNoiseTexture({ size: 128, scale: 6, contrast: 0.4, seed: 12 });
    // Color maps should be in sRGB for correct brightness perception
    // Roughness/metalness maps stay in linear space (default)
    (grass as any).colorSpace = THREE.SRGBColorSpace;
    grass.repeat.set(2, 2);
    grassRough.repeat.set(2, 2);
    const dirt = createNoiseTexture({ size: 128, scale: 7, contrast: 1.1, seed: 21 });
    const dirtRough = createNoiseTexture({ size: 128, scale: 5, contrast: 1.0, seed: 22 });
    (dirt as any).colorSpace = THREE.SRGBColorSpace;
    dirt.repeat.set(2, 2);
    dirtRough.repeat.set(2, 2);
    const bark = createNoiseTexture({ size: 128, scale: 12, contrast: 1.25, seed: 31 });
    (bark as any).colorSpace = THREE.SRGBColorSpace;
    bark.repeat.set(1.5, 1.5);
    const leaves = createNoiseTexture({ size: 128, scale: 14, contrast: 1.1, seed: 41 });
    (leaves as any).colorSpace = THREE.SRGBColorSpace;
    leaves.repeat.set(2, 2);
    return { grass, grassRough, dirt, dirtRough, bark, leaves };
  }, []);

  // If a real texture exists in /public/textures, load it and replace the procedural grass maps in place
  useEffect(() => {
    let cancelled = false;
    const loader = new THREE.TextureLoader();
    const applyGrass = (tex: THREE.Texture) => {
      if (cancelled) return;
      (tex as any).colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.minFilter = THREE.LinearMipMapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.generateMipmaps = true;
      tex.repeat.set(2, 2);
      // update in place so materials see the change
      textureMaps.grass.image = tex.image as any;
      textureMaps.grass.needsUpdate = true;
      invalidate();
    };
    const applyGrassRough = (tex: THREE.Texture) => {
      if (cancelled) return;
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.minFilter = THREE.LinearMipMapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.generateMipmaps = true;
      tex.repeat.set(2, 2);
      textureMaps.grassRough!.image = tex.image as any;
      textureMaps.grassRough!.needsUpdate = true;
      invalidate();
    };
    // Try load; failures silently keep procedural
    try {
      loader.load(
        '/textures/grass.jpg',
        (t) => applyGrass(t),
        undefined,
        () => {}
      );
      loader.load(
        '/textures/grass_rough.jpg',
        (t) => applyGrassRough(t),
        undefined,
        () => {}
      );
    } catch {}
    return () => { cancelled = true; };
  }, [textureMaps.grass, textureMaps.grassRough]);

  const handleTile = (i: number) => onTileClick?.(i);

  const ambientColor = useMemo(() => new THREE.Color(0xffffff), []);

  // No continuous ticker; clouds and interactions will invalidate on demand

  // (Background removed per request)

  // Decorative: moving cloud spawner (max 4), crossing X over the garden
  const Clouds = () => {
    const left = -width / 2 - 2.0;
    const right = width / 2 + 2.0;
    const minY = 2.2, maxY = 4.5;
    const minZ = 0, maxZ = 0.6;
    const { scene } = useThree();

    useEffect(() => {
      // Attach whenever the page is visible; do not block on reducedMotion to avoid clouds appearing static
      if (pageVisible) cloudManager.attach(scene);
      else cloudManager.stop();
      return () => cloudManager.stop();
    }, [scene, pageVisible]);

    useEffect(() => {
      cloudManager.setBounds({ left, right, minY, maxY, minZ, maxZ });
    }, [left, right, minY, maxY, minZ, maxZ]);

    // Drive clouds from the R3F render loop
    useFrame((_, delta) => {
      if (!pageVisible) return;
      cloudManager.frame(delta);
      // If frameloop is 'demand', ensure a render happens
      if (!reducedMotion) invalidate();
    });

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

  // Sun sprite aligned with directional light direction
  const Sun = () => {
    const sunTex = useMemo(() => createSunTexture({ size: 128 }), []);
    // Match the directional light direction ([3,6,3]) at a distance
    const dir = new THREE.Vector3(3, 6, 3).normalize().multiplyScalar(20);
    return (
      <sprite position={[dir.x, dir.y, dir.z]} scale={[3.5, 3.5, 1]} raycast={() => null}>
        <spriteMaterial
          map={sunTex}
          color={new THREE.Color('#ffd7a8')}
          transparent
          depthWrite={false}
          depthTest
          blending={THREE.AdditiveBlending}
        />
      </sprite>
    );
  };

  // Simple house spanning the 2x2 center area
  const House = () => {
    // Compute analytically from grid metrics
    const cx0 = Math.floor(cols / 2) - 1; // left column of the 2x2 block
    const cy0 = Math.floor(rows / 2) - 1; // top row of the 2x2 block
    const cx = originX + (cx0 + 0.5) * step;
    const cz = originZ + (cy0 + 0.5) * step;
    // Size to roughly cover 2x2 tiles
    const baseW = (1 + 0.1) * 2 - 0.2; // step*2 - margin
    const baseD = (1 + 0.1) * 2 - 0.2;
    return (
      <group position={[cx, 0.05, cz]}>
        {/* Stone foundation slab (slightly inset) */}
        <mesh position={[0, 0.12, 0]} raycast={() => null}>
          <boxGeometry args={[baseW * 0.95, 0.24, baseD * 0.95]} />
          <meshStandardMaterial color={new THREE.Color('#a3a3a3')} roughness={1} />
        </mesh>

        {/* White walls with wooden frames (shoji-inspired) */}
        <group position={[0, 0.44, 0]}>
          {/* Wall core */}
          <mesh raycast={() => null}>
            <boxGeometry args={[baseW * 0.8, 0.5, baseD * 0.8]} />
            <meshStandardMaterial color={new THREE.Color('#f9fafb')} roughness={0.95} />
          </mesh>
          {/* Wooden corner posts */}
          {[
            [-1, -1], [1, -1], [-1, 1], [1, 1],
          ].map(([sx, sz], i) => (
            <mesh key={i} position={[sx * baseW * 0.38, 0, sz * baseD * 0.38]} raycast={() => null}>
              <boxGeometry args={[0.06, 0.55, 0.06]} />
              <meshStandardMaterial color={new THREE.Color('#8b5e3c')} roughness={0.9} />
            </mesh>
          ))}
          {/* Wooden horizontal beams */}
          {[-0.18, 0, 0.18].map((y, i) => (
            <mesh key={`hb-${i}`} position={[0, y, 0]} raycast={() => null}>
              <boxGeometry args={[baseW * 0.78, 0.03, baseD * 0.03]} />
              <meshStandardMaterial color={new THREE.Color('#8b5e3c')} roughness={0.9} />
            </mesh>
          ))}
          {/* Wooden vertical slats front/back */}
          {Array.from({ length: 6 }).map((_, i) => {
            const t = (i - 2.5) / 2.5; // -1..1
            const x = t * baseW * 0.36;
            return (
              <group key={`slat-${i}`}>
                <mesh position={[x, 0, baseD * 0.38]} raycast={() => null}>
                  <boxGeometry args={[0.02, 0.46, 0.02]} />
                  <meshStandardMaterial color={new THREE.Color('#8b5e3c')} roughness={0.9} />
                </mesh>
                <mesh position={[x, 0, -baseD * 0.38]} raycast={() => null}>
                  <boxGeometry args={[0.02, 0.46, 0.02]} />
                  <meshStandardMaterial color={new THREE.Color('#8b5e3c')} roughness={0.9} />
                </mesh>
              </group>
            );
          })}
        </group>

        {/* Tiered dark roof with extended eaves */}
        <group>
          {/* Lower eave plate */}
          <mesh position={[0, 0.76, 0]} raycast={() => null}>
            <boxGeometry args={[baseW * 1.05, 0.04, baseD * 1.05]} />
            <meshStandardMaterial color={new THREE.Color('#374151')} emissive={new THREE.Color('#4b5563')} emissiveIntensity={0.08} roughness={0.8} />
          </mesh>
          {/* Lower roof (flat cone like) */}
          <mesh position={[0, 0.92, 0]} rotation={[0, Math.PI / 4, 0]} raycast={() => null}>
            <coneGeometry args={[Math.min(baseW, baseD) * 0.75, 0.28, 4]} />
            <meshStandardMaterial color={new THREE.Color('#4b5563')} emissive={new THREE.Color('#6b7280')} emissiveIntensity={0.08} roughness={0.75} />
          </mesh>
          {/* Upper eave plate */}
          <mesh position={[0, 1.06, 0]} raycast={() => null}>
            <boxGeometry args={[baseW * 0.72, 0.035, baseD * 0.72]} />
            <meshStandardMaterial color={new THREE.Color('#374151')} emissive={new THREE.Color('#4b5563')} emissiveIntensity={0.08} roughness={0.8} />
          </mesh>
          {/* Upper roof */}
          <mesh position={[0, 1.18, 0]} rotation={[0, Math.PI / 4, 0]} raycast={() => null}>
            <coneGeometry args={[Math.min(baseW, baseD) * 0.5, 0.24, 4]} />
            <meshStandardMaterial color={new THREE.Color('#4b5563')} emissive={new THREE.Color('#6b7280')} emissiveIntensity={0.08} roughness={0.75} />
          </mesh>
          {/* Finial */}
          <mesh position={[0, 1.32, 0]} raycast={() => null}>
            <cylinderGeometry args={[0.02, 0.02, 0.08, 8]} />
            <meshStandardMaterial color={new THREE.Color('#374151')} roughness={1} />
          </mesh>
        </group>

        {/* Entrance shoji (two sliding panels) */}
        <group position={[0, 0.36, baseD * 0.41]}>
          {[ -0.12, 0.12 ].map((x, i) => (
            <group key={`door-${i}`} position={[x, 0, 0]}>
              <mesh raycast={() => null}>
                <boxGeometry args={[0.18, 0.28, 0.03]} />
                <meshStandardMaterial color={new THREE.Color('#f3f4f6')} roughness={1} />
              </mesh>
              {/* door grid */}
              <mesh position={[0, 0, 0.017]} raycast={() => null}>
                <boxGeometry args={[0.18, 0.02, 0.002]} />
                <meshStandardMaterial color={new THREE.Color('#8b5e3c')} />
              </mesh>
              {[-0.07, 0, 0.07].map((vx, j) => (
                <mesh key={`dg-${i}-${j}`} position={[vx, 0, 0.017]} raycast={() => null}>
                  <boxGeometry args={[0.02, 0.28, 0.002]} />
                  <meshStandardMaterial color={new THREE.Color('#8b5e3c')} />
                </mesh>
              ))}
            </group>
          ))}
        </group>

        {/* Stone lanterns with warm glow */}
        {[
          [-baseW * 0.32, baseD * 0.32],
          [ baseW * 0.32, baseD * 0.32],
        ].map(([lx, lz], i) => (
          <group key={`lantern-${i}`} position={[lx, 0.14, lz]}>
            <mesh raycast={() => null}>
              <cylinderGeometry args={[0.03, 0.03, 0.16, 8]} />
              <meshStandardMaterial color={new THREE.Color('#9ca3af')} roughness={1} />
            </mesh>
            <mesh position={[0, 0.12, 0]} raycast={() => null}>
              <boxGeometry args={[0.08, 0.05, 0.08]} />
              <meshStandardMaterial color={new THREE.Color('#fef3c7')} emissive={new THREE.Color('#f59e0b')} emissiveIntensity={0.35} roughness={0.8} />
            </mesh>
          </group>
        ))}
      </group>
    );
  };

  return (
    <div className={className} style={{ width: "100%", height }}>
      <Canvas
        dpr={[1, 1.5]}
        gl={{ antialias: false, alpha: true, depth: true, powerPreference: 'high-performance' }}
        shadows={false}
        frameloop="always"
      >
        {/* Theme-aware lights */}
        <hemisphereLight color={isDark ? 0xe8fff6 : 0xf3fff9} groundColor={isDark ? 0x6b7a73 : 0x9aa7a1} intensity={isDark ? 0.75 : 0.6} />
        <ambientLight color={new THREE.Color('#ffffff')} intensity={isDark ? 0.45 : 0.35} />
        <directionalLight position={[3, 6, 3]} intensity={isDark ? 0.85 : 0.75} color={new THREE.Color('#ffffff')} />

        {/* Sun visual (outside Bounds so it doesn't affect fit) */}
        <Sun />

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
                <meshStandardMaterial color={new THREE.Color("#6b4226")} roughness={1} map={textureMaps.dirt} roughnessMap={textureMaps.dirtRough} />
              </mesh>
              <mesh position={[0, 0.31, 0]} raycast={() => null}>
                <boxGeometry args={[width + 1.1, 0.06, depth + 1.1]} />
                <meshStandardMaterial color={new THREE.Color("#baf7a1")} roughness={0.8} map={textureMaps.grass} />
              </mesh>
            </group>
            {/* Decorative perimeter */}
            {!reducedMotion && <Fence />}
            {/* Decorative scatter: rocks and tall grass */}
            <ScatterDecor seed={1337} />
            {/* House spanning the center 2x2 tiles */}
            <House />
            {/* Tiles */}
            {positions.map((pos, i) => {
              const t = normalized[i];
              return (
                <group key={i} position={pos}>
                  <MemoTileMesh i={i} position={[0, 0, 0]} hovered={i === hoveredIndex} checker={(i + Math.floor(i / cols)) % 2 === 0} geoms={geoms} maps={{ grass: textureMaps.grass, grassRough: textureMaps.grassRough, dirt: textureMaps.dirt, dirtRough: textureMaps.dirtRough }} isDark={isDark} />
                  {/* Tree */}
                  {houseSet.has(i) ? null : (isTree(t) ? <TreeMesh type={t} animated={!reducedMotion && pageVisible} maps={{ bark: textureMaps.bark, leaves: textureMaps.leaves }} /> : null)}
                </group>
              );
            })}
            {/* Interaction plane: captures pointer move/clicks for hover and selection */}
            <mesh
              position={[0, 0.06, 0]}
              rotation={[-Math.PI / 2, 0, 0]}
              onPointerOver={(e) => {
                const p = e.point;
                const idx = indexFromXZ(p.x, p.z);
                if (idx !== hoveredIndex) {
                  setHoveredIndex(idx);
                  if (typeof document !== 'undefined') {
                    const overHouse = idx !== null && houseSet.has(idx);
                    document.body.style.cursor = idx !== null && !overHouse ? 'pointer' : 'default';
                  }
                  invalidate();
                }
              }}
              onPointerMove={(e) => {
                const p = e.point;
                lastMoveXZ.current = { x: p.x, z: p.z };
                if (moveRAF.current == null) {
                  moveRAF.current = window.requestAnimationFrame(() => {
                    moveRAF.current = null;
                    const last = lastMoveXZ.current;
                    if (!last) return;
                    const idx = indexFromXZ(last.x, last.z);
                    if (idx !== hoveredIndex) {
                      setHoveredIndex(idx);
                      if (typeof document !== 'undefined') {
                        const overHouse = idx !== null && houseSet.has(idx);
                        document.body.style.cursor = idx !== null && !overHouse ? 'pointer' : 'default';
                      }
                      invalidate();
                    }
                  });
                }
              }}
              onClick={(e) => {
                const p = e.point;
                const idx = indexFromXZ(p.x, p.z);
                if (idx !== null && !houseSet.has(idx)) handleTile(idx);
                invalidate();
              }}
              onPointerLeave={() => {
                if (hoveredIndex !== null) {
                  setHoveredIndex(null);
                  if (typeof document !== 'undefined') document.body.style.cursor = 'default';
                  invalidate();
                }
                if (moveRAF.current) { window.cancelAnimationFrame(moveRAF.current); moveRAF.current = null; }
                lastMoveXZ.current = null;
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
