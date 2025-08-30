"use client";

import dynamic from "next/dynamic";
import { api } from "@/trpc/react";

const GardenIso3D = dynamic(
  () => import("./garden-iso-3d").then((m) => m.GardenIso3D),
  { ssr: false }
);

export function GardenPreview() {
  const { data: gardenData } = api.coin.getGarden.useQuery();
  
  const tiles = gardenData?.tiles ?? Array.from({ length: 80 }, () => "empty") as (
    | "empty"
    | "sapling"
    | "young"
    | "mature"
    | "withered"
  )[];

  return (
    <div className="relative overflow-hidden rounded-[var(--radius-lg)]">
      <GardenIso3D
        height="260px"
        cols={10}
        rows={8}
        tiles={tiles}
      />
    </div>
  );
}
