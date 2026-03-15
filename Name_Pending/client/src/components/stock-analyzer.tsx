/**
 * Stock Prediction Analyzer for the Analytics page.
 * Analyze a stock: set symbol, time horizon, run prediction, compare actual vs predicted (mirror overlay).
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { ComposedChart, Line, XAxis, YAxis, CartesianGrid, ReferenceLine, Area, Legend, Brush, ResponsiveContainer } from "recharts";
import { trpc } from "@/utils/trpc";
import type {
  OHLC,
  PredictionPoint,
  PredictionAccuracy,
  MarketRow,
} from "@Name_Pending/api/routers/index";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/chart";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@Name_Pending/ui/components/card";
import { Input } from "@Name_Pending/ui/components/input";
import { Label } from "@Name_Pending/ui/components/label";
import { Button } from "@Name_Pending/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/select";
import { env } from "@Name_Pending/env/web";
import { Target, BarChart3, CheckCircle2, Info, Layers, TrendingUp, TrendingDown, Loader2, Download, Copy } from "lucide-react";

const FALLBACK_STOCK_OPTIONS = [
  { value: "AAPL", label: "AAPL - Apple" },
  { value: "GOOGL", label: "GOOGL - Alphabet" },
  { value: "MSFT", label: "MSFT - Microsoft" },
  { value: "NVDA", label: "NVDA - NVIDIA" },
  { value: "TSLA", label: "TSLA - Tesla" },
];

const FORECAST_OPTIONS = [
  { value: 7, label: "7 Days" },
  { value: 14, label: "14 Days" },
  { value: 30, label: "30 Days" },
  { value: 60, label: "60 Days" },
  { value: 90, label: "90 Days" },
];

const BOUND_PERCENT = 0.025;

type ComparisonRow = { date: string; predicted: number; actual: number };

function buildAnalyzeChartData(
  actual: OHLC[],
  predicted: PredictionPoint[],
  mapePercent?: number,
  comparisonRows?: ComparisonRow[]
) {
  const toDate = (d: string) => (d.split(" ")[0] ?? d).trim();
  const band = mapePercent != null ? mapePercent / 100 : BOUND_PERCENT;
  const sortedComparison =
    comparisonRows?.length ?
      [...comparisonRows].sort((a, b) => toDate(a.date).localeCompare(toDate(b.date)))
    : [];
  const comparisonByDate =
    sortedComparison.length > 0
      ? new Map(sortedComparison.map((r) => [toDate(r.date), r]))
      : null;

  const historical = actual.map((d) => {
    const date = toDate(d.date);
    const comp = comparisonByDate?.get(date);
    const pred = comp?.predicted ?? null;
    const upper = pred != null ? pred * (1 + band) : null;
    const lower = pred != null ? pred * (1 - band) : null;
    return {
      date,
      actual: d.close,
      predicted: pred as number | null,
      upperBound: upper as number | null,
      lowerBound: lower as number | null,
      actualFuture: (comp?.actual ?? null) as number | null,
    };
  });

  const firstComparisonDate = sortedComparison.length > 0 ? toDate(sortedComparison[0].date) : null;
  const lastActualDate = firstComparisonDate ?? (actual.length > 0 ? toDate(actual[actual.length - 1].date) : null);

  const actualByDate = new Map(actual.map((d) => [toDate(d.date), d.close]));
  const future = predicted.map((p) => {
    const date = toDate(p.date);
    const pred = p.predictedClose;
    const upper = pred * (1 + band);
    const lower = pred * (1 - band);
    const actualFuture = actualByDate.get(date) ?? (comparisonByDate?.get(date)?.actual ?? null);
    return {
      date,
      actual: null as number | null,
      predicted: pred,
      upperBound: upper,
      lowerBound: lower,
      actualFuture,
    };
  });

  return { combined: [...historical, ...future], lastActualDate };
}

function AnalyzeChartRecharts({
  actual,
  predicted,
  symbol,
  forecastDays,
  height = 320,
  accuracy = null,
  showConfidenceBands = true,
  showMirrorOverlay = true,
  comparisonRows = [],
}: {
  actual: OHLC[];
  predicted: PredictionPoint[];
  symbol: string;
  forecastDays: number;
  height?: number;
  accuracy?: PredictionAccuracy | null;
  showConfidenceBands?: boolean;
  showMirrorOverlay?: boolean;
  comparisonRows?: ComparisonRow[];
}) {
  const mape = accuracy?.mape;
  const { combined, lastActualDate } = useMemo(
    () => buildAnalyzeChartData(actual, predicted, mape, comparisonRows),
    [actual, predicted, mape, comparisonRows]
  );
  const hasActualFuture = combined.some((d) => d.actualFuture != null);

  const n = combined.length;
  const [zoomRange, setZoomRange] = useState<{ start: number; end: number } | null>(null);
  const lastIndex = Math.max(0, n - 1);
  const zoomStart = Math.min(Math.max(0, zoomRange?.start ?? 0), lastIndex);
  const zoomEnd = Math.min(Math.max(zoomStart, zoomRange?.end ?? lastIndex), lastIndex);
  const visibleData = useMemo(
    () => (n === 0 ? [] : combined.slice(zoomStart, zoomEnd + 1)),
    [combined, zoomStart, zoomEnd, n]
  );
  const handleBrushChange = (range: { startIndex?: number; endIndex?: number } | null) => {
    if (range == null || range.startIndex == null || range.endIndex == null) {
      setZoomRange(null);
      return;
    }
    setZoomRange({ start: range.startIndex, end: range.endIndex });
  };
  const canZoom = n > 10;
  const isZoomed = canZoom && zoomRange != null && (zoomRange.start > 0 || zoomRange.end < lastIndex);
  useEffect(() => {
    setZoomRange(null);
  }, [symbol]);

  return (
    <Card className="rounded-lg border bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="h-4 w-4" />
          {symbol} Price Analysis
        </CardTitle>
        <CardDescription className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-md border border-border bg-muted/50 px-2 py-0.5 text-xs font-medium">
            Comparison Mode
          </span>
          {accuracy != null && (
            <span className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50/50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400">
              Model learns from backtest
            </span>
          )}
          {canZoom && (
            <span className="text-muted-foreground text-xs">
              Drag the range bar below to zoom
              {isZoomed && (
                <>
                  {" · "}
                  <button
                    type="button"
                    className="underline hover:no-underline"
                    onClick={() => setZoomRange(null)}
                  >
                    Reset zoom
                  </button>
                </>
              )}
            </span>
          )}
          <span>
            Historical data with {forecastDays}-day prediction
            {showMirrorOverlay && " (Overlay on)"}
            {!showMirrorOverlay && " (Overlay off)"}
            {showConfidenceBands && " · Bands on"}
            {!showConfidenceBands && " · Bands off"}
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={{
            actual: { label: "Historical Price", color: "#3b82f6" },
            predicted: { label: "Predicted Price", color: "#f59e0b" },
            actualFuture: { label: "Actual Future", color: "#22c55e" },
            confidenceBand: { label: "Confidence Band", color: "#f59e0b" },
          }}
          className="w-full"
          style={{ height: canZoom ? height + 72 : height }}
        >
          {canZoom ? (
            <div className="flex h-full w-full flex-col">
              <div className="min-h-0 flex-1" style={{ minHeight: height }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={visibleData} margin={{ top: 12, right: 20, left: 12, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(v: string) => new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    domain={["dataMin - 10", "dataMax + 10"]}
                    tickFormatter={(v: number) => `$${Number(v).toFixed(2)}`}
                  />
                  <ChartTooltip
                    content={<ChartTooltipContent />}
                    labelFormatter={(v: string) =>
                      new Date(v).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
                    }
                    formatter={(value: unknown) => (typeof value === "number" ? `$${value.toFixed(2)}` : String(value))}
                  />
                  {lastActualDate && visibleData.some((d) => d.date === lastActualDate) && (
                    <ReferenceLine
                      x={lastActualDate}
                      stroke="#6b7280"
                      strokeDasharray="5 5"
                      label={{ value: "Forecast Start", position: "top", fill: "#6b7280", fontSize: 10 }}
                    />
                  )}
                  <Area
                    type="stepAfter"
                    dataKey="upperBound"
                    baseValue={(entry: { lowerBound?: number | null; upperBound?: number | null }) =>
                      entry?.lowerBound ?? entry?.upperBound ?? 0
                    }
                    stroke="none"
                    fill="#f59e0b"
                    fillOpacity={showConfidenceBands ? 0.18 : 0}
                    isAnimationActive={false}
                    name="Confidence Band"
                    connectNulls={false}
                  />
                  <Line
                    type="linear"
                    dataKey="actual"
                    stroke="#3b82f6"
                    strokeWidth={2.5}
                    dot={false}
                    name="Historical Price"
                    connectNulls={false}
                  />
                  <Line
                    type="linear"
                    dataKey="predicted"
                    stroke="#f59e0b"
                    strokeWidth={1.5}
                    strokeDasharray="5 5"
                    strokeOpacity={showMirrorOverlay ? 1 : 0}
                    dot={showMirrorOverlay ? { fill: "#f59e0b", r: 3 } : false}
                    name="Predicted Price"
                    connectNulls={false}
                  />
                  <Line
                    type="linear"
                    dataKey="actualFuture"
                    stroke="#22c55e"
                    strokeWidth={1.5}
                    strokeDasharray="5 5"
                    strokeOpacity={showMirrorOverlay ? 1 : 0}
                    dot={showMirrorOverlay ? { fill: "#22c55e", r: 3 } : false}
                    name="Actual Future"
                    connectNulls={false}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={40}
                    wrapperStyle={{ paddingTop: 8 }}
                    formatter={(value) => (
                      <span className="text-muted-foreground text-xs">
                        {value === "Historical Price" ? "— " : value === "Confidence Band" ? "▢ " : "—○— "}
                        {value}
                      </span>
                    )}
                  />
                </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="h-[72px] w-full shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={combined} margin={{ top: 4, right: 20, left: 12, bottom: 0 }}>
                  <XAxis dataKey="date" tickFormatter={(v: string) => new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric" })} />
                  <YAxis hide domain={["auto", "auto"]} />
                  <Line type="linear" dataKey="actual" stroke="#3b82f6" strokeWidth={1} dot={false} />
                  <Brush
                    dataKey="date"
                    height={32}
                    stroke="#f59e0b"
                    fill="transparent"
                    startIndex={zoomStart}
                    endIndex={zoomEnd}
                    onChange={handleBrushChange}
                    tickFormatter={(v: string) => new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  />
                </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
          <ComposedChart data={combined} margin={{ top: 12, right: 20, left: 12, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis
              dataKey="date"
              tickFormatter={(v: string) => new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={["dataMin - 10", "dataMax + 10"]}
              tickFormatter={(v: number) => `$${Number(v).toFixed(2)}`}
            />
            <ChartTooltip
              content={<ChartTooltipContent />}
              labelFormatter={(v: string) =>
                new Date(v).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
              }
              formatter={(value: unknown) => (typeof value === "number" ? `$${value.toFixed(2)}` : String(value))}
            />
            {lastActualDate && (
              <ReferenceLine
                x={lastActualDate}
                stroke="#6b7280"
                strokeDasharray="5 5"
                label={{ value: "Forecast Start", position: "top", fill: "#6b7280", fontSize: 10 }}
              />
            )}
            <Area
              type="stepAfter"
              dataKey="upperBound"
              baseValue={(entry: { lowerBound?: number | null; upperBound?: number | null }) =>
                entry?.lowerBound ?? entry?.upperBound ?? 0
              }
              stroke="none"
              fill="#f59e0b"
              fillOpacity={showConfidenceBands ? 0.18 : 0}
              isAnimationActive={false}
              name="Confidence Band"
              connectNulls={false}
            />
            <Line
              type="linear"
              dataKey="actual"
              stroke="#3b82f6"
              strokeWidth={2.5}
              dot={false}
              name="Historical Price"
              connectNulls={false}
            />
            <Line
              type="linear"
              dataKey="predicted"
              stroke="#f59e0b"
              strokeWidth={1.5}
              strokeDasharray="5 5"
              strokeOpacity={showMirrorOverlay ? 1 : 0}
              dot={showMirrorOverlay ? { fill: "#f59e0b", r: 3 } : false}
              name="Predicted Price"
              connectNulls={false}
            />
            <Line
              type="linear"
              dataKey="actualFuture"
              stroke="#22c55e"
              strokeWidth={1.5}
              strokeDasharray="5 5"
              strokeOpacity={showMirrorOverlay ? 1 : 0}
              dot={showMirrorOverlay ? { fill: "#22c55e", r: 3 } : false}
              name="Actual Future"
              connectNulls={false}
            />
            <Legend
              verticalAlign="bottom"
              height={40}
              wrapperStyle={{ paddingTop: 8 }}
              formatter={(value) => (
                <span className="text-muted-foreground text-xs">
                  {value === "Historical Price" ? "— " : value === "Confidence Band" ? "▢ " : "—○— "}
                  {value}
                </span>
              )}
            />
          </ComposedChart>
          )}
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

function toDateStr(d: string) {
  return (d.split(" ")[0] ?? d).trim();
}

export function StockAnalyzer() {
  const [symbolFromSelect, setSymbolFromSelect] = useState("AAPL");
  const [customSymbol, setCustomSymbol] = useState("");
  const [forecastDays, setForecastDays] = useState(14);
  const [forecastRequest, setForecastRequest] = useState<{ symbol: string; days: number } | null>(null);
  const [mirrorOverlay, setMirrorOverlay] = useState(true);
  const [confidenceBands, setConfidenceBands] = useState(true);
  const [dataTab, setDataTab] = useState<"predicted" | "comparison">("predicted");
  const [compareLoading, setCompareLoading] = useState(false);
  const queryClient = useQueryClient();
  const comparisonResultRef = useRef<HTMLDivElement>(null);

  const marketQuery = useQuery({
    ...trpc.getMarketData.queryOptions(),
  });
  const availableSymbolsQuery = useQuery({
    ...trpc.getAvailableSymbols.queryOptions(),
  });
  const marketRows: MarketRow[] = marketQuery.data?.ok ? marketQuery.data.rows : [];
  const availableSymbols: string[] = availableSymbolsQuery.data?.ok ? availableSymbolsQuery.data.symbols : [];
  const stockOptions = useMemo(() => {
    if (marketRows.length > 0) {
      return marketRows
        .map((r) => ({ value: r.symbol, label: `${r.symbol} - ${r.name}` }))
        .sort((a, b) => a.value.localeCompare(b.value));
    }
    if (availableSymbols.length > 0) {
      return availableSymbols.map((s) => ({ value: s, label: s }));
    }
    return FALLBACK_STOCK_OPTIONS;
  }, [marketRows, availableSymbols]);

  useEffect(() => {
    const values = stockOptions.map((o) => o.value);
    if (values.length > 0 && !values.includes(symbolFromSelect)) {
      setSymbolFromSelect(stockOptions[0].value);
    }
  }, [stockOptions, symbolFromSelect]);

  const normalizedSymbol = customSymbol.trim().toUpperCase() || symbolFromSelect;
  const historyQuery = useQuery({
    ...trpc.getStockHistory.queryOptions({ symbol: normalizedSymbol }),
    enabled: normalizedSymbol.length > 0,
  });
  const history: OHLC[] = historyQuery.data?.ok ? historyQuery.data.data : [];
  const historyLoading = historyQuery.isLoading;

  const predictionQuery = useQuery({
    ...trpc.getStockPrediction.queryOptions({
      symbol: forecastRequest?.symbol ?? "",
      forecastDays: forecastRequest?.days ?? 10,
    }),
    enabled: !!forecastRequest,
  });
  const apiPredictions: PredictionPoint[] = predictionQuery.data?.ok ? predictionQuery.data.predictions : [];
  const accuracy: PredictionAccuracy | null = predictionQuery.data?.ok ? predictionQuery.data.accuracy ?? null : null;
  const apiComparison =
    (predictionQuery.data?.ok && (predictionQuery.data as { comparison?: unknown[] }).comparison) ?? [];
  const apiComparisonRows = Array.isArray(apiComparison)
    ? apiComparison.filter(
        (r): r is { date: string; predictedClose: number; actualClose: number } =>
          r != null &&
          typeof (r as { date?: unknown }).date === "string" &&
          typeof (r as { predictedClose?: unknown }).predictedClose === "number" &&
          Number.isFinite((r as { predictedClose: number }).predictedClose) &&
          typeof (r as { actualClose?: unknown }).actualClose === "number" &&
          Number.isFinite((r as { actualClose: number }).actualClose)
      )
    : [];

  const csvPath = forecastRequest ? `${forecastRequest.symbol}/predicted.csv` : "";
  const predictedCsvUri = csvPath ? `${env.VITE_SERVER_URL}/api/csv?path=${encodeURIComponent(csvPath)}` : "";
  const csvQuery = useQuery({
    queryKey: ["predictedCsv", forecastRequest?.symbol, predictionQuery.dataUpdatedAt],
    queryFn: async () => {
      const res = await fetch(predictedCsvUri);
      if (!res.ok) throw new Error(res.status === 404 ? "CSV not found yet" : `Failed to load CSV: ${res.status}`);
      return res.text();
    },
    enabled: !!forecastRequest?.symbol && !!predictedCsvUri && (predictionQuery.isSuccess || predictionQuery.isError),
    retry: 3,
    retryDelay: 800,
  });
  const predictionsFromCsv: PredictionPoint[] = useMemo(() => {
    if (!csvQuery.data) return [];
    const lines = csvQuery.data.trim().split(/\r?\n/);
    if (lines.length < 2) return [];
    const rows: PredictionPoint[] = [];
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(",").map((s) => s.trim().replace(/^"|"$/g, ""));
      const date = parts[0];
      const close = parseFloat(parts[1]);
      if (date && !Number.isNaN(close)) rows.push({ date, predictedClose: close });
    }
    return rows;
  }, [csvQuery.data]);
  // Use prediction run result (API) for graph and summary; CSV only as fallback (e.g. after refresh).
  const predictions: PredictionPoint[] = apiPredictions.length > 0 ? apiPredictions : predictionsFromCsv;

  const hasPredictions = forecastRequest && !predictionQuery.isLoading && predictions.length > 0;
  const hasHistory = history.length > 0;
  const hasResults = hasPredictions && hasHistory;

  const actualByDate = useMemo(() => new Map(history.map((d) => [toDateStr(d.date), d.close])), [history]);
  const comparisonRows = useMemo(() => {
    let rows: { date: string; predicted: number; actual: number }[];
    if (apiComparisonRows.length > 0) {
      rows = apiComparisonRows.map((r) => ({
        date: r.date,
        predicted: r.predictedClose,
        actual: r.actualClose,
      }));
    } else {
      rows = predictions
        .map((p) => {
          const actual = actualByDate.get(toDateStr(p.date)) ?? null;
          return { date: p.date, predicted: p.predictedClose, actual };
        })
        .filter((r): r is { date: string; predicted: number; actual: number } => r.actual != null);
    }
    return rows.sort((a, b) => toDateStr(a.date).localeCompare(toDateStr(b.date)));
  }, [apiComparisonRows, predictions, actualByDate]);
  const { overallAccuracy, directionalAccuracy, rmse } = useMemo(() => {
    if (comparisonRows.length < 2) {
      return {
        overallAccuracy: accuracy != null && Number.isFinite(accuracy.mape) ? 100 - accuracy.mape : null,
        directionalAccuracy: null as number | null,
        rmse: null as number | null,
      };
    }
    const n = comparisonRows.length;
    const errors = comparisonRows.map((r) =>
      r.actual !== 0 && Number.isFinite(r.actual) ? (r.actual - r.predicted) / r.actual : 0
    );
    const validErrors = errors.filter((e) => Number.isFinite(e));
    const meanAbsPct = validErrors.length > 0 ? (validErrors.reduce((s, e) => s + Math.abs(e), 0) / validErrors.length) * 100 : 0;
    let directional = 0;
    for (let i = 1; i < n; i++) {
      const actDir = Math.sign(comparisonRows[i].actual - comparisonRows[i - 1].actual);
      const predDir = Math.sign(comparisonRows[i].predicted - comparisonRows[i - 1].predicted);
      if (actDir === predDir) directional++;
    }
    const sqErrors = comparisonRows.map((r) => (r.actual - r.predicted) ** 2);
    const rmseVal = Math.sqrt(sqErrors.reduce((a, b) => a + b, 0) / n);
    const overall = 100 - meanAbsPct;
    const dirPct = n > 1 ? (directional / (n - 1)) * 100 : null;
    return {
      overallAccuracy: Number.isFinite(overall) ? Math.max(0, Math.min(100, overall)) : null,
      directionalAccuracy: dirPct != null && Number.isFinite(dirPct) ? dirPct : null,
      rmse: Number.isFinite(rmseVal) ? rmseVal : null,
    };
  }, [comparisonRows, accuracy]);

  const scrapedRow = forecastRequest
    ? marketRows.find((r) => r.symbol.toUpperCase() === forecastRequest.symbol.toUpperCase())
    : null;
  const currentPrice =
    scrapedRow?.price ??
    (history.length > 0 ? history[history.length - 1].close : predictions[0]?.predictedClose ?? null);

  useEffect(() => {
    if (predictionQuery.isError) {
      console.error("[StockAnalyzer] Prediction failed:", predictionQuery.error?.message ?? predictionQuery.error);
    }
    if (predictionQuery.isSuccess && forecastRequest) {
      const ok = predictionQuery.data?.ok;
      if (!ok) {
        console.error("[StockAnalyzer] Prediction returned not ok:", (predictionQuery.data as { error?: string })?.error);
      } else if (accuracy == null) {
        console.warn("[StockAnalyzer] Prediction succeeded but accuracy is null (backtest may have been skipped).", {
          symbol: forecastRequest.symbol,
          predictionsCount: apiPredictions.length,
        });
      }
      if (ok && apiComparisonRows.length === 0) {
        const raw = (predictionQuery.data as { comparison?: unknown[] }).comparison;
        console.warn("[StockAnalyzer] No comparison rows from API.", {
          symbol: forecastRequest.symbol,
          rawComparisonLength: Array.isArray(raw) ? raw.length : 0,
          rawComparisonSample: Array.isArray(raw) ? raw[0] : raw,
        });
      }
    }
  }, [predictionQuery.isError, predictionQuery.isSuccess, predictionQuery.data, predictionQuery.error, forecastRequest, accuracy, apiPredictions.length, apiComparisonRows.length]);

  useEffect(() => {
    if (csvQuery.isError) {
      console.error("[StockAnalyzer] Predicted CSV fetch failed:", csvQuery.error?.message ?? csvQuery.error);
    }
  }, [csvQuery.isError, csvQuery.error]);

  useEffect(() => {
    if (historyQuery.isError && normalizedSymbol) {
      console.error("[StockAnalyzer] History fetch failed for", normalizedSymbol, ":", historyQuery.error?.message ?? historyQuery.error);
    }
  }, [historyQuery.isError, historyQuery.error, normalizedSymbol]);

  return (
    <div className="w-full space-y-6">
      <Card className="rounded-lg border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-5 w-5" />
            Stock Prediction Analyzer
          </CardTitle>
          <CardDescription>
            Analyze stocks from web-scraped market data, generate predictions, and compare accuracy.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="analyzer-symbol">Stock Symbol</Label>
              <Select
                value={symbolFromSelect}
                onValueChange={(v) => {
                  setSymbolFromSelect(v);
                  setCustomSymbol("");
                }}
              >
                <SelectTrigger id="analyzer-symbol" className="w-full">
                  <SelectValue placeholder="Select stock" />
                </SelectTrigger>
                <SelectContent>
                  {stockOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="analyzer-custom">Or Enter Custom</Label>
              <Input
                id="analyzer-custom"
                placeholder="e.g., META"
                value={customSymbol}
                onChange={(e) => setCustomSymbol(e.target.value.toUpperCase())}
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="analyzer-forecast">Forecast Period</Label>
              <Select value={String(forecastDays)} onValueChange={(v) => setForecastDays(Number(v))}>
                <SelectTrigger id="analyzer-forecast" className="w-full">
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  {FORECAST_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={String(o.value)}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                disabled={!normalizedSymbol || historyLoading || predictionQuery.isLoading}
                onClick={() => {
                  if (!normalizedSymbol) return;
                  console.log("[StockAnalyzer] Analyze clicked:", { symbol: normalizedSymbol, forecastDays });
                  queryClient.refetchQueries(trpc.getStockHistory.queryOptions({ symbol: normalizedSymbol }));
                  setForecastRequest({ symbol: normalizedSymbol, days: forecastDays });
                }}
                className="w-full gap-2"
              >
                {predictionQuery.isLoading ? (
                  "Analyzing…"
                ) : (
                  <>
                    <Target className="h-4 w-4" />
                    Analyze
                  </>
                )}
              </Button>
            </div>
          </div>
          {predictionQuery.isError && (
            <p className="mt-2 text-sm text-destructive">
              Error: {predictionQuery.error?.message ?? "Prediction failed."}
              {(predictionQuery.error?.message?.toLowerCase().includes("history not found") ||
                predictionQuery.error?.message?.toLowerCase().includes("not found")) && (
                <span className="block mt-1">
                  Run the market scrape first so that <code className="text-xs">{normalizedSymbol}_history.csv</code> exists in server/scripts/yahoo_top_100_output.
                </span>
              )}
              {(predictionQuery.error?.message?.toLowerCase().includes("script not found") ||
                predictionQuery.error?.message?.toLowerCase().includes("python")) && (
                <span className="block mt-1">
                  Ensure Python is installed and the server is run from the project root (or that server/scripts/predict_stock.py exists). Install pandas, numpy, and scikit-learn: <code className="text-xs">pip install pandas numpy scikit-learn</code>
                </span>
              )}
            </p>
          )}
          {!forecastRequest && normalizedSymbol && (
            <p className="mt-2 text-sm text-muted-foreground">
              Click &quot;Analyze&quot; to run the model. The chart will show actual and predicted overlaid (mirror) so you can compare accuracy.
            </p>
          )}
        </CardContent>
      </Card>

      {forecastRequest && predictionQuery.isLoading && (
        <Card className="rounded-lg border bg-card">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
            <p className="text-sm font-medium">Running prediction…</p>
            <p className="text-xs text-muted-foreground">
              Analyzing history, generating forecast, then loading results on the graph.
            </p>
          </CardContent>
        </Card>
      )}

      {hasPredictions && currentPrice != null && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Card size="sm" className="rounded-lg border bg-card p-3">
              <p className="text-xs text-muted-foreground">
                Current price {scrapedRow ? "(scraped)" : hasHistory ? "(history)" : "(from prediction)"}
              </p>
              <p className="text-lg font-bold">${currentPrice.toFixed(2)}</p>
              <span className="text-xs text-muted-foreground">{forecastRequest!.symbol}</span>
            </Card>
            <Card size="sm" className="rounded-lg border bg-card p-3">
              <p className="text-xs text-muted-foreground">Predicted price</p>
              <p className="text-lg font-bold">${predictions[predictions.length - 1].predictedClose.toFixed(2)}</p>
              {predictions[predictions.length - 1].predictedClose >= currentPrice ? (
                <TrendingUp className="mt-1 h-5 w-5 text-emerald-500" />
              ) : (
                <TrendingDown className="mt-1 h-5 w-5 text-red-500" />
              )}
            </Card>
            <Card size="sm" className="rounded-lg border bg-card p-3">
              <p className="text-xs text-muted-foreground">Expected change</p>
              <p
                className={`text-lg font-bold ${
                  ((predictions[predictions.length - 1].predictedClose - currentPrice) / currentPrice) * 100 >= 0
                    ? "text-emerald-500"
                    : "text-red-500"
                }`}
              >
                {(((predictions[predictions.length - 1].predictedClose - currentPrice) / currentPrice) * 100).toFixed(2)}%
              </p>
              <span className="text-xs text-muted-foreground">{forecastDays} days</span>
            </Card>
            <Card size="sm" className="rounded-lg border bg-card p-3">
              <p className="text-xs text-muted-foreground">Forecast period</p>
              <p className="text-lg font-bold">{forecastDays} days</p>
              <Target className="mt-1 h-5 w-5 text-muted-foreground" />
            </Card>
          </div>

          <Card className="rounded-lg border bg-card">
            <CardContent className="pt-4 pb-4">
              <div className="flex flex-wrap items-center justify-between gap-6">
                <div className="flex items-center gap-3">
                  <Layers className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <span className="text-sm font-medium block">Mirror Overlay</span>
                    <span className="text-xs text-muted-foreground">Predicted + Actual Future lines</span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={mirrorOverlay}
                    onClick={() => setMirrorOverlay(!mirrorOverlay)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                      mirrorOverlay ? "bg-primary" : "bg-muted"
                    }`}
                  >
                    <span
                      className={`pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform ${
                        mirrorOverlay ? "translate-x-5" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <div>
                    <span className="text-sm font-medium block">Confidence Bands</span>
                    <span className="text-xs text-muted-foreground">Upper/Lower bounds + shaded area</span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={confidenceBands}
                    onClick={() => setConfidenceBands(!confidenceBands)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                      confidenceBands ? "bg-primary" : "bg-muted"
                    }`}
                  >
                    <span
                      className={`pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform ${
                        confidenceBands ? "translate-x-5" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>
              </div>
              <div className="mt-4 flex justify-center">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  disabled={compareLoading}
                  onClick={() => {
                    setCompareLoading(true);
                    setMirrorOverlay(true);
                    setConfidenceBands(true);
                    setDataTab("comparison");
                    comparisonResultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                    requestAnimationFrame(() => {
                      setTimeout(() => setCompareLoading(false), 400);
                    });
                  }}
                >
                  {compareLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Target className="h-4 w-4" />
                  )}
                  Compare
                </Button>
              </div>
            </CardContent>
          </Card>

          {hasResults ? (
            <AnalyzeChartRecharts
              actual={history}
              predicted={predictions}
              symbol={forecastRequest!.symbol}
              forecastDays={forecastDays}
              height={360}
              accuracy={accuracy}
              showConfidenceBands={confidenceBands}
              showMirrorOverlay={mirrorOverlay}
              comparisonRows={comparisonRows}
            />
          ) : (
            <Card className="rounded-lg border border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
              <CardContent className="py-4">
                <p className="text-sm text-muted-foreground">
                  Chart unavailable: historical data did not load for {forecastRequest!.symbol}. Summary and predicted values below use prediction data. Ensure <code className="text-xs">server/scripts/yahoo_top_100_output/{forecastRequest!.symbol}_history.csv</code> exists (run the market scrape).
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {(accuracy != null || comparisonRows.length > 0 || (forecastRequest && !predictionQuery.isLoading && predictions.length > 0)) && (
        <div ref={comparisonResultRef}>
        <Card className="rounded-lg border border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              Prediction Accuracy Analysis
            </CardTitle>
            <CardDescription>
              Comparing predicted values against actual market data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-lg border bg-background p-3">
                <p className="text-xs text-muted-foreground">Overall Accuracy</p>
                <p className="text-xl font-bold text-emerald-600 dark:text-emerald-500">
                  {overallAccuracy != null && Number.isFinite(overallAccuracy) ? `${Math.max(0, Math.min(100, overallAccuracy)).toFixed(2)}%` : "—"}
                </p>
                {(overallAccuracy != null && overallAccuracy >= 95) && (
                  <span className="mt-1 inline-block rounded bg-foreground px-2 py-0.5 text-xs font-medium text-background">Excellent</span>
                )}
              </div>
              <div className="rounded-lg border bg-background p-3">
                <p className="text-xs text-muted-foreground">Directional Accuracy</p>
                <p className="text-xl font-bold">
                  {directionalAccuracy != null && Number.isFinite(directionalAccuracy) ? `${Math.max(0, Math.min(100, directionalAccuracy)).toFixed(1)}%` : "—"}
                </p>
                <p className="text-xs text-muted-foreground">Correct trend predictions</p>
              </div>
              <div className="rounded-lg border bg-background p-3">
                <p className="text-xs text-muted-foreground">MAPE</p>
                <p className="text-xl font-bold">
                  {accuracy != null && Number.isFinite(accuracy.mape)
                    ? `${accuracy.mape.toFixed(2)}%`
                    : overallAccuracy != null && Number.isFinite(overallAccuracy)
                      ? `${(100 - overallAccuracy).toFixed(2)}%`
                      : "—"}
                </p>
                <p className="text-xs text-muted-foreground">Mean Absolute % Error</p>
              </div>
              <div className="rounded-lg border bg-background p-3">
                <p className="text-xs text-muted-foreground">RMSE</p>
                <p className="text-xl font-bold">{rmse != null && Number.isFinite(rmse) ? `$${rmse.toFixed(2)}` : "—"}</p>
                <p className="text-xs text-muted-foreground">Root Mean Square Error</p>
              </div>
            </div>
            <div className="mb-4 rounded-lg border bg-background p-3">
              <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400">
                  <Info className="h-3.5 w-3.5" />
                </span>
                Prediction Quality Feedback
              </h4>
              {(Number.isFinite(accuracy?.mape) ? accuracy!.mape : (overallAccuracy != null && Number.isFinite(overallAccuracy) ? 100 - overallAccuracy : 99)) <= 5 ? (
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">Excellent prediction accuracy!</span> The model closely
                  mirrored actual market movements. This high accuracy suggests the model parameters are well-tuned for{" "}
                  <strong>{forecastRequest?.symbol ?? "this symbol"}</strong>. Consider using these predictions with higher confidence for future decisions.
                </p>
              ) : (Number.isFinite(accuracy?.mape) ? accuracy!.mape : 10) <= 15 ? (
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-amber-600">Good prediction accuracy.</span> The model captured general
                  trends with some deviation. Consider wider margins for risk management.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-red-600">Prediction accuracy needs improvement.</span> Significant
                  deviation from actuals. Consider shorter forecast periods or more data.
                </p>
              )}
            </div>

            {forecastRequest && predictions.length > 0 && (
              <>
                <div className="flex gap-0 rounded-full bg-muted p-0.5 w-fit mb-3">
                  <button
                    type="button"
                    onClick={() => setDataTab("predicted")}
                    className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                      dataTab === "predicted"
                        ? "bg-white text-foreground shadow-sm dark:bg-background"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Predicted Data
                  </button>
                  <button
                    type="button"
                    onClick={() => setDataTab("comparison")}
                    className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                      dataTab === "comparison"
                        ? "bg-white text-foreground shadow-sm dark:bg-background"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Comparison Data
                  </button>
                </div>
                <h4 className="text-sm font-semibold mb-2">Prediction vs Actual Comparison</h4>
                {dataTab === "predicted" && (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <p className="text-xs text-muted-foreground">
                        Generated prediction data for the next {forecastDays} days.
                        {predictionsFromCsv.length > 0 && (
                          <span className="block mt-1 text-emerald-600 dark:text-emerald-400">Data loaded from predicted CSV.</span>
                        )}
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-2 shrink-0"
                        onClick={() => {
                          const boundPct = accuracy?.mape != null && Number.isFinite(accuracy.mape) ? accuracy.mape : 2.5;
                          const band = boundPct / 100;
                          const header = "Date,Predicted_Close,Upper_Bound,Lower_Bound";
                          const rows = predictions.map((p) => {
                            const pred = p.predictedClose;
                            const upper = (pred * (1 + band)).toFixed(4);
                            const lower = (pred * (1 - band)).toFixed(4);
                            return `${p.date},${pred},${upper},${lower}`;
                          });
                          const csv = [header, ...rows].join("\n");
                          const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `${forecastRequest!.symbol}_predicted.csv`;
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                      >
                        <Download className="h-4 w-4" />
                        Download CSV
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2 flex flex-wrap items-center gap-2">
                      <span className="font-medium">Predicted CSV URI:</span>
                      <a href={predictedCsvUri} target="_blank" rel="noopener noreferrer" className="text-primary underline break-all">
                        {predictedCsvUri}
                      </a>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        className="h-6 w-6 shrink-0"
                        aria-label="Copy URI"
                        onClick={() => navigator.clipboard.writeText(predictedCsvUri)}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </p>
                    <div className="max-h-[220px] overflow-auto">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-card">
                          <tr className="border-b">
                            <th className="p-2 text-left">Date</th>
                            <th className="p-2 text-right">Predicted close</th>
                          </tr>
                        </thead>
                        <tbody>
                          {predictions.map((p) => (
                            <tr key={p.date} className="border-b">
                              <td className="p-2">{new Date(p.date).toLocaleDateString()}</td>
                              <td className="p-2 text-right font-medium">${p.predictedClose.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
                {dataTab === "comparison" && (
                  <>
                    {comparisonRows.length > 0 ? (
                      <div className="max-h-[280px] overflow-auto">
                        <table className="w-full text-sm">
                          <thead className="sticky top-0 bg-card">
                            <tr className="border-b">
                              <th className="p-2 text-left">Date</th>
                              <th className="p-2 text-right">Predicted</th>
                              <th className="p-2 text-right">Actual</th>
                              <th className="p-2 text-right">Difference</th>
                              <th className="p-2 text-right">Error %</th>
                            </tr>
                          </thead>
                          <tbody>
                            {comparisonRows.map((r) => {
                              const diff = r.actual - r.predicted;
                              const errorPct = r.predicted !== 0 && Number.isFinite(r.predicted) ? (diff / r.predicted) * 100 : 0;
                              return (
                                <tr key={r.date} className="border-b">
                                  <td className="p-2">{new Date(r.date).toLocaleDateString()}</td>
                                  <td className="p-2 text-right">${r.predicted.toFixed(2)}</td>
                                  <td className="p-2 text-right text-emerald-600 dark:text-emerald-400 font-medium">${r.actual.toFixed(2)}</td>
                                  <td className={`p-2 text-right ${diff >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                                    {diff >= 0 ? "+" : ""}${diff.toFixed(2)}
                                  </td>
                                  <td className={`p-2 text-right ${Number.isFinite(errorPct) ? (errorPct >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400") : ""}`}>
                                    {Number.isFinite(errorPct) ? `${errorPct >= 0 ? "+" : ""}${errorPct.toFixed(2)}%` : "—"}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground py-4">
                        No comparison data yet. When historical data overlaps the forecast period, actual vs predicted rows will appear here.
                      </p>
                    )}
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>
        </div>
      )}

      {forecastRequest &&
        !predictionQuery.isLoading &&
        predictions.length === 0 &&
        predictionQuery.data?.ok && (
          <p className="text-sm text-muted-foreground">
            No predictions returned. Check that {forecastRequest.symbol}_history.csv exists in
            server/scripts/yahoo_top_100_output.
          </p>
        )}
    </div>
  );
}
