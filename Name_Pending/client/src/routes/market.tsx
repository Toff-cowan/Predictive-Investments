import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import type { Route } from "./+types/market";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Market Details | Name_Pending" },
    { name: "description", content: "View market details and data" },
  ];
}

export default function MarketDetails() {
  const marketQuery = useQuery(trpc.getMarketData.queryOptions());

  return (
    <div className="container mx-auto max-w-4xl px-4 py-6">
      <h1 className="mb-2 text-2xl font-semibold">Market Details</h1>
      <p className="text-muted-foreground">
        Market data from the scraper. Configure the URL and selectors in{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-sm">
          packages/api/src/scrapers/market.ts
        </code>
        .
      </p>
      <section className="mt-6 rounded-lg border p-6">
        {marketQuery.isLoading && (
          <p className="text-sm text-muted-foreground">Loading…</p>
        )}
        {marketQuery.isError && (
          <p className="text-sm text-destructive">
            Error: {marketQuery.error.message}
          </p>
        )}
        {marketQuery.data && !marketQuery.data.ok && (
          <p className="text-sm text-muted-foreground">
            Scrape failed: {marketQuery.data.error}
          </p>
        )}
        {marketQuery.data?.ok && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Source: {marketQuery.data.source} ·{" "}
              {marketQuery.data.rows.length} row(s)
            </p>
            {marketQuery.data.rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No rows found. Update the scraper URL and selectors for your
                target page.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="p-2">Symbol</th>
                      <th className="p-2">Name</th>
                      <th className="p-2">Price</th>
                      {marketQuery.data.rows.some((r: { change?: string }) => r.change) && (
                        <th className="p-2">Change</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {marketQuery.data.rows.map((row: { symbol: string; name: string; price: string; change?: string }, i: number) => (
                      <tr key={i} className="border-b">
                        <td className="p-2 font-medium">{row.symbol}</td>
                        <td className="p-2">{row.name}</td>
                        <td className="p-2">{row.price}</td>
                        {row.change !== undefined && (
                          <td className="p-2">{row.change}</td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
