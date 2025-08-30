import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import {mapboxHiddenGems, geocodeMapbox, getNearestPlacesByAddress, getDistanceByAddresses} from "@/server/osm";

export const osmRouter = createTRPCRouter({
    // Geocode an address to coordinates
    geocode: publicProcedure
        .input(z.object({ q: z.string().min(2) }))
        .mutation(async ({ input }) => {
            const point = await geocodeMapbox(input.q);
            return { query: input.q, point };
        }),

    // Get hidden gems by coordinates
    gems: publicProcedure
        .input(z.object({
            lat: z.number().gte(-90).lte(90),
            lng: z.number().gte(-180).lte(180),
            radius: z.number().int().positive().max(20000).default(3000),
        }))
        .mutation(async ({ input }) => {
            const items = await mapboxHiddenGems(
                { lat: input.lat, lng: input.lng },
                input.radius,
            );
            return { origin: { lat: input.lat, lng: input.lng }, radius: input.radius, items };
        }),

    // Get hidden gems by address
    gemsByAddress: publicProcedure
        .input(z.object({
            address: z.string().min(5),
            radius: z.number().int().positive().max(20000).default(3000),
        }))
        .mutation(async ({ input }) => {
            const items = await getNearestPlacesByAddress(input.address, input.radius);
            return { address: input.address, radius: input.radius, items };
        }),

    getDistance: publicProcedure
        .input(z.object({
            from: z.string().min(5),
            to: z.string().min(5),
        }))
        .mutation(async ({ input }) => {
            const distanceKm = await getDistanceByAddresses(input.from, input.to);
            return { from: input.from, to: input.to, distanceKm };
        }),
});
