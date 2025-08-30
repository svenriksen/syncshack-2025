"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import { OrthographicCamera } from "@react-three/drei";
import * as THREE from "three";

export type TreeType = "empty" | "sapling" | "young" | "mature" | "withered";

export type GardenIso3DProps = {
  cols?: number; // default 10
  rows?: number; // default 8
  tiles: TreeType[]; // length = rows * cols
  onTileClick?: (index: number) => void;
  className?: string;
  height?: string; // CSS height, default "min(520px, 60vh)"
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
  onClick,
  checker,
}: {
  i: number;
  position: [number, number, number];
  onClick: (i: number) => void;
  checker: boolean;
}) {
  const ref = useRef<THREE.Mesh>(null!);
  const [hovered, setHovered] = useState(false);
  // Stylized grass tile: lighter/darker checker for variety
  const topColor = new THREE.Color(checker ? "#a3e635" : "#84cc16"); // lime-400/500
  const topColorHover = new THREE.Color("#b4f03b"); // slightly brighter on hover
  const sideColor = new THREE.Color("#7c4b2d"); // dirt brown
  const outline = new THREE.Color(1, 1, 1).multiplyScalar(0.3);
  const outlineHover = new THREE.Color(1, 1, 1).multiplyScalar(0.5);

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onClick(i);
  };

  return (
    <group position={position}>
      {/* Dirt skirt */}
      <mesh position={[0, -0.14, 0]} onClick={handleClick}>
        <boxGeometry args={[1, 0.28, 1]} />
        <meshStandardMaterial color={sideColor} roughness={1} metalness={0} />
      </mesh>
      {/* Grass top slab (slightly inset for bevel illusion) */}
      <mesh
        ref={ref}
        position={[0, 0.02, 0]}
        onClick={handleClick}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          ref.current.scale.set(1.02, 1, 1.02);
          if (typeof document !== "undefined") document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHovered(false);
          ref.current.scale.set(1, 1, 1);
          if (typeof document !== "undefined") document.body.style.cursor = "default";
        }}
      >
        <boxGeometry args={[0.94, 0.04, 0.94]} />
        <meshStandardMaterial color={hovered ? topColorHover : topColor} roughness={0.85} metalness={0} />
      </mesh>
      {/* outline */}
      <lineSegments position={[0, 0.04, 0]}>
        <edgesGeometry args={[new THREE.BoxGeometry(0.94, 0.04, 0.94)]} />
        <lineBasicMaterial color={hovered ? outlineHover : outline} transparent opacity={0.85} />
      </lineSegments>
    </group>
  );
}

function TreeMesh({ type }: { type: Exclude<TreeType, "empty"> }) {
  const group = useRef<THREE.Group>(null!);
  const trunkColor = new THREE.Color("#065f46");
  const gray = new THREE.Color("#6b7280");

  switch (type) {
    case "sapling":
      return (
        <group ref={group} position={[0, 0.08, 0]}>
          <mesh position={[0, 0.2, 0]}> {/* canopy */}
            <sphereGeometry args={[0.2, 16, 16]} />
            <meshStandardMaterial color={new THREE.Color("#10b981")} emissive={new THREE.Color("#064e3b")} emissiveIntensity={0.2} />
          </mesh>
          <mesh position={[0, 0.05, 0]}> {/* trunk */}
            <cylinderGeometry args={[0.05, 0.05, 0.2, 12]} />
            <meshStandardMaterial color={trunkColor} />
          </mesh>
        </group>
      );
    case "young":
      return (
        <group position={[0, 0.08, 0]}>
          <mesh position={[0, 0.35, 0]}>
            <sphereGeometry args={[0.28, 16, 16]} />
            <meshStandardMaterial color={new THREE.Color("#22c55e")} emissive={new THREE.Color("#064e3b")} emissiveIntensity={0.25} />
          </mesh>
          <mesh position={[0.22, 0.25, 0]}>
            <sphereGeometry args={[0.18, 16, 16]} />
            <meshStandardMaterial color={new THREE.Color("#34d399")} />
          </mesh>
          <mesh position={[0, 0.1, 0]}>
            <cylinderGeometry args={[0.06, 0.06, 0.3, 12]} />
            <meshStandardMaterial color={trunkColor} />
          </mesh>
        </group>
      );
    case "mature":
      return (
        <group position={[0, 0.08, 0]}>
          {/* Pine-like cones + trunk for stylized look */}
          <mesh position={[0, 0.35, 0]}>
            <coneGeometry args={[0.28, 0.5, 12]} />
            <meshStandardMaterial color={new THREE.Color("#22c55e")} />
          </mesh>
          <mesh position={[0, 0.15, 0]}>
            <coneGeometry args={[0.22, 0.4, 12]} />
            <meshStandardMaterial color={new THREE.Color("#4ade80")} />
          </mesh>
          <mesh position={[0, 0.04, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 0.18, 12]} />
            <meshStandardMaterial color={trunkColor} />
          </mesh>
        </group>
      );
    case "withered":
      return (
        <group position={[0, 0.08, 0]}>
          <mesh position={[0, 0.2, 0]}>
            <sphereGeometry args={[0.18, 12, 12]} />
            <meshStandardMaterial color={gray} />
          </mesh>
          <mesh position={[0, 0.06, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 0.18, 8]} />
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

export function GardenIso3D({ cols = 10, rows = 8, tiles, onTileClick, className = "", height = "min(520px, 60vh)" }: GardenIso3DProps) {
  const total = rows * cols;
  const normalized = tiles.slice(0, total).concat(Array(Math.max(0, total - tiles.length)).fill("empty"));
  const { positions, width, depth } = useGridPositions(cols, rows);

  const handleTile = (i: number) => onTileClick?.(i);

  const ambientColor = useMemo(() => new THREE.Color(0xffffff), []);

  return (
    <div className={className} style={{ width: "100%", height }}>
      <Canvas dpr={[1, 1.5]} gl={{ antialias: true }} shadows={false}>
        {/* Background */}
        <color attach="background" args={["#144c43"]} />
        {/* Lights */}
        <hemisphereLight color={0xffffff} groundColor={0x334155} intensity={0.55} />
        <ambientLight color={ambientColor} intensity={0.35} />
        <directionalLight position={[3, 6, 3]} intensity={0.65} />

        {/* Orthographic camera with isometric-like angle */}
        {/* 45-45 dimetric (game-like): 45° yaw and 45° tilt */}
        <OrthographicCamera makeDefault position={[8, 8, 8]} near={0.1} far={100} zoom={55} />
        <AimCamera target={[0, 0, 0]} />
        {/* World un-rotated; isometric comes purely from camera */}
        <group rotation={[0, 0, 0]} scale={[0.9, 0.9, 0.9]}>
          {/* Island base: dirt block with grass carpet */}
          <group position={[0, -0.22, 0]}>
            <mesh>
              <boxGeometry args={[width + 1.2, 0.6, depth + 1.2]} />
              <meshStandardMaterial color={new THREE.Color("#6b4226")} roughness={1} />
            </mesh>
            <mesh position={[0, 0.31, 0]}>
              <boxGeometry args={[width + 1.1, 0.06, depth + 1.1]} />
              <meshStandardMaterial color={new THREE.Color("#84cc16")} roughness={0.9} />
            </mesh>
          </group>
          {/* Tiles */}
          {positions.map((pos, i) => {
            const t = normalized[i];
            return (
              <group key={i} position={pos}>
                <TileMesh i={i} position={[0, 0, 0]} onClick={handleTile} checker={(i + Math.floor(i / cols)) % 2 === 0} />
                {/* Tree */}
                {isTree(t) ? <TreeMesh type={t} /> : null}
              </group>
            );
          })}
        </group>
      </Canvas>
    </div>
  );
}
