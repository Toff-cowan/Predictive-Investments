/**
 * Stock Analysis & Prediction Lab — ChatGPT-style query interface.
 * Data processing layer → Gemini prediction → result card.
 */
import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import { env } from "@pi/env/web";
import {
  buildAnalysisPrompt,
  getStockPrediction,
  derivePriceDataFromOhlc,
  mapNewsToNewsData,
} from "@/lib/stockAnalysis";
import type { StockPrediction, StockPredictionError } from "@/types/stock";
import { AnalysisInput } from "@/components/AnalysisInput";
import { PredictionCard } from "@/components/PredictionCard";

import type { Route } from "./+types/lab";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Chatroom & Prediction Lab | PI - Predictive Investments" },
    {
      name: "description",
      content: "AI-powered stock analysis and prediction lab",
    },
  ];
}

type LabState = "idle" | "loading" | "success" | "error";

function formatAnalyzedAt(): string {
  return new Date().toLocaleString(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default function Lab() {
  const queryClient = useQueryClient();
  const [state, setState] = useState<LabState>("idle");
  const [result, setResult] = useState<StockPrediction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentTicker, setCurrentTicker] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [analyzedAt, setAnalyzedAt] = useState<string>("");

  const runAnalysis = useCallback(
    async (ticker: string) => {
      // eslint-disable-next-line no-console
      console.log("[Lab] runAnalysis called", { ticker });
      if (!env.VITE_GEMINI_API_KEY?.trim()) {
        setError("Gemini API key is not set. Add VITE_GEMINI_API_KEY to your .env.");
        setState("error");
        // eslint-disable-next-line no-console
        console.warn("[Lab] Missing Gemini API key");
        return;
      }

      setCurrentTicker(ticker);
      setError(null);
      setResult(null);
      setState("loading");

      try {
        const symbol = ticker.toUpperCase().replace(/[^A-Z0-9\-.]/g, "");

        const [historyResult, newsResult, marketResult] = await Promise.all([
          queryClient.fetchQuery(trpc.getStockHistory.queryOptions({ symbol })),
          queryClient.fetchQuery(trpc.getStockNews.queryOptions({ symbol })),
          queryClient.fetchQuery(trpc.getMarketData.queryOptions()),
        ]);

        const ohlc = historyResult?.ok ? historyResult.data : [];
        const newsItems = newsResult?.ok ? newsResult.items : [];
        const marketRows = marketResult?.ok ? marketResult.rows : [];
        const row = marketRows.find((r) => r.symbol.toUpperCase() === symbol);
        if (row) setCompanyName(row.name);
        else setCompanyName(null);

        const priceData = derivePriceDataFromOhlc(symbol, ohlc, {
          currentPrice: row?.price,
          changePercent: row?.changePercent,
        });
        const financialsData = null;
        const newsData = mapNewsToNewsData(symbol, newsItems);

        const promptPayload = buildAnalysisPrompt(
          symbol,
          priceData,
          financialsData,
          newsData
        );

        const prediction = await getStockPrediction(
          env.VITE_GEMINI_API_KEY,
          symbol,
          promptPayload
        );

        if ("error" in prediction && prediction.error) {
          // eslint-disable-next-line no-console
          console.error("[Lab] Prediction error from Gemini", {
            ticker: symbol,
            message: (prediction as StockPredictionError).message,
          });
          setError((prediction as StockPredictionError).message);
          setState("error");
          return;
        }

        setResult(prediction as StockPrediction);
        setAnalyzedAt(formatAnalyzedAt());
        setState("success");
        // eslint-disable-next-line no-console
        console.log("[Lab] Prediction success", {
          ticker: symbol,
          prediction: (prediction as StockPrediction).prediction,
          recommendation: (prediction as StockPrediction).recommendation,
          confidence: (prediction as StockPrediction).confidence,
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Analysis failed.";
        // eslint-disable-next-line no-console
        console.error("[Lab] runAnalysis threw", { ticker, error: message });
        setError(message);
        setState("error");
      }
    },
    [queryClient]
  );

  const onAnalyzeAnother = useCallback(() => {
    setResult(null);
    setError(null);
    setCurrentTicker(null);
    setCompanyName(null);
    setState("idle");
  }, []);

  const hasResult = state === "success" && result != null;
  const isLoading = state === "loading";
  const isError = state === "error";

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col">
      <div className="container mx-auto max-w-4xl px-4 py-6">
        <h1 className="mb-2 text-2xl font-semibold">
          Chatroom & Prediction Lab
        </h1>
        <p className="text-muted-foreground">
          Ask about a stock to get an AI-powered analysis and prediction.
        </p>
      </div>

      <div
        className={
          hasResult
            ? "flex flex-1 flex-col gap-6 px-4 pb-8"
            : "flex flex-1 flex-col items-center justify-center gap-8 px-4 pb-8"
        }
      >
        {hasResult && result && (
          <div className="container mx-auto max-w-4xl w-full space-y-4">
            <PredictionCard
              prediction={result}
              companyName={companyName ?? undefined}
              analyzedAt={analyzedAt}
              onAnalyzeAnother={onAnalyzeAnother}
            />
          </div>
        )}

        {isLoading && (
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <div className="flex gap-1">
              <span className="h-2 w-2 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-current" />
            </div>
            <p className="text-sm">
              Analyzing {currentTicker ?? "…"}…
            </p>
          </div>
        )}

        {isError && error && (
          <div className="container mx-auto max-w-2xl w-full rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="container mx-auto max-w-4xl w-full pt-4">
          <AnalysisInput
            onSubmit={runAnalysis}
            disabled={isLoading}
          />
        </div>
      </div>
    </div>
  );
}
