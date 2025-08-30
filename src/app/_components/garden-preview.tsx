"use client";

import dynamic from "next/dynamic";

const GardenIso3D = dynamic(
  () => import("./garden-iso-3d").then((m) => m.GardenIso3D),
  { ssr: false }
);

export function GardenPreview() {
  return (
    <div className="relative overflow-hidden rounded-[var(--radius-lg)]">
      <GardenIso3D
        height="260px"
        cols={10}
        rows={8}
        tiles={Array.from({ length: 80 }, () => "empty") as (
          | "empty"
          | "sapling"
          | "young"
          | "mature"
          | "withered"
        )[]}
      />
    </div>
  );
}
