import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@pi/ui/components/card";
import { trpc } from "@/utils/trpc";
import { InsightTrigger } from "@/components/InsightTrigger";
import { TrendingUp, TrendingDown, Star } from "lucide-react";

export function Watchlist() {
  const marketQuery = useQuery(trpc.getMarketData.queryOptions());
  const rows = marketQuery.data?.ok ? marketQuery.data.rows : [];
  const watchlistStocks = rows.slice(0, 6);

  return (
    <Card className="rounded-lg border border-border bg-card">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-1.5 text-lg font-semibold text-foreground">
          Watchlist
          <InsightTrigger
            hint="A shortlist of symbols and their latest price and change."
            topic="what a watchlist is and how to use it for tracking stocks"
            ariaLabel="Learn about watchlist"
          />
        </CardTitle>
        <span className="rounded-md bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
          {watchlistStocks.length} stocks
        </span>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {marketQuery.isLoading ? (
            <div className="p-4 text-sm text-muted-foreground">
              Loading market data…
            </div>
          ) : watchlistStocks.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">
              No market data available.
            </div>
          ) : (
            watchlistStocks.map((stock) => (
              <Link
                key={stock.symbol}
                to={`/market?symbol=${encodeURIComponent(stock.symbol)}`}
                className="flex items-center justify-between p-4 transition-colors hover:bg-secondary/50"
              >
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="text-muted-foreground transition-colors hover:text-primary"
                    onClick={(e) => e.preventDefault()}
                    aria-label="Watchlist"
                  >
                    <Star className="h-4 w-4 fill-primary text-primary" />
                  </button>
                  <div>
                    <p className="font-medium text-foreground">{stock.symbol}</p>
                    <p className="text-sm text-muted-foreground">
                      {stock.name}
                    </p>
                    {(stock.sector || stock.exchange) && (
                      <p className="mt-0.5 text-xs text-muted-foreground/80">
                        {[stock.sector, stock.exchange].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium text-foreground">
                    ${stock.price.toFixed(2)}
                  </p>
                  {stock.dayHigh > 0 && stock.dayLow > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Day: ${stock.dayLow.toFixed(0)}–${stock.dayHigh.toFixed(0)}
                    </p>
                  )}
                  <div
                    className={`flex items-center justify-end gap-1 text-sm ${
                      stock.changePercent >= 0
                        ? "text-success"
                        : "text-destructive"
                    }`}
                  >
                    {stock.changePercent >= 0 ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    <span>
                      {stock.changePercent >= 0 ? "+" : ""}
                      {stock.changePercent.toFixed(2)}%
                    </span>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
