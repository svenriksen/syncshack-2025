import { homeRouter } from "@/server/api/routers/home";
import { coinRouter } from "@/server/api/routers/coin";
import { streakRouter } from "@/server/api/routers/streak";
import { profileRouter } from "@/server/api/routers/profile";
import { leaderboardRouter } from "@/server/api/routers/leaderboard";
import { tripRouter } from "@/server/api/routers/trip";
import { chatRouter } from "@/server/api/routers/chat";
import { createCallerFactory, createTRPCRouter } from "@/server/api/trpc";
import {osmRouter} from "@/server/api/routers/osm";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  home: homeRouter,
  coin: coinRouter,
  streak: streakRouter,
  profile: profileRouter,
  leaderboard: leaderboardRouter,
  trip: tripRouter,
  osm: osmRouter
  ,chat: chatRouter
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
