import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@pi/ui/components/card";
import { trpc } from "@/utils/trpc";
import { InsightTrigger } from "@/components/InsightTrigger";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

export function WinLossChart() {
  const marketQuery = useQuery(trpc.getMarketData.queryOptions());
  const rows = marketQuery.data?.ok ? marketQuery.data.rows : [];
  const gainersCount = rows.filter((r) => r.changePercent > 0).length;
  const losersCount = rows.filter((r) => r.changePercent < 0).length;
  const total = gainersCount + losersCount;
  const gainersPct = total ? Math.round((gainersCount / total) * 100) : 50;
  const losersPct = total ? 100 - gainersPct : 50;

  const winLossData = [
    { name: "Gainers", value: gainersPct, color: "var(--success)" },
    { name: "Losers", value: losersPct, color: "var(--destructive)" },
  ];

  const topStocks = [...rows]
    .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
    .slice(0, 6);
  const barStocks = topStocks.map((r) => ({
    name: r.symbol,
    changePercent: r.changePercent,
    isUp: r.changePercent >= 0,
  }));

  const [isAnimated, setIsAnimated] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsAnimated(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const best = rows.length
    ? rows.reduce((best, r) =>
        r.changePercent > best.changePercent ? r : best
      )
    : null;

  if (marketQuery.isLoading) {
    return (
      <Card className="rounded-lg border border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold text-foreground">
            Gainers vs Losers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading market data…</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-lg border border-border bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-1.5 text-lg font-semibold text-foreground">
          Gainers vs Losers
          <InsightTrigger
            hint="Share of stocks up vs down today."
            topic="gainers vs losers and what it says about market sentiment"
            ariaLabel="Learn about gainers vs losers"
          />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center gap-6 lg:flex-row lg:items-start">
          <div className="flex flex-col items-center gap-4">
            <div className="relative h-[220px] w-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={winLossData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={95}
                    paddingAngle={3}
                    dataKey="value"
                    animationBegin={0}
                    animationDuration={1200}
                    animationEasing="ease-out"
                    startAngle={90}
                    endAngle={-270}
                  >
                    {winLossData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.color}
                        className="drop-shadow-lg"
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload?.[0]) {
                        return (
                          <div className="rounded-lg border border-border bg-popover p-2 shadow-lg">
                            <p className="text-sm font-medium text-foreground">
                              {payload[0].name}: {payload[0].value}%
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span
                  className={`text-3xl font-bold text-success transition-all duration-1000 ${
                    isAnimated ? "scale-100 opacity-100" : "scale-50 opacity-0"
                  }`}
                >
                  {gainersPct}%
                </span>
                <span className="text-sm text-muted-foreground">Gainers</span>
              </div>
            </div>
            <div className="flex gap-6">
              <div className="flex items-center gap-2">
                <div
                  className={`h-3 w-3 rounded-full bg-success transition-transform duration-500 ${
                    isAnimated ? "scale-100" : "scale-0"
                  }`}
                />
                <span className="text-sm text-muted-foreground">Gainers</span>
                <span className="font-semibold text-foreground">
                  {gainersPct}%
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className={`h-3 w-3 rounded-full bg-destructive transition-transform duration-500 delay-100 ${
                    isAnimated ? "scale-100" : "scale-0"
                  }`}
                />
                <span className="text-sm text-muted-foreground">Losers</span>
                <span className="font-semibold text-foreground">
                  {losersPct}%
                </span>
              </div>
            </div>
          </div>
          <div className="w-full flex-1 lg:w-auto">
            <p className="mb-4 text-sm font-medium text-muted-foreground">
              Today&apos;s change by stock (scraped data)
            </p>
            <div className="space-y-4">
              {barStocks.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No market data available.
                </p>
              ) : (
                barStocks.map((stock, index) => (
                  <div
                    key={stock.name}
                    className={`transition-all duration-500 ${
                      isAnimated
                        ? "translate-x-0 opacity-100"
                        : "-translate-x-4 opacity-0"
                    }`}
                    style={{ transitionDelay: `${index * 100}ms` }}
                  >
                    <div className="mb-1.5 flex items-center justify-between text-sm">
                      <span className="font-medium text-foreground">
                        {stock.name}
                      </span>
                      <span
                        className={`font-semibold ${
                          stock.isUp ? "text-success" : "text-destructive"
                        }`}
                      >
                        {stock.changePercent >= 0 ? "+" : ""}
                        {stock.changePercent.toFixed(2)}%
                      </span>
                    </div>
                    <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-secondary">
                      <div
                        className="absolute left-1/2 top-0 h-full w-px -translate-x-px bg-foreground/30"
                        aria-hidden
                      />
                      <div
                        className="absolute h-full rounded-full transition-all duration-700 ease-out"
                        style={{
                          left: stock.isUp
                            ? "50%"
                            : `${50 + Math.min(stock.changePercent, 0) * 2}%`,
                          width: `${Math.min(50, Math.abs(stock.changePercent) * 2)}%`,
                          backgroundColor: stock.isUp
                            ? "var(--success)"
                            : "var(--destructive)",
                          transitionDelay: `${300 + index * 100}ms`,
                        }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="mt-6 grid grid-cols-2 gap-4 rounded-lg bg-secondary/50 p-4">
              <div
                className={`transition-all duration-500 delay-700 ${
                  isAnimated
                    ? "translate-y-0 opacity-100"
                    : "translate-y-4 opacity-0"
                }`}
              >
                <p className="text-sm text-muted-foreground">Symbols</p>
                <p className="text-xl font-bold text-foreground">
                  {rows.length}
                </p>
              </div>
              <div
                className={`transition-all duration-500 delay-800 ${
                  isAnimated
                    ? "translate-y-0 opacity-100"
                    : "translate-y-4 opacity-0"
                }`}
              >
                <p className="text-sm text-muted-foreground">Top gainer</p>
                <p className="text-xl font-bold text-success">
                  {best ? `${best.symbol} (+${best.changePercent.toFixed(2)}%)` : "—"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
