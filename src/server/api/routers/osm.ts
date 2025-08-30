import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import {mapboxHiddenGems, geocodeMapbox, getNearestPlacesByAddress, getDistanceByAddresses} from "@/server/osm";

const SearchInput = z.object({
    q: z.string().min(1).max(100),
    limit: z.number().int().min(1).max(10).default(5),
    // center to bias results (lng,lat)
    proximity: z.tuple([z.number().gte(-180).lte(180), z.number().gte(-90).lte(90)]).optional(),
    // ISO 3166-1 alpha-2 country codes e.g., ["AU"]
    country: z.array(z.string().length(2)).optional(),
    // Mapbox place types to filter (keeps response snappy)
    types: z.array(z.enum([
        "poi","poi.landmark",
        "place","locality","neighborhood",
        "address","postcode","region","district","country"
    ])).optional(),
    language: z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/).optional(), // e.g. "en" or "en-AU"
});

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

    search: publicProcedure
        .input(SearchInput)
        .mutation(async ({ input }) => {
            const token = process.env.MAP_BOX;
            if (!token) throw new Error("Missing MAPBOX_TOKEN");

            const url = new URL(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(input.q)}.json`);
            url.searchParams.set("autocomplete", "true");
            url.searchParams.set("limit", String(input.limit));
            url.searchParams.set("access_token", token);

            if (input.proximity) url.searchParams.set("proximity", `${input.proximity[0]},${input.proximity[1]}`);
            if (input.country?.length) url.searchParams.set("country", input.country.join(","));
            if (input.types?.length) url.searchParams.set("types", input.types.join(","));
            if (input.language) url.searchParams.set("language", input.language);

            // Tip: bias to AU if most users are in Sydney
            // url.searchParams.set("country", "AU");

            const res = await fetch(url.toString(), { cache: "no-store" });
            if (!res.ok) {
                const text = await res.text();
                throw new Error(`Mapbox error ${res.status}: ${text}`);
            }
            const data = await res.json() as {
                features: Array<{
                    id: string;
                    place_name: string;
                    text: string;
                    center: [number, number]; // [lng, lat]
                    place_type: string[];
                    properties?: Record<string, unknown>;
                    context?: Array<{ id: string; text: string }>;
                }>;
            };

            // Normalize to a lightweight shape your UI can use
            return data.features.map(f => ({
                id: f.id,
                name: f.place_name,     // full display label
                short: f.text,          // short label
                lat: f.center[1],
                lng: f.center[0],
                types: f.place_type,    // e.g., ["poi"], ["place"]
                context: f.context ?? [], // hierarchies (suburb, region, country)
            }));
        }),
});
