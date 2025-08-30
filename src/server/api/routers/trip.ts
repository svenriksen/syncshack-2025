import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "@/server/api/trpc";
import { db } from "@/server/db";
import { updateWeeklyLeaderboard } from "@/lib/leaderboard";

// Helper function to determine region from coordinates
function getRegionFromCoordinates(lat: number, lng: number): string {
  // Simple region detection based on coordinate ranges
  if (lat >= 40 && lat <= 50 && lng >= -80 && lng <= -60) {
    return "Northeast US";
  } else if (lat >= 30 && lat <= 40 && lng >= -90 && lng <= -70) {
    return "Southeast US";
  } else if (lat >= 40 && lat <= 50 && lng >= -120 && lng <= -80) {
    return "Western US";
  } else if (lat >= 50 && lat <= 70 && lng >= -140 && lng <= -50) {
    return "Canada";
  } else if (lat >= 50 && lat <= 60 && lng >= -10 && lng <= 10) {
    return "UK & Ireland";
  } else if (lat >= 40 && lat <= 60 && lng >= -10 && lng <= 40) {
    return "Europe";
  } else if (lat >= 20 && lat <= 40 && lng >= 100 && lng <= 140) {
    return "East Asia";
  } else if (lat >= -40 && lat <= -10 && lng >= 110 && lng <= 155) {
    return "Australia";
  } else {
    return "Other";
  }
}

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

  // Get all trip data for heatmap (public endpoint for everyone's impact)
  getAllTripsForHeatmap: publicProcedure
    .input(
      z.object({
        timeRange: z.enum(["all", "week", "month"]).optional().default("all"),
        includeInvalid: z.boolean().optional().default(false),
      }).optional().default({})
    )
    .query(async ({ input }) => {
      // Ensure input has default values
      const { timeRange = "all", includeInvalid = false } = input || {};
      const now = new Date();
      let startDate: Date | undefined;

      // Calculate start date based on time range
      if (timeRange === "week") {
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
      } else if (timeRange === "month") {
        startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - 1);
      }

      // Build where clause
      const whereClause: any = {};
      if (startDate) {
        whereClause.startedAt = {
          gte: startDate,
        };
      }
      if (!includeInvalid) {
        whereClause.valid = true;
      }

      const trips = await db.trip.findMany({
        where: whereClause,
        select: {
          id: true,
          startLat: true,
          startLng: true,
          endLat: true,
          endLng: true,
          distanceM: true,
          modeGuess: true,
          valid: true,
          startedAt: true,
          polyline: true,
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          startedAt: "desc",
        },
      });

      // Process trip data for heatmap
      const heatmapData = trips.map(trip => {
        const co2Saved = (trip.distanceM / 1000) * 120; // grams
        return {
          id: trip.id,
          startPoint: [trip.startLng, trip.startLat],
          endPoint: [trip.endLng, trip.endLat],
          distance: trip.distanceM,
          co2Saved,
          mode: trip.modeGuess,
          valid: trip.valid,
          date: trip.startedAt,
          userName: trip.user.name || "Anonymous",
          polyline: trip.polyline ? JSON.parse(trip.polyline) : null,
        };
      });

      // Calculate aggregate statistics
      const totalTrips = trips.length;
      const validTrips = trips.filter(t => t.valid).length;
      const totalDistance = trips.reduce((sum, t) => sum + t.distanceM, 0);
      const totalCO2Saved = (totalDistance / 1000) * 120;
      const uniqueUsers = new Set(trips.map(t => t.user.id)).size;

      // Calculate region-based statistics (simplified by grouping by rough geographic areas)
      const regionStats = new Map<string, {
        trips: number;
        validTrips: number;
        distance: number;
        co2Saved: number;
        users: Set<string>;
      }>();

      trips.forEach(trip => {
        // Simple region detection based on coordinates
        const region = getRegionFromCoordinates(trip.startLat, trip.startLng);
        const existing = regionStats.get(region) || {
          trips: 0,
          validTrips: 0,
          distance: 0,
          co2Saved: 0,
          users: new Set<string>(),
        };

        existing.trips++;
        if (trip.valid) existing.validTrips++;
        existing.distance += trip.distanceM;
        existing.co2Saved += (trip.distanceM / 1000) * 120;
        existing.users.add(trip.user.id);

        regionStats.set(region, existing);
      });

      const regionData = Array.from(regionStats.entries()).map(([region, stats]) => ({
        region,
        trips: stats.trips,
        validTrips: stats.validTrips,
        distance: stats.distance,
        co2Saved: stats.co2Saved,
        uniqueUsers: stats.users.size,
      })).sort((a, b) => b.trips - a.trips);

      return {
        trips: heatmapData,
        stats: {
          totalTrips,
          validTrips,
          totalDistance,
          totalCO2Saved,
          uniqueUsers,
          timeRange: timeRange,
        },
        regions: regionData,
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
