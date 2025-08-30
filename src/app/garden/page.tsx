"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "../_components/button";
import { GardenIso3D } from "../_components/garden-iso-3d";

type TreeType = "empty" | "sapling" | "young" | "mature" | "withered";

export default function GardenPage() {
  const cols = 10;
  const rows = 8;
  const [tiles, setTiles] = useState<TreeType[]>(() => new Array<TreeType>(rows * cols).fill("empty"));
  const [selected, setSelected] = useState<Exclude<TreeType, "empty">>("sapling");

  const handleTileClick = (idx: number) => {
    setTiles((prev) => {
      const next = prev.slice();
      next[idx] = prev[idx] === selected ? "empty" : selected;
      return next;
    });
  };

  const plantedCount = useMemo(() => tiles.filter((t) => t !== "empty").length, [tiles]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Garden</h1>
        <Link href="/" className="text-sm text-[rgb(var(--color-primary))] hover:underline">Back</Link>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="card p-4 md:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white/80">Your Plot (8×10)</h2>
            <div className="text-xs text-white/60">Planted: {plantedCount}/80</div>
          </div>
          <GardenIso3D
            className="relative overflow-hidden rounded-[var(--radius-lg)]"
            cols={cols}
            rows={rows}
            tiles={tiles}
            onTileClick={handleTileClick}
          />
        </div>
        <div className="card p-4 space-y-3">
          <h2 className="text-sm font-semibold text-white/80">Shop</h2>
          <div className="grid grid-cols-2 gap-2">
            <Button variant={selected === "sapling" ? "primary" : "secondary"} onClick={() => setSelected("sapling")}>Sapling • 100</Button>
            <Button variant={selected === "young" ? "primary" : "secondary"} onClick={() => setSelected("young")}>Young • 250</Button>
            <Button variant={selected === "mature" ? "primary" : "secondary"} onClick={() => setSelected("mature")}>Mature • 600</Button>
            <Button variant={selected === "withered" ? "primary" : "secondary"} onClick={() => setSelected("withered")}>Withered</Button>
          </div>
          <div className="rounded-[var(--radius-sm)] bg-white/5 p-3 text-sm text-white/70">
            Click a tile to plant the selected tree. Click again to clear.
          </div>
          <div className="text-xs text-white/50">If you miss a day, your newest tree withers.</div>
        </div>
      </div>
    </div>
  );
}
