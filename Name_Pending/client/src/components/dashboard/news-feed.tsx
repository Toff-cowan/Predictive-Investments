import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@pi/ui/components/card";
import { trpc } from "@/utils/trpc";
import { InsightTrigger } from "@/components/InsightTrigger";
import { Clock, ExternalLink } from "lucide-react";

function formatTime(published: string): string {
  try {
    const d = new Date(published);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    if (diffHours < 1) return "Just now";
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
    return d.toLocaleDateString();
  } catch {
    return published;
  }
}

export function NewsFeed() {
  const newsQuery = useQuery(
    trpc.getStockNews.queryOptions({ symbol: "AAPL" })
  );
  const items = newsQuery.data?.ok ? newsQuery.data.items.slice(0, 5) : [];

  return (
    <Card className="rounded-lg border border-border bg-card">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-1.5 text-lg font-semibold text-foreground">
          Market News
          <InsightTrigger
            hint="Recent headlines for the tracked symbol."
            topic="why market news matters for stock analysis"
            ariaLabel="Learn about market news"
          />
        </CardTitle>
        <Link to="/market" className="text-sm text-primary hover:underline">
          View all
        </Link>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {newsQuery.isLoading ? (
            <div className="p-4 text-sm text-muted-foreground">
              Loading news…
            </div>
          ) : items.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">
              No news available.
            </div>
          ) : (
            items.map((news) => (
              <a
                key={news.link + news.title}
                href={news.link}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex cursor-pointer items-start justify-between gap-4 p-4 transition-colors hover:bg-secondary/50"
              >
                <div className="min-w-0 flex-1">
                  <h3 className="font-medium leading-snug text-foreground group-hover:text-primary">
                    {news.title}
                  </h3>
                  <div className="mt-2 flex items-center gap-3 text-sm text-muted-foreground">
                    <span>{news.source}</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatTime(news.published)}
                    </span>
                  </div>
                </div>
                <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </a>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
