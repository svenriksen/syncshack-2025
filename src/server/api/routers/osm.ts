import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { geocodeNominatim, overpassHiddenGems } from "@/server/osm";

export const osmRouter = createTRPCRouter({
    geocode: publicProcedure
        .input(z.object({ q: z.string().min(2) }))
        .mutation(async ({ input }) => {
            const point = await geocodeNominatim(input.q);
            return { query: input.q, point };
        }),

    gems: publicProcedure
        .input(z.object({
            lat: z.number().gte(-90).lte(90),
            lng: z.number().gte(-180).lte(180),
            radius: z.number().int().positive().max(20000).default(3000),
        }))
        .mutation(async ({ input }) => {
            const items = await overpassHiddenGems(
                { lat: input.lat, lng: input.lng },
                input.radius,
            );
            return { origin: { lat: input.lat, lng: input.lng }, radius: input.radius, items };
        }),
});
