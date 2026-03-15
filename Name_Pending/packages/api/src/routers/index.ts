import * as child_process from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { z } from "zod";
import { publicProcedure, router } from "../index";
import { z } from "zod";
import { generateTradeRecommendation } from "../chat/service";

export const appRouter = router({
  healthCheck: publicProcedure.query(() => {
    return "OK";
  }),

  chat: router({
    message: publicProcedure
      .input(
        z.object({
          message: z.string().min(1).max(1000),
          symbol: z.string().default("AAPL"),
        }).transform(data => ({
          ...data,
          symbol: data.symbol.toUpperCase(),
        }))
      )
      .mutation(async ({ input }) => {
        try {
          const response = await generateTradeRecommendation(
            input.message,
            input.symbol
          );

          return {
            success: true,
            response,
          };
        } catch (error) {
          console.error('Chat API error:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred',
          };
        }
      }),

    marketSnapshot: publicProcedure
      .input(z.object({ symbol: z.string().default("AAPL") }))
      .query(async ({ input }) => {
        // Placeholder for market snapshot
        return {
          symbol: input.symbol,
          currentPrice: 150.25,
          dailyChange: 2.5,
          volatility: 18.5,
          technicalSignals: {
            ema20: 148.50,
            ema50: 145.75,
            atr: 2.15,
            momentum: 1.2,
          },
        };
      }),
  }),
});
export type AppRouter = typeof appRouter;
