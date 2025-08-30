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
  const [selected, setSelected] = useState<"sapling" | "young" | "mature">("sapling");
  const [mounted, setMounted] = useState(false);
  const [isLocalhost, setIsLocalhost] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (typeof window !== "undefined") {
      const host = window.location.hostname;
      setIsLocalhost(host === "localhost" || host === "127.0.0.1");
    }
  }, []);

  // Get user's coin balance and garden data
  const { data: balanceData, refetch: refetchBalance } = api.coin.getBalance.useQuery();
  const { data: gardenData, refetch: refetchGarden } = api.coin.getGarden.useQuery();
  const utils = api.useUtils();

  // Dev-only: grant 1000 coins on localhost
  const giveCoinsMutation = api.coin.giveStartingCoins.useMutation({
    onMutate: async () => {
      await utils.coin.getBalance.cancel();
      const prev = utils.coin.getBalance.getData();
      // Optimistically set to 1000; server will confirm exact value
      utils.coin.getBalance.setData(undefined, { coins: 1000 });
      return { prev };
    },
    onError: (err, _v, ctx) => {
      if (ctx?.prev) utils.coin.getBalance.setData(undefined, ctx.prev as any);
      toast.error(err.message);
    },
    onSuccess: (data) => {
      utils.coin.getBalance.setData(undefined, { coins: data.newBalance });
      toast.success("Added 1000 coins");
    },
    onSettled: async () => {
      await utils.coin.getBalance.invalidate();
    },
  });

  // Hydrate local tiles from server garden data
  useEffect(() => {
    const serverTiles = gardenData?.tiles as TreeType[] | undefined;
    if (serverTiles) {
      const total = rows * cols;
      const normalized = serverTiles
        .slice(0, total)
        .concat(Array(Math.max(0, total - serverTiles.length)).fill("empty")) as TreeType[];
      setTiles(normalized);
    }
  }, [gardenData, rows, cols]);
  
  // Client-side prices for optimistic coin updates
  const CLIENT_TREE_PRICES: Record<Exclude<TreeType, "empty" | "withered">, number> = {
    sapling: 100,
    young: 250,
    mature: 600,
  } as const;

  // Plant tree mutation with optimistic update
  const plantTreeMutation = api.coin.plantTree.useMutation({
    onMutate: async (variables: { x: number; y: number; type: "sapling" | "young" | "mature" }) => {
      const { x, y, type } = variables;
      const idx = y * cols + x;

      await Promise.all([
        utils.coin.getGarden.cancel(),
        utils.coin.getBalance.cancel(),
      ]);

      const prevGarden = utils.coin.getGarden.getData();
      const prevBalance = utils.coin.getBalance.getData();

      // Optimistically update local tiles state
      setTiles((prev) => {
        const next = [...prev];
        next[idx] = type as TreeType;
        return next;
      });

      // Optimistically update caches
      utils.coin.getGarden.setData(undefined, (old) => {
        const total = rows * cols;
        const tilesArr = (old?.tiles ?? new Array(total).fill("empty")).slice();
        tilesArr[idx] = type;
        return { tiles: tilesArr as TreeType[], gardens: old?.gardens ?? [] } as any;
      });
      const price = CLIENT_TREE_PRICES[type as keyof typeof CLIENT_TREE_PRICES] ?? 0;
      utils.coin.getBalance.setData(undefined, (old) => ({ coins: Math.max(0, (old?.coins ?? 0) - price) }));

      return { prevGarden, prevBalance, idx };
    },
    onError: (error, _vars, context) => {
      // Rollback
      if (context?.prevGarden) utils.coin.getGarden.setData(undefined, context.prevGarden as any);
      if (context?.prevBalance) utils.coin.getBalance.setData(undefined, context.prevBalance as any);
      // Also rollback local tiles by rehydrating from prevGarden
      if (context?.prevGarden?.tiles) setTiles(context.prevGarden.tiles as TreeType[]);
      toast.error(error.message);
    },
    onSettled: async () => {
      await Promise.all([utils.coin.getGarden.invalidate(), utils.coin.getBalance.invalidate()]);
    },
    onSuccess: () => {
      toast.success("Tree planted successfully!");
    },
  });

  // Remove tree mutation with optimistic update
  const removeTreeMutation = api.coin.removeTree.useMutation({
    onMutate: async (variables) => {
      const { x, y } = variables;
      const idx = y * cols + x;

      await Promise.all([
        utils.coin.getGarden.cancel(),
        utils.coin.getBalance.cancel(),
      ]);

      const prevGarden = utils.coin.getGarden.getData();
      const prevBalance = utils.coin.getBalance.getData();

      // Determine refund from existing type for optimistic coin add
      const existingType = tiles[idx];
      const originalPrice = existingType === "sapling" || existingType === "young" || existingType === "mature"
        ? CLIENT_TREE_PRICES[existingType]
        : 0;
      const optimisticRefund = originalPrice > 0 ? Math.floor(originalPrice * 0.5) : 0;

      // Optimistically update local tiles
      setTiles((prev) => {
        const next = [...prev];
        next[idx] = "empty";
        return next;
      });

      // Optimistically update caches
      utils.coin.getGarden.setData(undefined, (old) => {
        const total = rows * cols;
        const tilesArr = (old?.tiles ?? new Array(total).fill("empty")).slice();
        tilesArr[idx] = "empty";
        return { tiles: tilesArr as TreeType[], gardens: old?.gardens ?? [] } as any;
      });
      if (optimisticRefund > 0) {
        utils.coin.getBalance.setData(undefined, (old) => ({ coins: (old?.coins ?? 0) + optimisticRefund }));
      }

      return { prevGarden, prevBalance };
    },
    onError: (error, _vars, context) => {
      if (context?.prevGarden) utils.coin.getGarden.setData(undefined, context.prevGarden as any);
      if (context?.prevBalance) utils.coin.getBalance.setData(undefined, context.prevBalance as any);
      if (context?.prevGarden?.tiles) setTiles(context.prevGarden.tiles as TreeType[]);
      toast.error(error.message);
    },
    onSettled: async () => {
      await Promise.all([utils.coin.getGarden.invalidate(), utils.coin.getBalance.invalidate()]);
    },
    onSuccess: (data) => {
      if (data.refund > 0) {
        toast.success(`Tree removed! Refunded ${data.refund} coins.`);
      } else {
        toast.success("Tree removed!");
      }
    },
  });

  const coins = balanceData?.coins ?? 0;

  const handleTileClick = (idx: number) => {
    const x = idx % cols;
    const y = Math.floor(idx / cols);
    const currentTile = tiles[idx];

    if (currentTile === "empty") {
      // Guard: prevent planting unaffordable trees
      const price = CLIENT_TREE_PRICES[selected as keyof typeof CLIENT_TREE_PRICES] ?? 0;
      if (coins < price) {
        toast.error("Not enough coins to plant this tree.");
        return;
      }

      // Plant a tree (withered is not plantable from UI)
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
            <h2 className="text-sm font-semibold text-[rgb(var(--color-foreground))/0.85]">Your Plot ({rows}×{cols})</h2>
            <div className="text-xs text-[rgb(var(--color-foreground))/0.6]">Planted: {plantedCount}/{rows * cols}</div>
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
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-[rgb(var(--color-foreground))/0.85]">Shop</h2>
              <div className="flex items-center gap-2">
                {isLocalhost && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => giveCoinsMutation.mutate()}
                    disabled={giveCoinsMutation.isPending}
                    title="Dev: grant 1000 coins (localhost only)"
                  >
                    +1000
                  </Button>
                )}
                <div className="text-sm font-medium text-[rgb(var(--color-primary))]">{coins} coins</div>
              </div>
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
            </div>
            <div className="rounded-[var(--radius-sm)] bg-[rgb(var(--color-foreground))/0.06] p-3 text-sm text-[rgb(var(--color-foreground))/0.7]">
              Click a tile to plant the selected tree. Click again to remove.
            </div>
            <div className="text-xs text-[rgb(var(--color-foreground))/0.5]">If you miss a day, your newest tree withers.</div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
