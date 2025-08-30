import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { TreeType } from "@prisma/client";

import {
  createTRPCRouter,
  protectedProcedure,
} from "@/server/api/trpc";
import { db } from "@/server/db";
import { isHouse } from "@/lib/garden";
import { updateWeeklyLeaderboard } from "@/lib/leaderboard";

// Tree prices from the garden shop (Japanese-themed)
const TREE_PRICES: Record<TreeType, number> = {
  pine: 150,
  bamboo: 200,
  maple: 300,
  bonsai: 500,
  sakura: 650,
  withered: 0, // Withered trees have no value
};

export const coinRouter = createTRPCRouter({
  // Get user's coin balance
  getBalance: protectedProcedure
    .query(async ({ ctx }) => {
      const profile = await db.profile.findUnique({
        where: { userId: ctx.session.user.id },
      });

      return {
        coins: profile?.totalCoins ?? 0,
      };
    }),

  // Get user's garden data
  getGarden: protectedProcedure
    .query(async ({ ctx }) => {
      const gardens = await db.garden.findMany({
        where: { userId: ctx.session.user.id },
        orderBy: { plantedAt: "asc" },
      });

      // Convert to 10x10 grid format
      const tiles = new Array(100).fill("empty");
      gardens.forEach((garden) => {
        // Hide any existing trees on house tiles from the tiles array
        if (isHouse(garden.x, garden.y, 10, 10)) return;
        const index = garden.y * 10 + garden.x;
        if (index >= 0 && index < 100) {
          tiles[index] = garden.type;
        }
      });

      return {
        tiles,
        gardens,
      };
    }),

  // Plant a tree (spend coins and save to database)
  plantTree: protectedProcedure
    .input(
      z.object({
        x: z.number().min(0).max(9),
        y: z.number().min(0).max(9),
        type: z.enum(["pine", "bamboo", "maple", "bonsai", "sakura"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { x, y, type } = input;
      const userId = ctx.session.user.id;
      // Disallow planting on house tiles (center 2x2)
      if (isHouse(x, y, 10, 10)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You can't plant on the house tiles.",
        });
      }

      // Get user's current coin balance
      const profile = await db.profile.findUnique({
        where: { userId },
      });

      const currentCoins = profile?.totalCoins ?? 0;
      const treePrice = TREE_PRICES[type];

      // Check if user has enough coins
      if (currentCoins < treePrice) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Not enough coins. You need ${treePrice} coins but have ${currentCoins}.`,
        });
      }

      // Check if tile is already occupied
      const existingTree = await db.garden.findUnique({
        where: {
          userId_x_y: {
            userId,
            x,
            y,
          },
        },
      });

      if (existingTree) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This tile is already occupied by a tree.",
        });
      }

      // Use transaction to ensure atomicity
      const result = await db.$transaction(async (tx) => {
        // Deduct coins
        await tx.profile.upsert({
          where: { userId },
          create: {
            userId,
            totalCoins: currentCoins - treePrice,
            treesPlantedVirtual: 1,
          },
          update: {
            totalCoins: currentCoins - treePrice,
            treesPlantedVirtual: {
              increment: 1,
            },
          },
        });

        // Plant the tree
        const garden = await tx.garden.create({
          data: {
            userId,
            type,
            x,
            y,
            status: "alive",
          },
        });

        return garden;
      });

      return {
        success: true,
        tree: result,
        newBalance: currentCoins - treePrice,
      };
    }),

  // Remove a tree (refund partial coins)
  removeTree: protectedProcedure
    .input(
      z.object({
        x: z.number().min(0).max(9),
        y: z.number().min(0).max(9),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { x, y } = input;
      const userId = ctx.session.user.id;

      // Find the existing tree
      const existingTree = await db.garden.findUnique({
        where: {
          userId_x_y: {
            userId,
            x,
            y,
          },
        },
      });

      if (!existingTree) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No tree found at this location.",
        });
      }

      // Calculate refund (50% of original price)
      const originalPrice = TREE_PRICES[existingTree.type] ?? 0;
      const refund = Math.floor(originalPrice * 0.5);

      // Use transaction to ensure atomicity
      const result = await db.$transaction(async (tx) => {
        // Add refund to coins
        if (refund > 0) {
          await tx.profile.upsert({
            where: { userId },
            create: {
              userId,
              totalCoins: refund,
            },
            update: {
              totalCoins: {
                increment: refund,
              },
            },
          });
        }

        // Remove the tree
        await tx.garden.delete({
          where: {
            userId_x_y: {
              userId,
              x,
              y,
            },
          },
        });
      });

      return {
        success: true,
        refund,
      };
    }),

  // Add coins (for trip rewards)
  addCoins: protectedProcedure
    .input(
      z.object({
        amount: z.number().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { amount } = input;
      const userId = ctx.session.user.id;

      const profile = await db.profile.upsert({
        where: { userId },
        create: {
          userId,
          totalCoins: amount,
        },
        update: {
          totalCoins: {
            increment: amount,
          },
        },
      });

      // Update weekly leaderboard
      await updateWeeklyLeaderboard(userId, amount);

      return {
        success: true,
        newBalance: profile.totalCoins,
      };
    }),

  // Development endpoint to give starting coins (remove in production)
  giveStartingCoins: protectedProcedure
    .mutation(async ({ ctx }) => {
      const userId = ctx.session.user.id;

      const profile = await db.profile.upsert({
        where: { userId },
        create: {
          userId,
          totalCoins: 1000,
        },
        update: {
          totalCoins: 1000, // Reset to 1000 for testing
        },
      });

      // Update weekly leaderboard with starting coins
      await updateWeeklyLeaderboard(userId, 1000);

      return {
        success: true,
        newBalance: profile.totalCoins,
      };
    }),
});
