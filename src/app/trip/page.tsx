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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="card p-4 md:col-span-2">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white/80">Live Map</h2>
            <span className="text-xs text-white/50">Choose your destination</span>
          </div>
          <div className="h-[400px] w-full">
            <MapBox onRouteUpdate={handleRouteUpdate} />
          </div>
        </div>
        <div className="card p-4 flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-xs text-white/60">Time</div>
              <div className="text-xl font-semibold">{duration.toFixed(0)} min</div>
            </div>
            <div>
              <div className="text-xs text-white/60">Distance</div>
              <div className="text-xl font-semibold">{distance.toFixed(2)} km</div>
            </div>
            <div>
              <div className="text-xs text-white/60">Speed</div>
              <div className="text-xl font-semibold">{isTracking && duration > 0 ? ((distance / duration) * 60).toFixed(1) : "0"} km/h</div>
            </div>
          </div>
          <div className="mt-2 flex gap-2">
            {!isTracking ? (
              <Button size="lg" className="flex-1" onClick={() => setIsTracking(true)}>Start</Button>
            ) : (
              <>
                <Button variant="secondary" className="flex-1" onClick={() => setIsTracking(false)}>Pause</Button>
                <Button className="flex-1">Finish</Button>
              </>
            )}
          </div>
          <div className="text-xs text-white/50">Keep this tab open for best accuracy.</div>
        </div>
      </div>
    </div>
  );
}
