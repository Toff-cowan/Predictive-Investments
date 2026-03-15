/**
 * Stock Prediction Analyzer for the Analytics page.
 * Analyze a stock: set symbol, time horizon, run prediction, compare actual vs predicted (mirror overlay).
 */
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ComposedChart, Line, XAxis, YAxis, CartesianGrid, ReferenceLine, Area, Legend } from "recharts";
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
import { Target, BarChart3, CheckCircle2, AlertCircle, Layers, TrendingUp, TrendingDown, Loader2, Download, Copy } from "lucide-react";

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

function buildAnalyzeChartData(
  actual: OHLC[],
  predicted: PredictionPoint[],
  mapePercent?: number
) {
  const toDate = (d: string) => (d.split(" ")[0] ?? d).trim();
  const band = mapePercent != null ? mapePercent / 100 : BOUND_PERCENT;
  const historical = actual.map((d) => ({
    date: toDate(d.date),
    actual: d.close,
    predicted: null as number | null,
    upperBound: null as number | null,
    lowerBound: null as number | null,
    actualFuture: null as number | null,
  }));
  const actualByDate = new Map(actual.map((d) => [toDate(d.date), d.close]));
  const lastActualDate = actual.length > 0 ? toDate(actual[actual.length - 1].date) : null;
  const future = predicted.map((p) => {
    const date = toDate(p.date);
    const pred = p.predictedClose;
    const upper = pred * (1 + band);
    const lower = pred * (1 - band);
    const actualFuture = actualByDate.get(date) ?? null;
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
}: {
  actual: OHLC[];
  predicted: PredictionPoint[];
  symbol: string;
  forecastDays: number;
  height?: number;
  accuracy?: PredictionAccuracy | null;
  showConfidenceBands?: boolean;
  showMirrorOverlay?: boolean;
}) {
  const mape = accuracy?.mape;
  const { combined, lastActualDate } = useMemo(
    () => buildAnalyzeChartData(actual, predicted, mape),
    [actual, predicted, mape]
  );
  const hasActualFuture = combined.some((d) => d.actualFuture != null);

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
          <span>Historical data with {forecastDays}-day prediction ({showMirrorOverlay ? "Overlay Enabled" : "Overlay off"})</span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={{
            actual: { label: "Historical Price", color: "#3b82f6" },
            predicted: { label: "Predicted Price", color: "#f59e0b" },
            upperBound: { label: "Upper Bound", color: "#f59e0b" },
            lowerBound: { label: "Lower Bound", color: "#f59e0b" },
            actualFuture: { label: "Actual Future", color: "#22c55e" },
          }}
          className="w-full"
          style={{ height }}
        >
          <ComposedChart data={combined} margin={{ top: 12, right: 20, left: 12, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis
              dataKey="date"
              tickFormatter={(v: string) => new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={["dataMin - 10", "dataMax + 10"]}
              tickFormatter={(v: number) => `$${Number(v).toFixed(0)}`}
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
            {showConfidenceBands && (
              <>
                <Area
                  type="monotone"
                  dataKey="upperBound"
                  baseValue={(entry: { lowerBound?: number | null }) => entry?.lowerBound ?? 0}
                  stroke="none"
                  fill="#f59e0b"
                  fillOpacity={0.2}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="upperBound"
                  stroke="#f59e0b"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={{ fill: "#f59e0b", r: 2 }}
                  name="Upper Bound"
                  connectNulls={false}
                />
                <Line
                  type="monotone"
                  dataKey="lowerBound"
                  stroke="#f59e0b"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={{ fill: "#f59e0b", r: 2 }}
                  name="Lower Bound"
                  connectNulls={false}
                />
              </>
            )}
            <Line
              type="monotone"
              dataKey="actual"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              name="Historical Price"
              connectNulls={false}
            />
            {showMirrorOverlay && (
              <>
                <Line
                  type="monotone"
                  dataKey="predicted"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={{ fill: "#f59e0b", r: 3 }}
                  name="Predicted Price"
                  connectNulls={false}
                />
                {hasActualFuture && (
                  <Line
                    type="monotone"
                    dataKey="actualFuture"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={{ fill: "#22c55e", r: 3 }}
                    name="Actual Future"
                    connectNulls={false}
                  />
                )}
              </>
            )}
            <Legend
              verticalAlign="bottom"
              height={36}
              formatter={(value) => (
                <span className="text-muted-foreground text-xs">
                  {value === "Upper Bound" || value === "Lower Bound" ? `-- ${value}` : `- ${value}`}
                </span>
              )}
            />
          </ComposedChart>
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

  const marketQuery = useQuery({
    ...trpc.getMarketData.queryOptions(),
  });
  const availableSymbolsQuery = useQuery({
    ...trpc.getAvailableSymbols.queryOptions(),
  });
  const dataStatusQuery = useQuery({
    ...trpc.getDataStatus.queryOptions(),
  });
  const marketRows: MarketRow[] = marketQuery.data?.ok ? marketQuery.data.rows : [];
  const availableSymbols: string[] = availableSymbolsQuery.data?.ok ? availableSymbolsQuery.data.symbols : [];
  const dataStatus = dataStatusQuery.data;
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
  const predictions: PredictionPoint[] = predictionsFromCsv.length > 0 ? predictionsFromCsv : apiPredictions;

  const hasPredictions = forecastRequest && !predictionQuery.isLoading && predictions.length > 0;
  const hasHistory = history.length > 0;
  const hasResults = hasPredictions && hasHistory;

  const actualByDate = useMemo(() => new Map(history.map((d) => [toDateStr(d.date), d.close])), [history]);
  const comparisonRows = useMemo(() => {
    return predictions
      .map((p) => {
        const actual = actualByDate.get(toDateStr(p.date)) ?? null;
        return { date: p.date, predicted: p.predictedClose, actual };
      })
      .filter((r): r is { date: string; predicted: number; actual: number } => r.actual != null);
  }, [predictions, actualByDate]);
  const { overallAccuracy, directionalAccuracy, rmse } = useMemo(() => {
    if (comparisonRows.length < 2) {
      return {
        overallAccuracy: accuracy ? 100 - accuracy.mape : null,
        directionalAccuracy: null as number | null,
        rmse: null as number | null,
      };
    }
    const n = comparisonRows.length;
    const errors = comparisonRows.map((r) => (r.actual - r.predicted) / r.actual);
    const meanAbsPct = (errors.reduce((s, e) => s + Math.abs(e), 0) / n) * 100;
    let directional = 0;
    for (let i = 1; i < n; i++) {
      const actDir = Math.sign(comparisonRows[i].actual - comparisonRows[i - 1].actual);
      const predDir = Math.sign(comparisonRows[i].predicted - comparisonRows[i - 1].predicted);
      if (actDir === predDir) directional++;
    }
    const sqErrors = comparisonRows.map((r) => (r.actual - r.predicted) ** 2);
    const rmseVal = Math.sqrt(sqErrors.reduce((a, b) => a + b, 0) / n);
    return {
      overallAccuracy: 100 - meanAbsPct,
      directionalAccuracy: (directional / (n - 1)) * 100,
      rmse: rmseVal,
    };
  }, [comparisonRows, accuracy]);

  const scrapedRow = forecastRequest
    ? marketRows.find((r) => r.symbol.toUpperCase() === forecastRequest.symbol.toUpperCase())
    : null;
  const currentPrice =
    scrapedRow?.price ??
    (history.length > 0 ? history[history.length - 1].close : predictions[0]?.predictedClose ?? null);
  console.log("Render StockAnalyzer", { forecastRequest, history, predictions, accuracy, currentPrice });
  console.log("Data status", dataStatus);
  console.log("Available stock options", stockOptions);
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
                onClick={() => normalizedSymbol && setForecastRequest({ symbol: normalizedSymbol, days: forecastDays })}
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
              Populating details from predicted CSV for comparison. Results will appear below.
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

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant={mirrorOverlay ? "secondary" : "outline"}
                size="sm"
                onClick={() => setMirrorOverlay(!mirrorOverlay)}
              >
                Mirror Overlay
              </Button>
              <Button
                type="button"
                variant={confidenceBands ? "secondary" : "outline"}
                size="sm"
                onClick={() => setConfidenceBands(!confidenceBands)}
              >
                Confidence Bands
              </Button>
            </div>
            <Button type="button" variant="outline" size="sm" className="text-muted-foreground">
              Comparing
            </Button>
          </div>

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

      {(accuracy != null || comparisonRows.length > 0) && (
        <Card className="rounded-lg border border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              Prediction Accuracy Analysis
            </CardTitle>
            <CardDescription>
              {accuracy != null
                ? `Backtest: comparing predicted vs actual on last ${accuracy.backtestDays} days`
                : "Comparing predicted vs actual when history overlaps forecast period"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-lg border bg-background p-3">
                <p className="text-xs text-muted-foreground">Overall Accuracy</p>
                <p className="text-xl font-bold">
                  {overallAccuracy != null ? `${Math.max(0, overallAccuracy).toFixed(2)}%` : "—"}
                </p>
                {(overallAccuracy != null && overallAccuracy >= 95) && (
                  <span className="text-xs font-medium text-emerald-600">Excellent</span>
                )}
              </div>
              <div className="rounded-lg border bg-background p-3">
                <p className="text-xs text-muted-foreground">Directional Accuracy</p>
                <p className="text-xl font-bold">
                  {directionalAccuracy != null ? `${directionalAccuracy.toFixed(1)}%` : "—"}
                </p>
                <p className="text-xs text-muted-foreground">Correct trend predictions</p>
              </div>
              <div className="rounded-lg border bg-background p-3">
                <p className="text-xs text-muted-foreground">MAPE</p>
                <p className="text-xl font-bold">
                  {accuracy != null ? `${accuracy.mape.toFixed(2)}%` : overallAccuracy != null ? `${(100 - overallAccuracy).toFixed(2)}%` : "—"}
                </p>
              </div>
              <div className="rounded-lg border bg-background p-3">
                <p className="text-xs text-muted-foreground">RMSE</p>
                <p className="text-xl font-bold">{rmse != null ? `$${rmse.toFixed(2)}` : "—"}</p>
              </div>
            </div>
            <div className="rounded-lg border bg-background p-3">
              <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <AlertCircle className="h-4 w-4" />
                Prediction Quality Feedback
              </h4>
              {(accuracy?.mape ?? (overallAccuracy != null ? 100 - overallAccuracy : 99)) <= 5 ? (
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-emerald-600">Excellent prediction accuracy!</span> The model closely
                  mirrored actual market movements. This high accuracy suggests the model parameters are well-tuned.
                  Consider using these predictions with higher confidence for future decisions.
                </p>
              ) : (accuracy?.mape ?? 10) <= 15 ? (
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
          </CardContent>
        </Card>
      )}

      {comparisonRows.length > 0 && (
        <Card className="rounded-lg border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Prediction vs Actual Comparison</CardTitle>
            <CardDescription>Side-by-side comparison of predicted and actual values.</CardDescription>
          </CardHeader>
          <CardContent>
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
                    const errorPct = r.predicted !== 0 ? (diff / r.predicted) * 100 : 0;
                    return (
                      <tr key={r.date} className="border-b">
                        <td className="p-2">{new Date(r.date).toLocaleDateString()}</td>
                        <td className="p-2 text-right">${r.predicted.toFixed(2)}</td>
                        <td className="p-2 text-right text-emerald-600 dark:text-emerald-400 font-medium">${r.actual.toFixed(2)}</td>
                        <td className={`p-2 text-right ${diff >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                          {diff >= 0 ? "+" : ""}${diff.toFixed(2)}
                        </td>
                        <td className={`p-2 text-right ${errorPct >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                          {errorPct >= 0 ? "+" : ""}{errorPct.toFixed(2)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {forecastRequest && !predictionQuery.isLoading && predictions.length > 0 && (
        <Card className="rounded-lg border bg-card">
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base">Predicted values (compare below)</CardTitle>
                <CardDescription>
                Generated prediction data for the next {forecastDays} days — use the chart and accuracy section to compare.
                {predictionsFromCsv.length > 0 && (
                  <span className="block mt-1 text-emerald-600 dark:text-emerald-400">Data loaded from predicted CSV and posted on this page.</span>
                )}
              </CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2 shrink-0"
                onClick={() => {
                  const header = "Date,Predicted_Close";
                  const rows = predictions.map((p) => `${p.date},${p.predictedClose}`);
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
            <p className="text-xs text-muted-foreground mt-2 flex flex-wrap items-center gap-2">
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
                onClick={() => {
                  navigator.clipboard.writeText(predictedCsvUri);
                }}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </p>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
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

      {dataStatus && (
        <Card className="rounded-lg border border-muted bg-muted/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Stored data status (troubleshooting)</CardTitle>
            <CardDescription>
              What the server sees. If the dropdown is empty or wrong, check these.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-xs space-y-1.5 font-mono">
            <p><span className="text-muted-foreground">Server cwd:</span> {dataStatus.cwd}</p>
            <p><span className="text-muted-foreground">Data directory:</span> {dataStatus.outputDir}</p>
            <p><span className="text-muted-foreground">Summary file exists:</span> {dataStatus.summaryExists ? "Yes" : "No"}</p>
            <p><span className="text-muted-foreground">History files (*_history.csv):</span> {dataStatus.historyCount}</p>
            {dataStatus.sampleSymbols.length > 0 && (
              <p><span className="text-muted-foreground">Sample symbols:</span> {dataStatus.sampleSymbols.join(", ")}</p>
            )}
            {dataStatus.hint && (
              <p className="text-amber-600 dark:text-amber-400 mt-2">{dataStatus.hint}</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
