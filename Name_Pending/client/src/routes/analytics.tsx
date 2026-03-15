import { StockAnalyzer } from "@/components/stock-analyzer";
import type { Route } from "./+types/analytics";


export function meta({}: Route.MetaArgs) {
  return [
    { title: "Graphs & Analytics | Name_Pending" },
    { name: "description", content: "Charts, graphs, and analytics" },
  ];
}

export default function Analytics() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-6">
      <h1 className="mb-2 text-2xl font-semibold">Graphs & Analytics</h1>
      <p className="text-muted-foreground">
        Charts, time series, and analytical tools for stock prediction and comparison.
      </p>
      <section className="mt-6">
        <StockAnalyzer />
      </section>
    </div>
  );
}
