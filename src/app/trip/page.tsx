"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "../_components/button";
import { MapBox } from "../_components/map-box";

export default function TripPage() {
  const [isTracking, setIsTracking] = useState(false);
  const [distance, setDistance] = useState(0);
  const [duration, setDuration] = useState(0);

  const handleRouteUpdate = (newDistance: number, newDuration: number) => {
    setDistance(newDistance);
    setDuration(newDuration);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Start a Trip</h1>
        <Link href="/" className="text-sm text-[rgb(var(--color-primary))] hover:underline">Back</Link>
      </div>

      <div className="card p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white/80">Live Map</h2>
            <span className="text-xs text-white/50">Choose your destination</span>
          </div>
          <div className="h-[70vh] md:h-[70vh] w-full">
            <MapBox onRouteUpdate={handleRouteUpdate} />
          </div>
      </div>
    </div>
  );
}