"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "../_components/button";

export default function TripPage() {
  const [isTracking, setIsTracking] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Start a Trip</h1>
        <Link href="/" className="text-sm text-[rgb(var(--color-primary))] hover:underline">Back</Link>
      </div>

      <div className="card p-4">
        <label className="text-sm text-white/70">Choose destination</label>
        <input
          className="mt-2 w-full rounded-[var(--radius-sm)] border border-white/10 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-white/40 focus:border-[rgb(var(--color-primary))]"
          placeholder="e.g. Library, Gym, Supermarket"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="card p-4 md:col-span-2">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white/80">Live Map</h2>
            <span className="text-xs text-white/50">Polyline preview</span>
          </div>
          <div className="h-72 w-full rounded-[var(--radius-sm)] bg-white/5" />
        </div>
        <div className="card p-4 flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-xs text-white/60">Time</div>
              <div className="text-xl font-semibold">00:00</div>
            </div>
            <div>
              <div className="text-xs text-white/60">Distance</div>
              <div className="text-xl font-semibold">0.00 km</div>
            </div>
            <div>
              <div className="text-xs text-white/60">Speed</div>
              <div className="text-xl font-semibold">0 km/h</div>
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
