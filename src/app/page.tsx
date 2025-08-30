import Link from "next/link";

import { api } from "@/trpc/server";
import { Button } from "./_components/button";

export default async function Home() {
  // TODO: fetch actual data via TRPC once backend exists
  const coins = 0;
  const streak = 0;
  const multiplier = 0;

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="card p-5">
          <div className="text-sm text-white/60">Coins</div>
          <div className="mt-1 text-3xl font-semibold">{coins}</div>
          <div className="mt-4">
            <Link href="/trip">
              <Button size="lg">Start Trip</Button>
            </Link>
          </div>
        </div>
        <div className="card p-5">
          <div className="text-sm text-white/60">Streak</div>
          <div className="mt-1 text-3xl font-semibold">{streak} days</div>
          <div className="mt-2 text-sm text-white/60">Multiplier: +{multiplier}%</div>
        </div>
        <div className="card p-5">
          <div className="text-sm text-white/60">Today</div>
          <div className="mt-1 text-3xl font-semibold">No trips yet</div>
          <div className="mt-2 text-sm text-white/60">Keep this tab open for best accuracy.</div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Garden</h2>
            <Link href="/garden" className="text-sm text-[rgb(var(--color-primary))] hover:underline">Manage</Link>
          </div>
          <div className="grid-tiles">
            {Array.from({ length: 80 }).map((_, i) => (
              <div key={i} className="tile" />
            ))}
          </div>
        </div>

        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Weekly Leaderboard</h2>
            <Link href="/leaderboard" className="text-sm text-[rgb(var(--color-primary))] hover:underline">View all</Link>
          </div>
          <ul className="space-y-2 text-sm text-white/80">
            {Array.from({ length: 5 }).map((_, i) => (
              <li key={i} className="flex items-center justify-between rounded-md bg-white/5 px-3 py-2">
                <span>Player {i + 1}</span>
                <span className="font-medium">0</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
