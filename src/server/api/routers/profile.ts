import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { z } from "zod";

export const profileRouter = createTRPCRouter({
  get: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    // Query user and profile separately to avoid include typing issues before prisma generate runs
    const user = await ctx.db.user.findUnique({
      where: { id: userId },
      // @ts-expect-error createdAt is added in the migration; run `prisma generate` after migrating
      select: { id: true, name: true, email: true, image: true, createdAt: true },
    });
    if (!user) throw new Error("User not found");

    // Ensure a profile exists
    // @ts-expect-error Model types may be outdated until you run `prisma generate`
    let profile = await ctx.db.profile.findUnique({ where: { userId } });
    if (!profile) {
      // @ts-expect-error Model types may be outdated until you run `prisma generate`
      profile = await ctx.db.profile.create({ data: { userId } });
    }

    // @ts-expect-error Model types may be outdated until you run `prisma generate`
    const tripsAgg = await ctx.db.trip.aggregate({
      where: { userId },
      _count: { _all: true },
      _sum: { distanceM: true },
    });

    const trips = tripsAgg._count._all ?? 0;
    const distanceKm = Math.round(((tripsAgg._sum.distanceM ?? 0) / 1000) * 10) / 10; // 1 decimal

    const email = user.email ?? "";
    const username = email ? `@${email.split("@")[0]}` : null;

    return {
      name: user.name ?? null,
      email,
      username,
      bio: profile?.bio ?? null,
      location: profile?.location ?? null,
      avatar: user.image ?? null,
      // @ts-expect-error createdAt is added by migration
      joined: user.createdAt ?? null,
      stats: {
        trips,
        distanceKm,
        coins: profile?.totalCoins ?? 0,
        trees: (profile?.treesPlantedVirtual ?? 0) + (profile?.treesPlantedReal ?? 0),
      },
    } as const;
  }),

  update: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(80).optional(),
        bio: z.string().max(280).optional(),
        location: z.string().max(80).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Update user name if provided
      if (typeof input.name !== "undefined") {
        await ctx.db.user.update({ where: { id: userId }, data: { name: input.name } });
      }

      // Ensure profile exists then update bio/location
      // @ts-expect-error Model types may be outdated until you run `prisma generate`
      await ctx.db.profile.upsert({
        where: { userId },
        create: { userId, bio: input.bio ?? null, location: input.location ?? null },
        update: {
          ...(typeof input.bio !== "undefined" ? { bio: input.bio } : {}),
          ...(typeof input.location !== "undefined" ? { location: input.location } : {}),
        },
      });

      // Return the latest view
      // Reuse the get logic minimally
      const user = await ctx.db.user.findUnique({ where: { id: userId } });
      // @ts-expect-error Model types may be outdated until you run `prisma generate`
      const prof = await ctx.db.profile.findUnique({ where: { userId } });
      // @ts-expect-error Model types may be outdated until you run `prisma generate`
      const tripsAgg = await ctx.db.trip.aggregate({
        where: { userId },
        _count: { _all: true },
        _sum: { distanceM: true },
      });

      const email = user?.email ?? "";
      const username = email ? `@${email.split("@")[0]}` : null;
      const trips = tripsAgg._count._all ?? 0;
      const distanceKm = Math.round(((tripsAgg._sum.distanceM ?? 0) / 1000) * 10) / 10;

      return {
        name: user?.name ?? null,
        email,
        username,
        bio: prof?.bio ?? null,
        location: prof?.location ?? null,
        avatar: user?.image ?? null,
        // @ts-expect-error createdAt is added by migration
        joined: user?.createdAt ?? null,
        stats: {
          trips,
          distanceKm,
          coins: prof?.totalCoins ?? 0,
          trees: (prof?.treesPlantedVirtual ?? 0) + (prof?.treesPlantedReal ?? 0),
        },
      } as const;
    }),
});
