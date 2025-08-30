import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { db } from "@/server/db";
import { updateWeeklyLeaderboard } from "@/lib/leaderboard";

export const tripRouter = createTRPCRouter({
  // Create a new trip
  createTrip: protectedProcedure
    .input(
      z.object({
        startLat: z.number(),
        startLng: z.number(),
        endLat: z.number(),
        endLng: z.number(),
        distanceM: z.number(),
        durationS: z.number(),
        modeGuess: z.string().default("unknown"),
        valid: z.boolean().default(false),
        coinsAwarded: z.number().default(0),
        startedAt: z.date(),
        endedAt: z.date().optional(),
        polyline: z.string(), // JSON string of route points
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const trip = await db.trip.create({
        data: {
          userId,
          startLat: input.startLat,
          startLng: input.startLng,
          endLat: input.endLat,
          endLng: input.endLng,
          distanceM: input.distanceM,
          durationS: input.durationS,
          modeGuess: input.modeGuess,
          valid: input.valid,
          coinsAwarded: input.coinsAwarded,
          startedAt: input.startedAt,
          endedAt: input.endedAt,
          polyline: input.polyline,
        },
      });

      // If trip is valid and coins were awarded, update leaderboard
      if (input.valid && input.coinsAwarded > 0) {
        await updateWeeklyLeaderboard(userId, input.coinsAwarded);
      }

      return trip;
    }),

  // Get user's trips
  getUserTrips: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(10),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const trips = await db.trip.findMany({
        where: { userId },
        orderBy: { startedAt: "desc" },
        take: input.limit,
        skip: input.offset,
      });

      const total = await db.trip.count({
        where: { userId },
      });

      return {
        trips,
        total,
        hasMore: input.offset + input.limit < total,
      };
    }),

  // Get trip statistics
  getTripStats: protectedProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.session.user.id;

      const stats = await db.trip.aggregate({
        where: { userId },
        _count: {
          _all: true,
          valid: true,
        },
        _sum: {
          distanceM: true,
          durationS: true,
          coinsAwarded: true,
        },
      });

      return {
        totalTrips: stats._count._all,
        validTrips: stats._count.valid,
        totalDistance: stats._sum.distanceM || 0,
        totalDuration: stats._sum.durationS || 0,
        totalCoinsEarned: stats._sum.coinsAwarded || 0,
      };
    }),

  // Get today's trips
  getTodayTrips: protectedProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.session.user.id;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const trips = await db.trip.findMany({
        where: {
          userId,
          startedAt: {
            gte: today,
            lt: tomorrow,
          },
        },
        orderBy: { startedAt: "desc" },
      });

      return trips;
    }),

  // Get weekly statistics
  getWeeklyStats: protectedProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.session.user.id;
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Start of current week (Sunday)
      weekStart.setHours(0, 0, 0, 0);

      const stats = await db.trip.aggregate({
        where: {
          userId,
          startedAt: {
            gte: weekStart,
          },
        },
        _count: {
          _all: true,
          valid: true,
        },
        _sum: {
          distanceM: true,
          durationS: true,
          coinsAwarded: true,
        },
      });

      const weeklyDistanceKm = (stats._sum.distanceM || 0) / 1000;
      const weeklyCO2Saved = weeklyDistanceKm * 120; // grams

      return {
        totalTrips: stats._count._all,
        validTrips: stats._count.valid,
        totalDistance: stats._sum.distanceM || 0,
        totalDuration: stats._sum.durationS || 0,
        totalCoinsEarned: stats._sum.coinsAwarded || 0,
        weeklyDistanceKm,
        weeklyCO2Saved,
      };
    }),

  // Validate and complete a trip
  completeTrip: protectedProcedure
    .input(
      z.object({
        startLat: z.number(),
        startLng: z.number(),
        endLat: z.number(),
        endLng: z.number(),
        distanceM: z.number(),
        durationS: z.number(),
        polyline: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const now = new Date();

      // Validation rules
      const minDistance = 500; // 500 meters minimum
      const minDuration = 8 * 60; // 8 minutes minimum
      const maxSpeed = 15; // 15 km/h maximum average speed
      const maxPointSpeed = 30; // 30 km/h maximum point speed

      // Calculate average speed
      const avgSpeedKmh = (input.distanceM / 1000) / (input.durationS / 3600);
      
      // Basic validation
      const isValid = 
        input.distanceM >= minDistance &&
        input.durationS >= minDuration &&
        avgSpeedKmh <= maxSpeed;

      // Calculate coins based on distance
      const coinsAwarded = isValid ? Math.max(1, Math.round(input.distanceM / 100)) : 0;

      // Determine mode guess based on average speed
      let modeGuess = "unknown";
      if (avgSpeedKmh <= 6) modeGuess = "walk";
      else if (avgSpeedKmh <= 25) modeGuess = "bike";
      else modeGuess = "unknown";

      const trip = await db.trip.create({
        data: {
          userId,
          startLat: input.startLat,
          startLng: input.startLng,
          endLat: input.endLat,
          endLng: input.endLng,
          distanceM: input.distanceM,
          durationS: input.durationS,
          modeGuess,
          valid: isValid,
          coinsAwarded,
          startedAt: new Date(now.getTime() - input.durationS * 1000), // Calculate start time
          endedAt: now,
          polyline: input.polyline,
        },
      });

      // If trip is valid, update coins and leaderboard
      if (isValid && coinsAwarded > 0) {
        // Update user's coin balance
        await db.profile.upsert({
          where: { userId },
          create: {
            userId,
            totalCoins: coinsAwarded,
          },
          update: {
            totalCoins: {
              increment: coinsAwarded,
            },
          },
        });

        // Update weekly leaderboard
        await updateWeeklyLeaderboard(userId, coinsAwarded);
      }

      return {
        trip,
        isValid,
        coinsAwarded,
        modeGuess,
        avgSpeedKmh: avgSpeedKmh.toFixed(1),
      };
    }),
});
