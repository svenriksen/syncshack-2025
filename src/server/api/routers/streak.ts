import { z } from "zod";
import type { Prisma } from "@prisma/client";

import {
  createTRPCRouter,
  protectedProcedure,
} from "@/server/api/trpc";
import { db } from "@/server/db";

// Streak configuration
const STREAK_CONFIG = {
  MAX_MULTIPLIER: 50, // Maximum coin multiplier percentage
  MULTIPLIER_PER_DAY: 10, // Coin multiplier increase per day
} as const;

export const streakRouter = createTRPCRouter({
  // Get user's current streak and multiplier
  getStreak: protectedProcedure
    .query(async ({ ctx }) => {
      const profile = await db.profile.findUnique({
        where: { userId: ctx.session.user.id },
      });

      const currentStreak = profile?.currentStreak ?? 0;
      const longestStreak = profile?.longestStreak ?? 0;
      const multiplier = Math.min(currentStreak * STREAK_CONFIG.MULTIPLIER_PER_DAY, STREAK_CONFIG.MAX_MULTIPLIER);

      return {
        currentStreak,
        longestStreak,
        multiplier,
        lastActiveDate: profile?.lastActiveDate,
      };
    }),

  // Increment streak after a valid trip
  incrementStreak: protectedProcedure
    .mutation(async ({ ctx }) => {
      const userId = ctx.session.user.id;
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Start of today

      const profile = await db.profile.findUnique({
        where: { userId },
      });

      const currentStreak = profile?.currentStreak ?? 0;
      const longestStreak = profile?.longestStreak ?? 0;
      const lastActiveDate = profile?.lastActiveDate;

      // Check if user already completed a trip today
      if (lastActiveDate) {
        const lastActive = new Date(lastActiveDate);
        lastActive.setHours(0, 0, 0, 0);
        
        if (lastActive.getTime() === today.getTime()) {
          // Already completed a trip today, don't increment streak
          return {
            success: true,
            currentStreak,
            longestStreak,
            multiplier: Math.min(currentStreak * STREAK_CONFIG.MULTIPLIER_PER_DAY, STREAK_CONFIG.MAX_MULTIPLIER),
            message: "Already completed a trip today",
          };
        }

        // Check if streak should continue or reset
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        if (lastActive.getTime() !== yesterday.getTime()) {
          // Missed a day: reset streak and wither the most recently planted tree
          const newStreak = 1;
          const newLongestStreak = Math.max(longestStreak, currentStreak);

          await db.$transaction(async (tx: Prisma.TransactionClient) => {
            // Update streak
            await tx.profile.upsert({
              where: { userId },
              create: {
                userId,
                currentStreak: newStreak,
                longestStreak: newLongestStreak,
                lastActiveDate: today,
              },
              update: {
                currentStreak: newStreak,
                longestStreak: newLongestStreak,
                lastActiveDate: today,
              },
            });

            // Wither the most recently planted non-withered tree
            const lastTree = await tx.garden.findFirst({
              where: {
                userId,
                NOT: { type: "withered" },
              },
              orderBy: { plantedAt: "desc" },
            });
            if (lastTree) {
              await tx.garden.update({
                where: { id: lastTree.id },
                data: { type: "withered", status: "withered" },
              });
            }
          });

          return {
            success: true,
            currentStreak: newStreak,
            longestStreak: newLongestStreak,
            multiplier: Math.min(newStreak * STREAK_CONFIG.MULTIPLIER_PER_DAY, STREAK_CONFIG.MAX_MULTIPLIER),
            message: "Streak reset, last tree withered, and started new day",
          };
        }
      }

      // Continue streak
      const newStreak = currentStreak + 1;
      const newLongestStreak = Math.max(longestStreak, newStreak);

      await db.profile.upsert({
        where: { userId },
        create: {
          userId,
          currentStreak: newStreak,
          longestStreak: newLongestStreak,
          lastActiveDate: today,
        },
        update: {
          currentStreak: newStreak,
          longestStreak: newLongestStreak,
          lastActiveDate: today,
        },
      });

      return {
        success: true,
        currentStreak: newStreak,
        longestStreak: newLongestStreak,
        multiplier: Math.min(newStreak * STREAK_CONFIG.MULTIPLIER_PER_DAY, STREAK_CONFIG.MAX_MULTIPLIER),
        message: "Streak incremented",
      };
    }),

  // Reset streak (for when user misses a day)
  resetStreak: protectedProcedure
    .mutation(async ({ ctx }) => {
      const userId = ctx.session.user.id;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const profile = await db.profile.findUnique({
        where: { userId },
      });

      const currentStreak = profile?.currentStreak ?? 0;
      const longestStreak = profile?.longestStreak ?? 0;

      // Update longest streak if current streak was longer
      const newLongestStreak = Math.max(longestStreak, currentStreak);

      await db.$transaction(async (tx: Prisma.TransactionClient) => {
        // Update streak
        await tx.profile.upsert({
          where: { userId },
          create: {
            userId,
            currentStreak: 0,
            longestStreak: newLongestStreak,
            lastActiveDate: today,
          },
          update: {
            currentStreak: 0,
            longestStreak: newLongestStreak,
            lastActiveDate: today,
          },
        });

        // Wither the most recently planted non-withered tree
        const lastTree = await tx.garden.findFirst({
          where: {
            userId,
            NOT: { type: "withered" },
          },
          orderBy: { plantedAt: "desc" },
        });
        if (lastTree) {
          await tx.garden.update({
            where: { id: lastTree.id },
            data: { type: "withered", status: "withered" },
          });
        }
      });

      return {
        success: true,
        currentStreak: 0,
        longestStreak: newLongestStreak,
        multiplier: 0,
        message: "Streak reset",
      };
    }),

  // Get streak statistics
  getStreakStats: protectedProcedure
    .query(async ({ ctx }) => {
      const profile = await db.profile.findUnique({
        where: { userId: ctx.session.user.id },
      });

      const currentStreak = profile?.currentStreak ?? 0;
      const longestStreak = profile?.longestStreak ?? 0;
      const multiplier = Math.min(currentStreak * STREAK_CONFIG.MULTIPLIER_PER_DAY, STREAK_CONFIG.MAX_MULTIPLIER);

      // Calculate days since last activity
      let daysSinceLastActivity = null;
      if (profile?.lastActiveDate) {
        const lastActive = new Date(profile.lastActiveDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        lastActive.setHours(0, 0, 0, 0);
        
        const diffTime = today.getTime() - lastActive.getTime();
        daysSinceLastActivity = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }

      return {
        currentStreak,
        longestStreak,
        multiplier,
        daysSinceLastActivity,
        lastActiveDate: profile?.lastActiveDate,
        maxMultiplier: STREAK_CONFIG.MAX_MULTIPLIER,
        multiplierPerDay: STREAK_CONFIG.MULTIPLIER_PER_DAY,
      };
    }),

  // Check if streak should be reset (for daily cron job)
  checkStreakReset: protectedProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.session.user.id;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const profile = await db.profile.findUnique({
        where: { userId },
      });

      if (!profile?.lastActiveDate) {
        return { shouldReset: false, reason: "No last active date" };
      }

      const lastActive = new Date(profile.lastActiveDate);
      lastActive.setHours(0, 0, 0, 0);

      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      // If last active was before yesterday, streak should be reset
      if (lastActive.getTime() < yesterday.getTime()) {
        return { 
          shouldReset: true, 
          reason: "Missed a day",
          daysMissed: Math.ceil((today.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24)) - 1
        };
      }

      return { shouldReset: false, reason: "Streak is current" };
    }),
});
