"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { GardenIso3DProps, TreeType } from "./garden-iso-3d";

const GardenIso3D = dynamic(
  () => import("./garden-iso-3d").then((m) => m.GardenIso3D),
  { ssr: false }
);

type PreviewProps = Pick<GardenIso3DProps, "cols" | "rows" | "height" | "className"> & {
  tiles?: TreeType[];
};

export function GardenPreview({ cols, rows, tiles, height, className = "relative overflow-hidden rounded-[var(--radius-lg)]" }: PreviewProps) {
  const c = cols ?? 10;
  const r = rows ?? 8;
  const total = c * r;
  const normalized: TreeType[] = (tiles ?? [])
    .slice(0, total)
    .concat(Array(Math.max(0, total - (tiles?.length ?? 0))).fill("empty"));
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="h-[240px] md:h-[65vh]">
      {mounted && (
        <GardenIso3D height={height ?? "100%"} cols={c} rows={r} tiles={normalized} className={className} />
      )}
    </div>
  );
}
