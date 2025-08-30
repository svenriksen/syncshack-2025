"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { api } from "@/trpc/react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

export default function EveryoneImpactPage() {
  const [timeRange, setTimeRange] = useState<"all" | "week" | "month">("all");
  const [includeInvalid, setIncludeInvalid] = useState(false);
  const [showRegions, setShowRegions] = useState(true);
  const [map, setMap] = useState<mapboxgl.Map | null>(null);
  const mapContainer = useRef<HTMLDivElement>(null);

  // Test with a simple query first
  const { data: testData, isLoading: testLoading, error: testError } = api.trip.getTripStats.useQuery();
  
  const { data: heatmapData, isLoading, error } = api.trip.getAllTripsForHeatmap.useQuery();

  // Debug logging
  console.log("🔍 tRPC Debug:", { 
    isLoading, 
    error: error?.message, 
    hasData: !!heatmapData,
    dataLength: heatmapData?.trips?.length,
    timeRange,
    includeInvalid,
    fullData: heatmapData
  });
  
  console.log("🧪 Test Query Debug:", {
    testLoading,
    testError: testError?.message,
    testData
  });

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current) return;

    // Check if Mapbox token is available
    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    if (!mapboxToken || mapboxToken === "pk.eyJ1Ijoic3ZlbnJpa3NlbiIsImEiOiJjbWV5NDM3eGoxYnozMnNweXR1ZWI5Z2J6In0.example") {
      console.warn("Mapbox access token not configured. Map will not display.");
      return;
    }

    const newMap = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [-74.006, 40.7128], // Default to NYC, will be adjusted based on data
      zoom: 10,
      accessToken: mapboxToken,
    });

    newMap.on("load", () => {
      setMap(newMap);
    });

    return () => {
      newMap.remove();
    };
  }, []);

  // Update heatmap when data changes
  useEffect(() => {
    if (!map || !heatmapData?.trips) return;

    // Remove existing layers and sources
    if (map.getLayer("heatmap-layer")) map.removeLayer("heatmap-layer");
    if (map.getLayer("trip-lines")) map.removeLayer("trip-lines");
    if (map.getLayer("start-points")) map.removeLayer("start-points");
    if (map.getLayer("end-points")) map.removeLayer("end-points");
    if (map.getLayer("region-boundaries")) map.removeLayer("region-boundaries");
    if (map.getSource("heatmap-data")) map.removeSource("heatmap-data");
    if (map.getSource("trip-lines")) map.removeSource("trip-lines");
    if (map.getSource("start-points")) map.removeSource("start-points");
    if (map.getSource("end-points")) map.removeSource("end-points");
    if (map.getSource("region-boundaries")) map.removeSource("region-boundaries");

    if (heatmapData.trips.length === 0) return;

    // Calculate bounds for all trips
    const bounds = new mapboxgl.LngLatBounds();
    heatmapData.trips.forEach(trip => {
      bounds.extend(trip.startPoint);
      bounds.extend(trip.endPoint);
    });

    // Fit map to bounds
    map.fitBounds(bounds, { padding: 50 });

    // Add region boundaries if enabled
    if (showRegions) {
      // Add administrative boundaries (countries, states, counties)
      map.addSource("region-boundaries", {
        type: "vector",
        url: "mapbox://mapbox.mapbox-streets-v8",
      });

      // Add country boundaries
      map.addLayer({
        id: "region-boundaries",
        type: "line",
        source: "region-boundaries",
        "source-layer": "admin",
        paint: {
          "line-color": "rgba(255, 255, 255, 0.2)",
          "line-width": 1,
          "line-opacity": 0.5,
        },
        filter: ["==", ["get", "admin_level"], 2], // Country level
      });
    }

    // Prepare heatmap data
    const heatmapPoints = heatmapData.trips.flatMap(trip => [
      {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: trip.startPoint,
        },
        properties: {
          intensity: trip.co2Saved / 100, // Normalize intensity
          distance: trip.distance,
          mode: trip.mode,
          valid: trip.valid,
        },
      },
      {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: trip.endPoint,
        },
        properties: {
          intensity: trip.co2Saved / 100,
          distance: trip.distance,
          mode: trip.mode,
          valid: trip.valid,
        },
      },
    ]);

    // Add heatmap source and layer
    map.addSource("heatmap-data", {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: heatmapPoints,
      },
    });

    map.addLayer({
      id: "heatmap-layer",
      type: "heatmap",
      source: "heatmap-data",
      paint: {
        "heatmap-weight": [
          "interpolate",
          ["linear"],
          ["get", "intensity"],
          0, 0,
          10, 1,
        ],
        "heatmap-intensity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          0, 1,
          9, 3,
        ],
        "heatmap-color": [
          "interpolate",
          ["linear"],
          ["heatmap-density"],
          0, "rgba(0, 255, 0, 0)",
          0.2, "rgba(0, 255, 0, 0.5)",
          0.4, "rgba(255, 255, 0, 0.5)",
          0.6, "rgba(255, 165, 0, 0.5)",
          0.8, "rgba(255, 0, 0, 0.5)",
          1, "rgba(255, 0, 0, 1)",
        ],
        "heatmap-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          0, 2,
          9, 20,
        ],
        "heatmap-opacity": 0.8,
      },
    });

    // Add trip lines
    const tripLines = heatmapData.trips.map(trip => ({
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [trip.startPoint, trip.endPoint],
      },
      properties: {
        distance: trip.distance,
        co2Saved: trip.co2Saved,
        mode: trip.mode,
        valid: trip.valid,
        userName: trip.userName,
      },
    }));

    map.addSource("trip-lines", {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: tripLines,
      },
    });

    map.addLayer({
      id: "trip-lines",
      type: "line",
      source: "trip-lines",
      paint: {
        "line-color": [
          "case",
          ["==", ["get", "valid"], true],
          "rgba(0, 255, 0, 0.3)",
          "rgba(255, 0, 0, 0.3)",
        ],
        "line-width": [
          "interpolate",
          ["linear"],
          ["get", "distance"],
          0, 1,
          5000, 3,
        ],
      },
    });

    // Add start points
    const startPoints = heatmapData.trips.map(trip => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: trip.startPoint,
      },
      properties: {
        distance: trip.distance,
        co2Saved: trip.co2Saved,
        mode: trip.mode,
        valid: trip.valid,
        userName: trip.userName,
      },
    }));

    map.addSource("start-points", {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: startPoints,
      },
    });

    map.addLayer({
      id: "start-points",
      type: "circle",
      source: "start-points",
      paint: {
        "circle-radius": 4,
        "circle-color": [
          "case",
          ["==", ["get", "valid"], true],
          "rgba(0, 255, 0, 0.8)",
          "rgba(255, 0, 0, 0.8)",
        ],
        "circle-stroke-width": 1,
        "circle-stroke-color": "white",
      },
    });

    // Add end points
    const endPoints = heatmapData.trips.map(trip => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: trip.endPoint,
      },
      properties: {
        distance: trip.distance,
        co2Saved: trip.co2Saved,
        mode: trip.mode,
        valid: trip.valid,
        userName: trip.userName,
      },
    }));

    map.addSource("end-points", {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: endPoints,
      },
    });

    map.addLayer({
      id: "end-points",
      type: "circle",
      source: "end-points",
      paint: {
        "circle-radius": 6,
        "circle-color": [
          "case",
          ["==", ["get", "valid"], true],
          "rgba(0, 255, 0, 1)",
          "rgba(255, 0, 0, 1)",
        ],
        "circle-stroke-width": 2,
        "circle-stroke-color": "white",
      },
    });

    // Add popup on click
    map.on("click", "start-points", (e) => {
      if (!e.features?.[0]) return;
      
      const feature = e.features[0];
      const coords = feature.geometry.coordinates.slice();
      const properties = feature.properties;

      new mapboxgl.Popup()
        .setLngLat(coords as [number, number])
        .setHTML(`
          <div class="p-2">
            <h3 class="font-semibold">Trip Start</h3>
            <p><strong>User:</strong> ${properties?.userName}</p>
            <p><strong>Distance:</strong> ${(properties?.distance / 1000).toFixed(1)} km</p>
            <p><strong>CO₂ Saved:</strong> ${Math.round(properties?.co2Saved)} g</p>
            <p><strong>Mode:</strong> ${properties?.mode}</p>
            <p><strong>Valid:</strong> ${properties?.valid ? "✅" : "❌"}</p>
          </div>
        `)
        .addTo(map);
    });

    map.on("click", "end-points", (e) => {
      if (!e.features?.[0]) return;
      
      const feature = e.features[0];
      const coords = feature.geometry.coordinates.slice();
      const properties = feature.properties;

      new mapboxgl.Popup()
        .setLngLat(coords as [number, number])
        .setHTML(`
          <div class="p-2">
            <h3 class="font-semibold">Trip End</h3>
            <p><strong>User:</strong> ${properties?.userName}</p>
            <p><strong>Distance:</strong> ${(properties?.distance / 1000).toFixed(1)} km</p>
            <p><strong>CO₂ Saved:</strong> ${Math.round(properties?.co2Saved)} g</p>
            <p><strong>Mode:</strong> ${properties?.mode}</p>
            <p><strong>Valid:</strong> ${properties?.valid ? "✅" : "❌"}</p>
          </div>
        `)
        .addTo(map);
    });

    // Change cursor on hover
    map.on("mouseenter", "start-points", () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", "start-points", () => {
      map.getCanvas().style.cursor = "";
    });
    map.on("mouseenter", "end-points", () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", "end-points", () => {
      map.getCanvas().style.cursor = "";
    });

  }, [map, heatmapData]);

  const formatCO2 = (grams: number) => {
    if (grams >= 1000) {
      return `${(grams / 1000).toFixed(1)} kg`;
    }
    return `${Math.round(grams)} g`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Everyone's Impact</h1>
        <Link href="/impact" className="text-sm text-[rgb(var(--color-primary))] hover:underline">Back to Impact</Link>
      </div>

      {/* Controls */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label className="text-sm text-white/60">Time Range:</label>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as "all" | "week" | "month")}
              className="ml-2 px-3 py-1 bg-white/10 border border-white/20 rounded text-white"
            >
              <option value="all">All Time</option>
              <option value="week">Last Week</option>
              <option value="month">Last Month</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="includeInvalid"
              checked={includeInvalid}
              onChange={(e) => setIncludeInvalid(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="includeInvalid" className="text-sm text-white/60">
              Include Invalid Trips
            </label>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="showRegions"
              checked={showRegions}
              onChange={(e) => setShowRegions(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="showRegions" className="text-sm text-white/60">
              Show Region Boundaries
            </label>
          </div>
        </div>
      </div>

      {/* Statistics */}
      {heatmapData && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="card p-4">
            <div className="text-sm text-white/60">Total Trips</div>
            <div className="mt-1 text-2xl font-semibold">{heatmapData.stats.totalTrips}</div>
          </div>
          <div className="card p-4">
            <div className="text-sm text-white/60">Valid Trips</div>
            <div className="mt-1 text-2xl font-semibold">{heatmapData.stats.validTrips}</div>
          </div>
          <div className="card p-4">
            <div className="text-sm text-white/60">Total Distance</div>
            <div className="mt-1 text-2xl font-semibold">{(heatmapData.stats.totalDistance / 1000).toFixed(1)} km</div>
          </div>
          <div className="card p-4">
            <div className="text-sm text-white/60">Total CO₂ Saved</div>
            <div className="mt-1 text-2xl font-semibold">{formatCO2(heatmapData.stats.totalCO2Saved)}</div>
          </div>
        </div>
      )}

      {/* Map */}
      <div className="card p-4">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Trip Heatmap</h2>
          <p className="text-sm text-white/60">
            Green = Valid trips, Red = Invalid trips. Click points for details.
          </p>
        </div>
        
        <div className="h-[600px] bg-white/5 rounded flex items-center justify-center">
          <div className="text-center">
            <div className="text-white/60 mb-4">Debug Information:</div>
            <div className="text-sm text-white/40 space-y-1">
              <div>Loading: {isLoading ? "Yes" : "No"}</div>
              <div>Error: {error ? error.message : "None"}</div>
              <div>Has Data: {heatmapData ? "Yes" : "No"}</div>
              <div>Trips Length: {heatmapData?.trips?.length || 0}</div>
              <div>Test Loading: {testLoading ? "Yes" : "No"}</div>
              <div>Test Error: {testError ? testError.message : "None"}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Region Statistics */}
      {heatmapData?.regions && heatmapData.regions.length > 0 && (
        <div className="card p-4">
          <h3 className="text-lg font-semibold mb-3">Impact by Region</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {heatmapData.regions.map((region, index) => (
              <div key={region.region} className="p-3 bg-white/5 rounded">
                <h4 className="font-medium text-[rgb(var(--color-primary))]">{region.region}</h4>
                <div className="mt-2 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Trips:</span>
                    <span>{region.trips}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Valid:</span>
                    <span>{region.validTrips}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Distance:</span>
                    <span>{(region.distance / 1000).toFixed(1)} km</span>
                  </div>
                  <div className="flex justify-between">
                    <span>CO₂ Saved:</span>
                    <span>{formatCO2(region.co2Saved)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Users:</span>
                    <span>{region.uniqueUsers}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="card p-4">
        <h3 className="text-lg font-semibold mb-3">Legend</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="font-medium mb-2">Heatmap Colors</h4>
            <div className="space-y-1 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-500 rounded"></div>
                <span>Low Impact</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-yellow-500 rounded"></div>
                <span>Medium Impact</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-orange-500 rounded"></div>
                <span>High Impact</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-red-500 rounded"></div>
                <span>Very High Impact</span>
              </div>
            </div>
          </div>
          <div>
            <h4 className="font-medium mb-2">Trip Points</h4>
            <div className="space-y-1 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span>Valid Trip Start</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                <span>Valid Trip End</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <span>Invalid Trip Start</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-red-500 rounded-full"></div>
                <span>Invalid Trip End</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
