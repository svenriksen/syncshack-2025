import Link from "next/link";
import { Button } from "./_components/button";
import { GardenPreview } from "./_components/garden-preview";
import { DEFAULT_COLS, DEFAULT_ROWS } from "./_components/garden-config";
import { api } from "@/trpc/server";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth";

export default async function Home() {
  // TODO: fetch actual data via TRPC once backend exists
  
  const session = await auth();
  if (!session) {
    return redirect("/auth");
  }

  const streak = 0;
  const multiplier = 0;
  const { coins } = await api.coin.getBalance();
  
  // Fetch leaderboard data
  const leaderboardData = await api.leaderboard.getWeeklyLeaderboard();
  const userRank = await api.leaderboard.getUserRank();
  
  // Get top 5 players
  const topPlayers = leaderboardData.leaderboard.slice(0, 5);
  
  // Get today's trips
  const todayTrips = await api.trip.getTodayTrips();

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
          <div className="mt-1 text-3xl font-semibold">
            {todayTrips.length > 0 ? `${todayTrips.length} trip${todayTrips.length === 1 ? '' : 's'}` : 'No trips yet'}
          </div>
          <div className="mt-2 text-sm text-[rgb(var(--color-foreground))/0.6]">
            {todayTrips.length > 0 
              ? `${todayTrips.filter(t => t.valid).length} valid trip${todayTrips.filter(t => t.valid).length === 1 ? '' : 's'}`
              : 'Keep this tab open for best accuracy.'
            }
          </div>
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
          
          {topPlayers.length === 0 ? (
            <div className="text-center py-8 text-[rgb(var(--color-foreground))/0.6]">
              <p>No players yet this week</p>
              <p className="text-sm mt-1">Complete trips to earn coins!</p>
            </div>
          ) : (
            <>
              <ul className="space-y-2 text-sm text-[rgb(var(--color-foreground))/0.85]">
                {topPlayers.map((player) => (
                  <li key={player.userId} className="flex items-center justify-between rounded-md bg-[rgb(var(--color-foreground))/0.06] px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-yellow-500">
                        {player.rank === 1 ? "🥇" : player.rank === 2 ? "🥈" : player.rank === 3 ? "🥉" : `#${player.rank}`}
                      </span>
                      <span className="flex items-center gap-2">
                        {player.userImage && (
                          <img 
                            src={player.userImage} 
                            alt={player.userName}
                            className="w-4 h-4 rounded-full"
                          />
                        )}
                        <span className={player.rank <= 3 ? 'font-semibold' : ''}>
                          {player.userName}
                        </span>
                      </span>
                    </div>
                    <span className="font-medium">{player.coins} coins</span>
                  </li>
                ))}
              </ul>
              
              {userRank && userRank.rank && (
                <div className="mt-4 pt-3 border-t border-[rgb(var(--color-foreground))/0.1]">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[rgb(var(--color-primary))]">#{userRank.rank}</span>
                      <span className="text-[rgb(var(--color-primary))]">Your Rank</span>
                    </div>
                    <span className="font-medium text-[rgb(var(--color-primary))]">{userRank.coins} coins</span>
                  </div>
                  <div className="text-xs text-[rgb(var(--color-foreground))/0.6] mt-1">
                    {userRank.totalPlayers} total players this week
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
