// src/server/osm.ts
// Utilities for free OpenStreetMap (Nominatim + Overpass)

export type GeoPoint = { lat: number; lng: number };

// Use a polite User-Agent per OSM rules
const UA =
    process.env.OSM_USER_AGENT

/**
 * Geocode an address → { lat, lng }
 * Uses Nominatim (free, no key required)
 */
//Convert a human-readable address (e.g. "Sydney Opera House") into { lat, lng } coordinates
export async function geocodeNominatim(
    address: string
): Promise<GeoPoint | null> {
    console.log("Geocoding address:", address);
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", address);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "1");
    url.searchParams.set("addressdetails", "0");

    const res = await fetch(url.toString(), {
        headers: { "User-Agent": UA },
        cache: "no-store",
    });
    if (!res.ok) return null;

    const arr = (await res.json()) as Array<{ lat: string; lon: string }>;
    const first = arr[0];
    return first
        ? { lat: parseFloat(first.lat), lng: parseFloat(first.lon) }
        : null;
}

/**
 * Compute haversine distance (km) between two coords
 */
export function haversineKm(a: GeoPoint, b: GeoPoint) {
    const R = 6371;
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLng = ((b.lng - a.lng) * Math.PI) / 180;
    const s1 = Math.sin(dLat / 2) ** 2;
    const s2 =
        Math.cos((a.lat * Math.PI) / 180) *
        Math.cos((b.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s1 + s2));
}

/**
 * Query Overpass for nearby "hidden gems"
 * Parks, gardens, museums, libraries, viewpoints, artworks
 */
export async function overpassHiddenGems(
    origin: GeoPoint,
    radiusMeters = 3000
) {
    const query = `
    [out:json][timeout:25];
    (
      node["leisure"="park"](around:${radiusMeters},${origin.lat},${origin.lng});
      way ["leisure"="park"](around:${radiusMeters},${origin.lat},${origin.lng});
      relation["leisure"="park"](around:${radiusMeters},${origin.lat},${origin.lng});

      node["leisure"="garden"](around:${radiusMeters},${origin.lat},${origin.lng});
      way ["leisure"="garden"](around:${radiusMeters},${origin.lat},${origin.lng});

      node["tourism"="museum"](around:${radiusMeters},${origin.lat},${origin.lng});
      way ["tourism"="museum"](around:${radiusMeters},${origin.lat},${origin.lng});

      node["tourism"="viewpoint"](around:${radiusMeters},${origin.lat},${origin.lng});
      node["amenity"="library"](around:${radiusMeters},${origin.lat},${origin.lng});
      node["tourism"="artwork"](around:${radiusMeters},${origin.lat},${origin.lng});
    );
    out center tags;
  `.trim();

    const res = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "User-Agent": UA,
        },
        body: new URLSearchParams({ data: query }).toString(),
        cache: "no-store",
    });
    if (!res.ok) return [];

    type El = {
        id: number;
        type: "node" | "way" | "relation";
        lat?: number;
        lon?: number;
        center?: { lat: number; lon: number };
        tags?: Record<string, string>;
    };
    const data = (await res.json()) as { elements: El[] };

    const items = (data.elements ?? [])
        .map((e) => {
            const lat = e.lat ?? e.center?.lat;
            const lng = e.lon ?? e.center?.lon;
            if (!lat || !lng) return null;
            const tags = e.tags ?? {};
            const name = tags.name || tags["name:en"] || inferLabel(tags);
            const addr =
                tags["addr:full"] ||
                [tags["addr:housenumber"], tags["addr:street"], tags["addr:city"]]
                    .filter(Boolean)
                    .join(" ") ||
                tags.description ||
                "";
            return {
                providerId: `osm-${e.type}-${e.id}`,
                name,
                address: addr,
                lat,
                lng,
            };
        })
        .filter(Boolean) as Array<{
        providerId: string;
        name: string;
        address: string;
        lat: number;
        lng: number;
    }>;

    return items
        .map((p) => ({
            ...p,
            distanceKm: haversineKm(origin, { lat: p.lat, lng: p.lng }),
        }))
        .sort((a, b) => a.distanceKm - b.distanceKm)
        .slice(0, 10);
}

function inferLabel(tags: Record<string, string>) {
    if (tags["leisure"] === "park") return "Park";
    if (tags["leisure"] === "garden") return "Garden";
    if (tags["tourism"] === "viewpoint") return "Viewpoint";
    if (tags["tourism"] === "museum") return "Museum";
    if (tags["amenity"] === "library") return "Library";
    if (tags["tourism"] === "artwork") return "Artwork";
    return "Place";
}
