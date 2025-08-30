export type GeoPoint = { lat: number; lng: number };

// reuse your existing haversine if you like
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
    const R = 6371; // Earth radius in km
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const s1 = Math.sin(dLat / 2) ** 2;
    const s2 = Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s1 + s2));
}

const MAPBOX_TOKEN = process.env.MAP_BOX!;
if (!MAPBOX_TOKEN) console.warn("⚠ MAPBOX_ACCESS_TOKEN missing");

export async function geocodeMapbox(address: string): Promise<GeoPoint | null> {
    const url = new URL(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json`
    );
    url.searchParams.set("access_token", MAPBOX_TOKEN);
    url.searchParams.set("limit", "1");
    url.searchParams.set("types", ["address","place","locality","poi","region"].join(","));
    url.searchParams.set("language", "en");
    // url.searchParams.set("country", "AU"); // optional bias

    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) return null;

    const data = (await res.json()) as { features: Array<{ center: [number, number] }> };
    const f = data.features?.[0];
    if (!f) return null;

    const [lng, lat] = f.center;
    return { lat, lng };
}

export async function getNearestPlacesByAddress(address: string, radiusMeters = 3000) {
    const point = await geocodeMapbox(address);
    if (!point) return [];
    return mapboxHiddenGems(point, radiusMeters);
}

export async function mapboxHiddenGems(origin: GeoPoint, radiusMeters = 3000) {
    const categories = ["park", "garden", "museum", "library", "viewpoint", "artwork"];

    // NOTE: empty search term + categories param
    const url = new URL(`https://api.mapbox.com/geocoding/v5/mapbox.places/.json`);
    url.searchParams.set("access_token", MAPBOX_TOKEN);
    url.searchParams.set("types", "poi");
    url.searchParams.set("limit", "50");                  // grab more, we’ll filter by radius
    url.searchParams.set("language", "en");
    url.searchParams.set("categories", categories.join(",")); // <-- correct way
    url.searchParams.set("country", "AU");                    // helpful bias
    // optionally constrain to greater Sydney to avoid random NSW hits
    url.searchParams.set("bbox", `150.50,-34.20,151.40,-33.40`);
    url.searchParams.set("proximity", `${origin.lng},${origin.lat}`);

    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) return [];

    type Feature = {
        id: string;
        text?: string;
        place_name?: string;
        center?: [number, number];
        relevance?: number;
        properties?: { category?: string };
    };
    const data = (await res.json()) as { features: Feature[] };

    const items = (data.features ?? [])
        .filter(f => Array.isArray(f.center) && f.center!.length === 2)
        .map(f => {
            const [lng, lat] = f.center!;
            return {
                providerId: `mapbox-${f.id}`,
                name: f.text || "Place",
                address: f.place_name || "",
                lat, lng,
                category: f.properties?.category,
            };
        })
        .map(p => ({ ...p, distanceKm: haversineKm(origin, { lat: p.lat, lng: p.lng }) }))
        .filter(p => p.distanceKm * 1000 <= radiusMeters)
        .sort((a, b) => a.distanceKm - b.distanceKm)
        .slice(0, 10);

    return items;
}
export async function getDistanceByAddresses(from: string, to: string) {
    const p1 = await geocodeMapbox(from);
    const p2 = await geocodeMapbox(to);
    if (!p1 || !p2) return null;
    return haversineKm(p1, p2);
}
