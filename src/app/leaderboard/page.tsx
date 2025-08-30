"use client";

import Link from "next/link";
import { api } from "@/trpc/react";
import { formatDistanceToNow } from "date-fns";

export default function LeaderboardPage() {
  const { data: leaderboardData, isLoading, error, refetch } = api.leaderboard.getWeeklyLeaderboard.useQuery();
  const { data: userRank, refetch: refetchUserRank } = api.leaderboard.getUserRank.useQuery();
  const addTestData = api.leaderboard.addTestData.useMutation();
  const debugLeaderboard = api.leaderboard.debugLeaderboard.useQuery();

  const handleRefresh = () => {
    refetch();
    refetchUserRank();
  };

  const handleAddTestData = async () => {
    await addTestData.mutateAsync();
    handleRefresh();
  };

    if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Weekly Leaderboard</h1>
          <Link href="/" className="text-sm text-[rgb(var(--color-primary))] hover:underline">Back</Link>
        </div>
        <div className="card p-4 space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between rounded-md bg-white/5 px-3 py-2 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="h-6 w-6 rounded-full bg-white/10"></div>
                <div className="h-4 w-24 bg-white/10 rounded"></div>
              </div>
              <div className="h-4 w-12 bg-white/10 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Weekly Leaderboard</h1>
          <Link href="/" className="text-sm text-[rgb(var(--color-primary))] hover:underline">Back</Link>
        </div>
        <div className="card p-4">
          <p className="text-red-400">Error loading leaderboard: {error.message}</p>
        </div>
      </div>
    );
  }

  const formatWeekRange = (start: Date, end: Date) => {
    const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${startStr} – ${endStr}`;
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return rank.toString();
  };

    return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Weekly Leaderboard</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={handleAddTestData}
            className="text-sm bg-[rgb(var(--color-primary))] px-3 py-1 rounded hover:opacity-80"
            disabled={addTestData.isPending}
          >
            {addTestData.isPending ? "Adding..." : "Add Test Data"}
          </button>
          <button
            onClick={handleRefresh}
            className="text-sm bg-white/10 px-3 py-1 rounded hover:bg-white/20"
          >
            Refresh
          </button>
          <button
            onClick={() => console.log('Debug data:', debugLeaderboard.data)}
            className="text-sm bg-yellow-500/20 px-3 py-1 rounded hover:bg-yellow-500/30 text-yellow-400"
          >
            Debug
          </button>
          <Link href="/" className="text-sm text-[rgb(var(--color-primary))] hover:underline">Back</Link>
        </div>
      </div>

      {leaderboardData && (
        <>
          <div className="text-sm text-white/60">
            Week: {formatWeekRange(leaderboardData.weekStart, leaderboardData.weekEnd)}
          </div>

          {userRank && userRank.rank && (
            <div className="card p-4 bg-gradient-to-r from-[rgb(var(--color-primary))]/20 to-transparent border-[rgb(var(--color-primary))]/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-6 w-6 rounded-full bg-[rgb(var(--color-primary))] text-center text-xs leading-6 font-bold">
                    {userRank.rank}
                  </div>
                  <div className="font-medium">Your Rank</div>
                </div>
                <div className="font-medium">{userRank.coins} coins</div>
              </div>
              <div className="text-xs text-white/60 mt-1">
                {userRank.totalPlayers} total players this week
              </div>
            </div>
          )}

          <div className="card p-4 space-y-2">
            {leaderboardData.leaderboard.length === 0 ? (
              <div className="text-center py-8 text-white/60">
                <p>No players yet this week</p>
                <p className="text-sm mt-1">Complete trips to earn coins and appear on the leaderboard!</p>
              </div>
            ) : (
              leaderboardData.leaderboard.map((entry) => (
                <div 
                  key={entry.userId} 
                  className={`flex items-center justify-between rounded-md px-3 py-2 ${
                    userRank?.rank === entry.rank 
                      ? 'bg-[rgb(var(--color-primary))]/20 border border-[rgb(var(--color-primary))]/30' 
                      : 'bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`h-6 w-6 rounded-full text-center text-xs leading-6 font-bold ${
                      entry.rank <= 3 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-white/10'
                    }`}>
                      {getRankIcon(entry.rank)}
                    </div>
                    <div className="flex items-center gap-2">
                      {entry.userImage && (
                        <img 
                          src={entry.userImage} 
                          alt={entry.userName}
                          className="w-5 h-5 rounded-full"
                        />
                      )}
                      <span className={entry.rank <= 3 ? 'font-semibold' : ''}>
                        {entry.userName}
                      </span>
                    </div>
                  </div>
                  <div className="font-medium">{entry.coins} coins</div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
