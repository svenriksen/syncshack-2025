"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import MapboxDirections from "@mapbox/mapbox-gl-directions/dist/mapbox-gl-directions";
import "@mapbox/mapbox-gl-directions/dist/mapbox-gl-directions.css";

interface MapBoxProps {
  onRouteUpdate?: (distance: number, duration: number) => void;
}

export function MapBox({ onRouteUpdate }: MapBoxProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [lng, setLng] = useState(-70.9);
  const [lat, setLat] = useState(42.35);
  const [zoom, setZoom] = useState(9);

  useEffect(() => {
    if (!mapContainer.current || !process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN) return;

    // Set the access token globally for Mapbox GL
    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

    // Initialize map
    map.current = new mapboxgl.Map({
      accessToken: process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN,
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [lng, lat],
      zoom: zoom,
    });

    // Add navigation controls
    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");

    // Add directions control
    const directions = new MapboxDirections({
      accessToken: process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN,
      unit: "metric",
      profile: "mapbox/walking",
      alternatives: true,
      congestion: true,
      controls: {
        inputs: true,
        instructions: false,
      },
    });

    map.current.addControl(directions, "top-left");

    // Update coordinates when map moves
    map.current.on("move", () => {
      if (!map.current) return;
      setLng(Number(map.current.getCenter().lng.toFixed(4)));
      setLat(Number(map.current.getCenter().lat.toFixed(4)));
      setZoom(Number(map.current.getZoom().toFixed(2)));
    });

    // Listen for route updates
    if (onRouteUpdate) {
      directions.on("route", (event: any) => {
        if (event.route && event.route[0]) {
          const route = event.route[0];
          onRouteUpdate(route.distance / 1000, route.duration / 60);
        }
      });
    }

    // Get user's location and center map
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (map.current) {
          map.current.flyTo({
            center: [position.coords.longitude, position.coords.latitude],
            zoom: 14,
          });
        }
      },
      (error) => {
        console.error("Error getting location:", error);
      }
    );

    return () => {
      if (map.current) {
        map.current.remove();
      }
    };
  }, [lng, lat, zoom, onRouteUpdate]);

  return (
    <div className="relative h-full w-full rounded-[var(--radius-sm)] overflow-hidden">
      <div ref={mapContainer} className="h-full w-full" />
    </div>
  );
}
