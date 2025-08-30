import { db } from "@/server/db";

// Helper function to get the start of the current week (Monday)
export function getWeekStartDate(date: Date = new Date()): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Update user's weekly leaderboard entry
export async function updateWeeklyLeaderboard(userId: string, coins: number) {
  const weekStart = getWeekStartDate();
  
  await db.leaderboardWeek.upsert({
    where: {
      weekStartDate_userId: {
        weekStartDate: weekStart,
        userId,
      },
    },
    create: {
      weekStartDate: weekStart,
      userId,
      coins,
    },
    update: {
      coins: {
        increment: coins,
      },
    },
  });
}
