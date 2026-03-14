import { publicProcedure, router } from "../index";

export type MarketRow = {
  symbol: string;
  name: string;
  price: string;
  change?: string;
};

export type MarketScrapeResult =
  | {
      ok: true;
      source: string;
      scrapedAt: string;
      rows: MarketRow[];
    }
  | {
      ok: false;
      source: string;
      scrapedAt: string;
      error: string;
    };

export const appRouter = router({
  healthCheck: publicProcedure.query(() => {
    return "OK";
  }),
  getMarketData: publicProcedure.query(async (): Promise<MarketScrapeResult> => {
    try {
      return {
        ok: true,
        source: "",
        scrapedAt: new Date().toISOString(),
        rows: [],
      };
    } catch (err) {
      return {
        ok: false,
        source: "",
        scrapedAt: new Date().toISOString(),
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }),
});
export type AppRouter = typeof appRouter;
