import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { env } from "@/env";
import OpenAI from "openai";

export const chatRouter = createTRPCRouter({
  sendMessage: publicProcedure
    .input(
      z.object({
        message: z.string().min(1, "Message cannot be empty"),
      }),
    )
    .mutation(async ({ input }) => {
      if (!env.OPENAI_API_KEY) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "OPENAI_API_KEY is not set on the server",
        });
      }

      const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

      const completion = await client.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.3,
        max_tokens: 500,
        messages: [
          {
            role: "system",
            content:
              "You are a helpful assistant embedded in the SyncShack app. Be concise and friendly.",
          },
          { role: "user", content: input.message },
        ],
      });

      const reply = completion.choices?.[0]?.message?.content ?? "";
      return { reply } as const;
    }),
});


