/**
 * Stock Analysis & Prediction Lab — ChatGPT-style query interface.
 * Chat feed: user message + assistant (prediction card or error). Previous searches shown.
 */
import { useCallback, useState, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import { env } from "@pi/env/web";
import {
  buildAnalysisPrompt,
  getStockPrediction,
  getGeneralResponse,
  derivePriceDataFromOhlc,
  mapNewsToNewsData,
} from "@/lib/stockAnalysis";
import type { StockPrediction, StockPredictionError } from "@/types/stock";
import { AnalysisInput, parseTickersFromInput } from "@/components/AnalysisInput";
import { PredictionCard } from "@/components/PredictionCard";
import { cn } from "@pi/ui/lib/utils";

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

/** One entry in the chat feed. */
type ChatEntry =
  | { id: string; type: "user"; content: string; ticker: string }
  | {
      id: string;
      type: "assistant";
      prediction: StockPrediction;
      companyName: string | null;
      analyzedAt: string;
      userMessage: string;
    }
  | { id: string; type: "assistantText"; text: string; userMessage: string }
  | { id: string; type: "error"; message: string; userMessage: string }
  | { id: string; type: "loading"; userMessage: string; tickers: string[] };

function formatAnalyzedAt(): string {
  return new Date().toLocaleString(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function nextId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const MAX_PREVIOUS_SEARCHES = 10;

export default function Lab() {
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [state, setState] = useState<LabState>("idle");
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const replaceLoadingWith = useCallback(
    (loadingId: string, entry: Extract<ChatEntry, { type: "assistant" } | { type: "assistantText" } | { type: "error" }>) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === loadingId ? { ...entry, id: m.id } : m))
      );
      setState(entry.type === "error" ? "error" : "success");
    },
    []
  );

  const runSingleAnalysis = useCallback(
    async (ticker: string, userMessage: string, loadingId: string) => {
      const apiKey = env.VITE_GEMINI_API_KEY?.trim();
      if (!apiKey) {
        replaceLoadingWith(loadingId, {
          id: loadingId,
          type: "error",
          message: "Gemini API key is not set. Add VITE_GEMINI_API_KEY to your .env.",
          userMessage,
        });
        return;
      }

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
        const companyName = row?.name ?? null;

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

        const prediction = await getStockPrediction(apiKey, symbol, promptPayload);

        if ("error" in prediction && prediction.error) {
          replaceLoadingWith(loadingId, {
            id: loadingId,
            type: "error",
            message: (prediction as StockPredictionError).message,
            userMessage,
          });
          return;
        }

        replaceLoadingWith(loadingId, {
          id: loadingId,
          type: "assistant",
          prediction: prediction as StockPrediction,
          companyName,
          analyzedAt: formatAnalyzedAt(),
          userMessage,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Analysis failed.";
        replaceLoadingWith(loadingId, {
          id: loadingId,
          type: "error",
          message,
          userMessage,
        });
      }
    },
    [queryClient, replaceLoadingWith]
  );

  const handleGeneralQuestion = useCallback(
    async (userMessage: string, loadingId: string) => {
      const apiKey = env.VITE_GEMINI_API_KEY?.trim();
      if (!apiKey) {
        replaceLoadingWith(loadingId, {
          id: loadingId,
          type: "error",
          message: "Gemini API key is not set. Add VITE_GEMINI_API_KEY to your .env.",
          userMessage,
        });
        return;
      }

      try {
        const [marketResult, symbolsResult] = await Promise.all([
          queryClient.fetchQuery(trpc.getMarketData.queryOptions()),
          queryClient.fetchQuery(trpc.getAvailableSymbols.queryOptions()),
        ]);

        const marketRows = marketResult?.ok ? marketResult.rows : [];
        const symbols = symbolsResult?.ok ? symbolsResult.symbols : [];
        const topList =
          marketRows.length > 0
            ? marketRows
                .slice(0, 50)
                .map((r) => `${r.symbol} (${r.name}) - $${r.priceStr}`)
                .join("\n")
            : symbols.length > 0
              ? "Available symbols: " + symbols.join(", ")
              : "No market data available yet.";
        const context = `Stocks we track (symbol, name, price):\n${topList}`;

        const response = await getGeneralResponse(apiKey, userMessage, context);

        if ("error" in response && response.error) {
          replaceLoadingWith(loadingId, {
            id: loadingId,
            type: "error",
            message: response.message,
            userMessage,
          });
          return;
        }

        if ("text" in response) {
          replaceLoadingWith(loadingId, {
            id: loadingId,
            type: "assistantText",
            text: response.text,
            userMessage,
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Something went wrong.";
        replaceLoadingWith(loadingId, {
          id: loadingId,
          type: "error",
          message,
          userMessage,
        });
      }
    },
    [queryClient, replaceLoadingWith]
  );

  const handleCompare = useCallback(
    async (tickers: string[], userMessage: string, loadingId: string) => {
      const apiKey = env.VITE_GEMINI_API_KEY?.trim();
      if (!apiKey) {
        replaceLoadingWith(loadingId, {
          id: loadingId,
          type: "error",
          message: "Gemini API key is not set.",
          userMessage,
        });
        return;
      }

      try {
        const marketResult = await queryClient.fetchQuery(trpc.getMarketData.queryOptions());
        const marketRows = marketResult?.ok ? marketResult.rows : [];

        const parts: string[] = [];
        for (const ticker of tickers.slice(0, 5)) {
          const symbol = ticker.toUpperCase().replace(/[^A-Z0-9\-.]/g, "");
          const [historyResult, newsResult] = await Promise.all([
            queryClient.fetchQuery(trpc.getStockHistory.queryOptions({ symbol })),
            queryClient.fetchQuery(trpc.getStockNews.queryOptions({ symbol })),
          ]);
          const ohlc = historyResult?.ok ? historyResult.data : [];
          const newsItems = newsResult?.ok ? newsResult.items : [];
          const row = marketRows.find((r) => r.symbol.toUpperCase() === symbol);

          const priceData = derivePriceDataFromOhlc(symbol, ohlc, {
            currentPrice: row?.price,
            changePercent: row?.changePercent,
          });
          const newsData = mapNewsToNewsData(symbol, newsItems);
          const promptBlock = buildAnalysisPrompt(
            symbol,
            priceData,
            null,
            newsData
          );
          parts.push(`--- ${symbol} ---\n${promptBlock}`);
        }

        const context = parts.join("\n\n");
        const response = await getGeneralResponse(
          apiKey,
          `Compare these stocks and answer the user's question:\n\n${userMessage}`,
          context
        );

        if ("error" in response && response.error) {
          replaceLoadingWith(loadingId, {
            id: loadingId,
            type: "error",
            message: response.message,
            userMessage,
          });
          return;
        }

        if ("text" in response) {
          replaceLoadingWith(loadingId, {
            id: loadingId,
            type: "assistantText",
            text: response.text,
            userMessage,
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Comparison failed.";
        replaceLoadingWith(loadingId, {
          id: loadingId,
          type: "error",
          message,
          userMessage,
        });
      }
    },
    [queryClient, replaceLoadingWith]
  );

  const submitMessage = useCallback(
    (userMessage: string) => {
      const tickers = parseTickersFromInput(userMessage);
      const ticker = tickers.length > 0 ? tickers[tickers.length - 1]! : "";

      const userEntry: ChatEntry = {
        id: nextId(),
        type: "user",
        content: userMessage,
        ticker: ticker || "?",
      };
      const loadingId = nextId();
      const loadingEntry: ChatEntry = {
        id: loadingId,
        type: "loading",
        userMessage,
        tickers,
      };
      setMessages((prev) => [...prev, userEntry, loadingEntry]);
      setState("loading");

      if (tickers.length === 0) {
        handleGeneralQuestion(userMessage, loadingId);
      } else if (tickers.length === 1) {
        runSingleAnalysis(tickers[0]!, userMessage, loadingId);
      } else {
        handleCompare(tickers, userMessage, loadingId);
      }
    },
    [handleGeneralQuestion, runSingleAnalysis, handleCompare]
  );

  const onAnalyzeAnother = useCallback(() => setState("idle"), []);

  const userEntries = messages.filter(
    (m): m is Extract<ChatEntry, { type: "user" }> => m.type === "user"
  );
  const seen = new Set<string>();
  const previousTickers: { ticker: string; content: string }[] = [];
  for (let i = userEntries.length - 1; i >= 0 && previousTickers.length < MAX_PREVIOUS_SEARCHES; i--) {
    const m = userEntries[i]!;
    const key = m.ticker.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    previousTickers.push({ ticker: m.ticker, content: m.content });
  }

  const isLoading = state === "loading";
  const hasMessages = messages.length > 0;

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col">
      <div className="w-full max-w-4xl mx-auto px-4 py-6 flex flex-col flex-1 min-h-0">
        <h1 className="mb-2 text-2xl font-semibold text-center">
          Chatroom & Prediction Lab
        </h1>
        <p className="text-muted-foreground text-center">
          Ask about a stock to get an AI-powered analysis and prediction.
        </p>
        <div
          ref={feedRef}
          className={cn(
            "flex-1 overflow-y-auto space-y-4 w-full py-4 min-h-0",
            !hasMessages && "flex items-center justify-center"
          )}
        >
          {!hasMessages && (
            <p className="text-sm text-muted-foreground text-center">
              Ask anything: &quot;Analyze AAPL&quot;, &quot;List stocks&quot;, &quot;Tips?&quot;, &quot;Compare AAPL and MSFT&quot;
            </p>
          )}
          {messages.map((entry) => {
            if (entry.type === "user") {
              return (
                <div
                  key={entry.id}
                  className="flex justify-end"
                >
                  <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-primary-foreground text-sm shadow-sm">
                    {entry.content}
                  </div>
                </div>
              );
            }
            if (entry.type === "loading") {
              const label =
                entry.tickers.length === 0
                  ? "Thinking…"
                  : entry.tickers.length === 1
                    ? `Analyzing ${entry.tickers[0]}…`
                    : `Comparing ${entry.tickers.join(", ")}…`;
              return (
                <div key={entry.id} className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-2xl rounded-bl-md bg-muted px-4 py-3 text-sm text-muted-foreground">
                    <span className="flex gap-1">
                      <span className="h-2 w-2 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-current" />
                    </span>
                    {label}
                  </div>
                </div>
              );
            }
            if (entry.type === "assistantText") {
              return (
                <div key={entry.id} className="flex justify-start">
                  <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-muted px-4 py-3 text-sm text-foreground shadow-sm whitespace-pre-wrap">
                    {entry.text}
                  </div>
                </div>
              );
            }
            if (entry.type === "error") {
              return (
                <div key={entry.id} className="flex justify-start">
                  <div className="max-w-[85%] rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {entry.message}
                  </div>
                </div>
              );
            }
            return (
              <div key={entry.id} className="flex justify-start w-full">
                <div className="w-full max-w-2xl">
                  <PredictionCard
                    prediction={entry.prediction}
                    companyName={entry.companyName ?? undefined}
                    analyzedAt={entry.analyzedAt}
                    onAnalyzeAnother={onAnalyzeAnother}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {previousTickers.length > 0 && (
          <div className="w-full py-2">
            <p className="text-xs text-muted-foreground mb-2">Previous searches</p>
            <div className="flex flex-wrap gap-2">
              {previousTickers.map(({ ticker, content }, idx) => (
                <button
                  key={`prev-${ticker}-${idx}`}
                  type="button"
                  onClick={() => submitMessage(content)}
                  disabled={isLoading}
                  className="rounded-full border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors disabled:opacity-50"
                >
                  {content.length > 20 ? `${content.slice(0, 18)}…` : content}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="w-full pt-2">
          <AnalysisInput
            onSubmit={submitMessage}
            disabled={isLoading}
          />
        </div>
      </div>
    </div>
  );
}
