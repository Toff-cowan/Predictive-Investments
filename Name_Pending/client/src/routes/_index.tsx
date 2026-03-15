import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { MetaArgs } from "react-router";

import { trpc } from "@/utils/trpc";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { WinLossChart } from "@/components/dashboard/win-loss-chart";
import { PerformanceChart } from "@/components/dashboard/performance-chart";
import { Watchlist } from "@/components/dashboard/watchlist";
import { NewsFeed } from "@/components/dashboard/news-feed";
import { ChatbotButton } from "@/components/dashboard/chatbot-button";

function ScrollReveal({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let root: Element | null = null;
    let p: HTMLElement | null = el.parentElement;
    while (p) {
      const o = getComputedStyle(p).overflowY;
      if (o === "auto" || o === "scroll") {
        root = p;
        break;
      }
      p = p.parentElement;
    }
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setRevealed(true);
      },
      { threshold: 0.08, rootMargin: "0px 0px -30px 0px", root: root ?? undefined }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} className={`scroll-reveal ${revealed ? "revealed" : ""}`}>
      {children}
    </div>
  );
}

export function meta({}: MetaArgs) {
  return [
    { title: "Dashboard | PI - Predictive Investments" },
    { name: "description", content: "PI - Predictive Investments dashboard" },
  ];
}

export default function Dashboard() {
  const marketQuery = useQuery(trpc.getMarketData.queryOptions());
  const scrapedAt =
    marketQuery.data?.ok && marketQuery.data.scrapedAt
      ? new Date(marketQuery.data.scrapedAt).toLocaleString(undefined, {
          dateStyle: "short",
          timeStyle: "short",
        })
      : null;

  return (
    <div className="min-h-full bg-background">
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Hero: two columns, title + image */}
        <section className="relative mb-8 flex flex-col overflow-hidden rounded-2xl border border-border bg-card md:flex-row">
          <div className="relative z-10 flex flex-1 flex-col justify-center px-6 py-10 sm:px-8 sm:py-12 md:px-10 lg:py-14">
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
              Dashboard
            </h1>
            <p className="mt-2 max-w-xl text-base text-muted-foreground sm:text-lg">
              Welcome back! Here&apos;s your portfolio overview.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
              {scrapedAt && (
                <span>Market data as of {scrapedAt}</span>
              )}
            </div>
          </div>
          <div className="relative h-48 w-full shrink-0 md:h-auto md:min-h-[240px] md:w-[42%] lg:min-h-[280px]">
            <img
              src="https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&q=80"
              alt="Charts and financial data"
              className="absolute inset-0 h-full w-full object-cover md:rounded-r-2xl [border-inline-start:1px_solid_var(--border)]"
            />
          </div>
        </section>
        <ScrollReveal>
          <WinLossChart />
        </ScrollReveal>

        <ScrollReveal>
          <div className="mt-6">
            <SummaryCards />
          </div>
        </ScrollReveal>

        <ScrollReveal>
          <div className="mt-6">
            <PerformanceChart />
          </div>
        </ScrollReveal>

        <ScrollReveal>
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Watchlist />
            <NewsFeed />
          </div>
        </ScrollReveal>
      </main>

      <ChatbotButton />
    </div>
  );
}
