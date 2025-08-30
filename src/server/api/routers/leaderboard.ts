import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "@/server/api/trpc";
import { db } from "@/server/db";

// Helper function to get the start of the current week (Monday)
function getWeekStartDate(date: Date = new Date()): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export const leaderboardRouter = createTRPCRouter({
  // Get current week's leaderboard
  getWeeklyLeaderboard: publicProcedure
    .query(async () => {
      const weekStart = getWeekStartDate();
      
      const leaderboard = await db.leaderboardWeek.findMany({
        where: {
          weekStartDate: weekStart,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
        },
        orderBy: {
          coins: "desc",
        },
        take: 50, // Top 50 players
      });

      return {
        weekStart,
        weekEnd: new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000), // Sunday
        leaderboard: leaderboard.map((entry, index) => ({
          rank: index + 1,
          userId: entry.userId,
          userName: entry.user.name || "Anonymous",
          userImage: entry.user.image,
          coins: entry.coins,
        })),
      };
    }),

  // Get user's current week entry
  getUserWeeklyEntry: protectedProcedure
    .query(async ({ ctx }) => {
      const weekStart = getWeekStartDate();
      
      const entry = await db.leaderboardWeek.findUnique({
        where: {
          weekStartDate_userId: {
            weekStartDate: weekStart,
            userId: ctx.session.user.id,
          },
        },
      });

      return entry;
    }),

  // Update user's weekly coins (called when coins are earned)
  updateWeeklyCoins: protectedProcedure
    .input(z.object({
      coins: z.number().int().min(0),
    }))
    .mutation(async ({ ctx, input }) => {
      const weekStart = getWeekStartDate();
      
      const entry = await db.leaderboardWeek.upsert({
        where: {
          weekStartDate_userId: {
            weekStartDate: weekStart,
            userId: ctx.session.user.id,
          },
        },
        create: {
          weekStartDate: weekStart,
          userId: ctx.session.user.id,
          coins: input.coins,
        },
        update: {
          coins: {
            increment: input.coins,
          },
        },
      });

      return entry;
    }),

  // Get user's rank in current week
  getUserRank: protectedProcedure
    .query(async ({ ctx }) => {
      const weekStart = getWeekStartDate();
      
      const userEntry = await db.leaderboardWeek.findUnique({
        where: {
          weekStartDate_userId: {
            weekStartDate: weekStart,
            userId: ctx.session.user.id,
          },
        },
      });

      if (!userEntry) {
        return { rank: null, totalPlayers: 0 };
      }

      // Count how many players have more coins than this user
      const playersAhead = await db.leaderboardWeek.count({
        where: {
          weekStartDate: weekStart,
          coins: {
            gt: userEntry.coins,
          },
        },
      });

      const totalPlayers = await db.leaderboardWeek.count({
        where: {
          weekStartDate: weekStart,
        },
      });

      return {
        rank: playersAhead + 1,
        totalPlayers,
        coins: userEntry.coins,
      };
    }),

  // Get previous week's leaderboard (for historical data)
  getPreviousWeekLeaderboard: publicProcedure
    .input(z.object({
      weeksAgo: z.number().int().min(1).max(52).default(1), // Up to 1 year back
    }))
    .query(async ({ input }) => {
      const currentWeekStart = getWeekStartDate();
      const targetWeekStart = new Date(currentWeekStart);
      targetWeekStart.setDate(targetWeekStart.getDate() - (7 * input.weeksAgo));
      
      const leaderboard = await db.leaderboardWeek.findMany({
        where: {
          weekStartDate: targetWeekStart,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
        },
        orderBy: {
          coins: "desc",
        },
        take: 10, // Top 10 for historical data
      });

      return {
        weekStart: targetWeekStart,
        weekEnd: new Date(targetWeekStart.getTime() + 6 * 24 * 60 * 60 * 1000),
        leaderboard: leaderboard.map((entry, index) => ({
          rank: index + 1,
          userId: entry.userId,
          userName: entry.user.name || "Anonymous",
          userImage: entry.user.image,
          coins: entry.coins,
        })),
      };
    }),

  // Development endpoint to add test data (remove in production)
  addTestData: protectedProcedure
    .mutation(async ({ ctx }) => {
      const weekStart = getWeekStartDate();
      
      // Add some test entries for the current user
      await db.leaderboardWeek.upsert({
        where: {
          weekStartDate_userId: {
            weekStartDate: weekStart,
            userId: ctx.session.user.id,
          },
        },
        create: {
          weekStartDate: weekStart,
          userId: ctx.session.user.id,
          coins: 150,
        },
        update: {
          coins: 150,
        },
      });

      return { success: true, message: "Test data added" };
    }),
});
