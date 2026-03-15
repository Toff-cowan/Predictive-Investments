import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@pi/ui/components/card";
import { trpc } from "@/utils/trpc";
import { InsightTrigger } from "@/components/InsightTrigger";
import { TrendingUp, TrendingDown, DollarSign, BarChart3 } from "lucide-react";

function formatMarketCap(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toLocaleString()}`;
}

export function SummaryCards() {
  const marketQuery = useQuery(trpc.getMarketData.queryOptions());
  const result = marketQuery.data;
  const rows = result?.ok ? result.rows : [];
  const totalMarketCap = result?.ok ? result.totalMarketCap : 0;
  const gainers = rows.filter((r) => r.changePercent > 0).length;
  const losers = rows.filter((r) => r.changePercent < 0).length;
  const avgChange =
    rows.length > 0
      ? rows.reduce((s, r) => s + r.changePercent, 0) / rows.length
      : 0;
  const avgTrend = avgChange >= 0 ? "up" : "down";

  const cards = [
    {
      title: "Total Market Cap",
      value: formatMarketCap(totalMarketCap),
      change: `${avgChange >= 0 ? "+" : ""}${avgChange.toFixed(2)}%`,
      trend: avgTrend as "up" | "down",
      icon: DollarSign,
      hint: "Total value of all tracked stocks at current prices.",
      topic: "market capitalization and what it means for investors",
    },
    {
      title: "Gainers",
      value: String(gainers),
      change: rows.length ? `${((gainers / rows.length) * 100).toFixed(0)}% of ${rows.length}` : "—",
      trend: "up" as const,
      icon: TrendingUp,
      hint: "Stocks whose price went up today.",
      topic: "why some stocks are gainers and how to read daily moves",
    },
    {
      title: "Losers",
      value: String(losers),
      change: rows.length ? `${((losers / rows.length) * 100).toFixed(0)}% of ${rows.length}` : "—",
      trend: "down" as const,
      icon: TrendingDown,
      hint: "Stocks whose price went down today.",
      topic: "how to interpret daily losers in context",
    },
    {
      title: "Avg Daily Change",
      value: `${avgChange >= 0 ? "+" : ""}${avgChange.toFixed(2)}%`,
      change: "across scraped symbols",
      trend: avgTrend as "up" | "down",
      icon: BarChart3,
      hint: "Average percentage change across all symbols we track.",
      topic: "average daily change and market breadth",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((item) => {
        const Icon = item.icon;
        return (
          <Card
            key={item.title}
            className="rounded-lg border border-border bg-card"
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="rounded-lg bg-secondary p-2">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div
                  className={`flex items-center gap-1 text-sm font-medium ${
                    item.trend === "up" ? "text-success" : "text-destructive"
                  }`}
                >
                  {item.trend === "up" ? (
                    <TrendingUp className="h-4 w-4" />
                  ) : (
                    <TrendingDown className="h-4 w-4" />
                  )}
                  {item.change}
                </div>
              </div>
              <div className="mt-4">
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  {item.title}
                  <InsightTrigger
                    hint={item.hint}
                    topic={item.topic}
                    ariaLabel={`Learn about ${item.title}`}
                  />
                </p>
                <p className="mt-1 text-2xl font-semibold text-foreground">
                  {marketQuery.isLoading ? "…" : item.value}
                </p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
