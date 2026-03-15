import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@pi/ui/components/card";
import { Button } from "@pi/ui/components/button";
import { trpc } from "@/utils/trpc";
import { InsightTrigger } from "@/components/InsightTrigger";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const periods = ["1M", "3M", "6M", "1Y", "All"] as const;

function formatChartDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function PerformanceChart() {
  const [period, setPeriod] = useState<(typeof periods)[number]>("1Y");
  const marketQuery = useQuery(trpc.getMarketData.queryOptions());
  const firstSymbol =
    marketQuery.data?.ok && marketQuery.data.rows.length > 0
      ? marketQuery.data.rows[0]!.symbol
      : "AAPL";

  const historyQuery = useQuery(
    trpc.getStockHistory.queryOptions({ symbol: firstSymbol })
  );

  const chartData = useMemo(() => {
    const raw = historyQuery.data?.ok ? historyQuery.data.data : [];
    if (!raw.length) return [];
    const sorted = [...raw].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    const firstClose = sorted[0]?.close ?? 1;
    return sorted.map((d) => ({
      date: d.date,
      dateShort: formatChartDate(d.date),
      value: firstClose ? (d.close / firstClose) * 100 : d.close,
      close: d.close,
    }));
  }, [historyQuery.data]);

  return (
    <Card className="rounded-lg border border-border bg-card">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
        <CardTitle className="flex items-center gap-1.5 text-lg font-semibold text-foreground">
          {firstSymbol} Price History
          <InsightTrigger
            hint="Historical close prices, normalized to 100 at the start."
            topic="how to read price history charts and normalized performance"
            ariaLabel="Learn about price history"
          />
        </CardTitle>
        <div className="flex gap-1 rounded-lg bg-secondary p-1">
          {periods.map((p) => (
            <Button
              key={p}
              variant={period === p ? "secondary" : "ghost"}
              size="sm"
              className="text-xs"
              onClick={() => setPeriod(p)}
            >
              {p}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {historyQuery.isLoading || marketQuery.isLoading ? (
          <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
            Loading history…
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
            No history data for {firstSymbol}
          </div>
        ) : (
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="var(--chart-1)"
                      stopOpacity={0.4}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--chart-1)"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="dateShort"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                  tickFormatter={(value) => `${value.toFixed(0)}`}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload?.[0]) {
                      const p = payload[0].payload;
                      return (
                        <div className="rounded-lg border border-border bg-popover p-3 shadow-lg">
                          <p className="text-sm text-muted-foreground">
                            {p.date}
                          </p>
                          <p className="text-lg font-semibold text-foreground">
                            ${p.close?.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Index: {p.value?.toFixed(1)}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  fill="url(#colorValue)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
