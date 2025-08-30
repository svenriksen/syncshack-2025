import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { api } from "@/trpc/server";

export default async function ImpactPage() {
  const session = await auth();
  if (!session) redirect("/auth");

  // Fetch trip statistics
  const tripStats = await api.trip.getTripStats();
  const weeklyStats = await api.trip.getWeeklyStats();
  const todayTrips = await api.trip.getTodayTrips();
  
  // Calculate CO2 savings
  // Formula from README: CO₂ saved = distance_km × 120 g
  const totalDistanceKm = tripStats.totalDistance / 1000; // Convert meters to km
  const totalCO2Saved = totalDistanceKm * 120; // grams

  // Format CO2 values
  const formatCO2 = (grams: number) => {
    if (grams >= 1000) {
      return `${(grams / 1000).toFixed(1)} kg`;
    }
    return `${Math.round(grams)} g`;
  };

  // Get CO2 impact description
  const getCO2Impact = (grams: number) => {
    if (grams >= 5000) return "🌱 Equivalent to planting a tree!";
    if (grams >= 2000) return "🚶‍♂️ Great walking impact!";
    if (grams >= 500) return "🌿 Every step counts!";
    return "🌍 Starting your green journey!";
  };

  // Get recent trips for display
  const recentTrips = await api.trip.getUserTrips({ limit: 5, offset: 0 });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Impact</h1>
        <div className="flex items-center gap-2">
          <Link href="/impact/everyone" className="text-sm bg-[rgb(var(--color-primary))] px-3 py-1 rounded hover:opacity-80">
            Everyone's Impact
          </Link>
          <Link href="/" className="text-sm text-[rgb(var(--color-primary))] hover:underline">Back</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="card p-5">
          <div className="text-sm text-white/60">Weekly Distance</div>
          <div className="mt-1 text-3xl font-semibold">{weeklyStats.weeklyDistanceKm.toFixed(1)} km</div>
        </div>
        <div className="card p-5">
          <div className="text-sm text-white/60">Weekly CO₂ Saved</div>
          <div className="mt-1 text-3xl font-semibold">{formatCO2(weeklyStats.weeklyCO2Saved)}</div>
          <div className="mt-1 text-xs text-white/60">{getCO2Impact(weeklyStats.weeklyCO2Saved)}</div>
        </div>
        <div className="card p-5">
          <div className="text-sm text-white/60">All-time CO₂ Saved</div>
          <div className="mt-1 text-3xl font-semibold">{formatCO2(totalCO2Saved)}</div>
          <div className="mt-1 text-xs text-white/60">{getCO2Impact(totalCO2Saved)}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="card p-5">
          <h2 className="mb-3 text-lg font-semibold">Trip Statistics</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-white/60">Total Trips</span>
              <span className="font-medium">{tripStats.totalTrips}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">Valid Trips</span>
              <span className="font-medium">{tripStats.validTrips}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">Total Distance</span>
              <span className="font-medium">{totalDistanceKm.toFixed(1)} km</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">Total Duration</span>
              <span className="font-medium">{Math.round(tripStats.totalDuration / 60)} min</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">Coins Earned</span>
              <span className="font-medium">{tripStats.totalCoinsEarned}</span>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <h2 className="mb-3 text-lg font-semibold">This Week</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-white/60">Trips This Week</span>
              <span className="font-medium">{weeklyStats.totalTrips}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">Valid Trips</span>
              <span className="font-medium">{weeklyStats.validTrips}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">Distance This Week</span>
              <span className="font-medium">{weeklyStats.weeklyDistanceKm.toFixed(1)} km</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">CO₂ Saved This Week</span>
              <span className="font-medium">{formatCO2(weeklyStats.weeklyCO2Saved)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">Coins Earned This Week</span>
              <span className="font-medium">{weeklyStats.totalCoinsEarned}</span>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <h2 className="mb-3 text-lg font-semibold">Today's Activity</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-white/60">Trips Today</span>
              <span className="font-medium">{todayTrips.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">Valid Trips</span>
              <span className="font-medium">{todayTrips.filter(t => t.valid).length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">Distance Today</span>
              <span className="font-medium">
                {(todayTrips.reduce((sum, t) => sum + t.distanceM, 0) / 1000).toFixed(1)} km
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">CO₂ Saved Today</span>
              <span className="font-medium">
                {formatCO2(todayTrips.reduce((sum, t) => sum + (t.distanceM / 1000) * 120, 0))}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="mb-3 text-lg font-semibold">Recent Trips</h2>
        {recentTrips.trips.length === 0 ? (
          <div className="rounded-[var(--radius-sm)] bg-white/5 p-4 text-sm text-white/60">
            No trips yet.
          </div>
        ) : (
          <div className="space-y-2">
            {recentTrips.trips.map((trip) => (
              <div key={trip.id} className="flex items-center justify-between rounded-md bg-white/5 px-3 py-2">
                <div className="flex items-center gap-3">
                  <div className={`h-2 w-2 rounded-full ${trip.valid ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <div>
                    <div className="text-sm font-medium">
                      {new Date(trip.startedAt).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                    <div className="text-xs text-white/60 capitalize">{trip.modeGuess}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">{(trip.distanceM / 1000).toFixed(1)} km</div>
                  <div className="text-xs text-white/60">
                    {formatCO2((trip.distanceM / 1000) * 120)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
