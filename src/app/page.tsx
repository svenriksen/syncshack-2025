import Link from "next/link";
import { Button } from "./_components/button";
import { GardenPreview } from "./_components/garden-preview";
import { DEFAULT_COLS, DEFAULT_ROWS } from "./_components/garden-config";
import { api } from "@/trpc/server";
import { auth } from "@/server/auth";

export default async function Home() {
  // TODO: fetch actual data via TRPC once backend exists
  
  const session = await auth();
  if (!session) {
    return (
      <div className="mx-auto max-w-3xl py-10">
        <div className="card p-6">
          <h1 className="text-2xl font-semibold">GreenStride</h1>
          <p className="mt-2 text-[rgb(var(--color-foreground))/0.8]">
            Track low-carbon trips, earn coins, and grow your virtual forest. Plant real trees by turning daily journeys into climate impact.
          </p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <Link href="/auth">
              <Button size="lg">Sign in to get started</Button>
            </Link>
            <Link href="/impact" className="sm:ml-2">
              <Button size="lg" variant="secondary">See impact</Button>
            </Link>
          </div>
        </div>

        <section className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="card p-5">
            <div className="text-sm text-[rgb(var(--color-foreground))/0.6]">1. Move</div>
            <div className="mt-1 font-medium">Walk, cycle, or take transit</div>
          </div>
          <div className="card p-5">
            <div className="text-sm text-[rgb(var(--color-foreground))/0.6]">2. Earn</div>
            <div className="mt-1 font-medium">Collect coins for distance</div>
          </div>
          <div className="card p-5">
            <div className="text-sm text-[rgb(var(--color-foreground))/0.6]">3. Grow</div>
            <div className="mt-1 font-medium">Plant and expand your garden</div>
          </div>
        </section>
      </div>
    );
  }

  const streak = 0;
  const multiplier = 0;
  const { coins } = await api.coin.getBalance();
  return (
    <div className="flex min-h-[85svh] flex-col gap-6">
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="card p-5">
          <div className="text-sm text-[rgb(var(--color-foreground))/0.6]">Coins</div>
          <div className="mt-1 text-3xl font-semibold">{coins}</div>
          <div className="mt-4">
            <Link href="/trip">
              <Button size="lg">Start Trip</Button>
            </Link>
          </div>
        </div>
        <div className="card p-5">
          <div className="text-sm text-[rgb(var(--color-foreground))/0.6]">Streak</div>
          <div className="mt-1 text-3xl font-semibold">{streak} days</div>
          <div className="mt-2 text-sm text-[rgb(var(--color-foreground))/0.6]">Multiplier: +{multiplier}%</div>
        </div>
        <div className="card p-5">
          <div className="text-sm text-[rgb(var(--color-foreground))/0.6]">Today</div>
          <div className="mt-1 text-3xl font-semibold">No trips yet</div>
          <div className="mt-2 text-sm text-[rgb(var(--color-foreground))/0.6]">Keep this tab open for best accuracy.</div>
        </div>
      </section>

      <section className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-2">
        <div className="card h-full p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Garden</h2>
            <Link href="/garden" className="text-sm text-[rgb(var(--color-primary))] hover:underline">Manage</Link>
          </div>
          <GardenPreview cols={DEFAULT_COLS} rows={DEFAULT_ROWS} />
        </div>

        <div className="card h-full p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Weekly Leaderboard</h2>
            <Link href="/leaderboard" className="text-sm text-[rgb(var(--color-primary))] hover:underline">View all</Link>
          </div>
          <ul className="space-y-2 text-sm text-[rgb(var(--color-foreground))/0.85]">
            {Array.from({ length: 5 }).map((_, i) => (
              <li key={i} className="flex items-center justify-between rounded-md bg-[rgb(var(--color-foreground))/0.06] px-3 py-2">
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
