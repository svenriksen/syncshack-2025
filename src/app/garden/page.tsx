"use client";

import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import { Button } from "../_components/button";
import dynamic from "next/dynamic";
const GardenIso3D = dynamic(() => import("../_components/garden-iso-3d").then((m) => m.GardenIso3D), { ssr: false });
import { DEFAULT_COLS, DEFAULT_ROWS } from "../_components/garden-config";
import { api } from "@/trpc/react";
import { toast } from "sonner";
import { ProtectedRoute } from "../_components/protected-route";

type TreeType = "empty" | "sapling" | "young" | "mature" | "withered";

export default function GardenPage() {
  const cols = DEFAULT_COLS;
  const rows = DEFAULT_ROWS;
  const [tiles, setTiles] = useState<TreeType[]>(() => new Array<TreeType>(rows * cols).fill("empty"));
  const [selected, setSelected] = useState<Exclude<TreeType, "empty">>("sapling");
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Get user's coin balance and garden data
  const { data: balanceData, refetch: refetchBalance } = api.coin.getBalance.useQuery();
  const { data: gardenData, refetch: refetchGarden } = api.coin.getGarden.useQuery();
  
  // Plant tree mutation
  const plantTreeMutation = api.coin.plantTree.useMutation({
    onSuccess: () => {
      refetchBalance();
      refetchGarden();
      toast.success("Tree planted successfully!");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Remove tree mutation
  const removeTreeMutation = api.coin.removeTree.useMutation({
    onSuccess: (data) => {
      refetchBalance();
      refetchGarden();
      if (data.refund > 0) {
        toast.success(`Tree removed! Refunded ${data.refund} coins.`);
      } else {
        toast.success("Tree removed!");
      }
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const coins = balanceData?.coins ?? 0;

  const handleTileClick = (idx: number) => {
    const x = idx % cols;
    const y = Math.floor(idx / cols);
    const currentTile = tiles[idx];

    if (currentTile === "empty") {
      // Plant a tree
      plantTreeMutation.mutate({ x, y, type: selected });
    } else {
      // Remove the tree
      removeTreeMutation.mutate({ x, y });
    }
  };

  const plantedCount = useMemo(() => tiles.filter((t) => t !== "empty").length, [tiles]);

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Garden</h1>
          <Link href="/" className="text-sm text-[rgb(var(--color-primary))] hover:underline">Back</Link>
        </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="card p-4 md:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white/80">Your Plot ({rows}×{cols})</h2>
            <div className="text-xs text-white/60">Planted: {plantedCount}/{rows * cols}</div>
          </div>
          <div className="h-[240px] md:h-[70vh]">
            {mounted && (
              <GardenIso3D
                className="relative overflow-hidden rounded-[var(--radius-lg)]"
                cols={cols}
                rows={rows}
                tiles={tiles}
                onTileClick={handleTileClick}
                height="100%"
              />
            )}
          </div>
        </div>
        <div className="card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white/80">Shop</h2>
              <div className="text-sm font-medium text-[rgb(var(--color-primary))]">{coins} coins</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button 
                variant={selected === "sapling" ? "primary" : "secondary"} 
                onClick={() => setSelected("sapling")}
                disabled={coins < 100}
              >
                Sapling • 100
              </Button>
              <Button 
                variant={selected === "young" ? "primary" : "secondary"} 
                onClick={() => setSelected("young")}
                disabled={coins < 250}
              >
                Young • 250
              </Button>
              <Button 
                variant={selected === "mature" ? "primary" : "secondary"} 
                onClick={() => setSelected("mature")}
                disabled={coins < 600}
              >
                Mature • 600
              </Button>
              <Button 
                variant={selected === "withered" ? "primary" : "secondary"} 
                onClick={() => setSelected("withered")}
              >
                Withered
              </Button>
            </div>
            <div className="rounded-[var(--radius-sm)] bg-white/5 p-3 text-sm text-white/70">
              Click a tile to plant the selected tree. Click again to remove.
            </div>
            <div className="text-xs text-white/50">If you miss a day, your newest tree withers.</div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
