import Link from "next/link";

export default function LeaderboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Weekly Leaderboard</h1>
        <Link href="/" className="text-sm text-[rgb(var(--color-primary))] hover:underline">Back</Link>
      </div>

      <div className="card p-4 space-y-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between rounded-md bg-white/5 px-3 py-2">
            <div className="flex items-center gap-3">
              <div className="h-6 w-6 rounded-full bg-white/10 text-center text-xs leading-6">{i+1}</div>
              <div>Player {i + 1}</div>
            </div>
            <div className="font-medium">0</div>
          </div>
        ))}
      </div>
      <div className="text-sm text-white/60">Week: Mon–Sun (AEST)</div>
    </div>
  );
}
