import Highcharts from "highcharts/highstock";
import HighchartsReact from "highcharts-react-official";
import { createChart, ColorType } from "lightweight-charts";
import { useQuery } from "@tanstack/react-query";
import { Maximize2, Minimize2, Search, TrendingDown, TrendingUp, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { trpc } from "@/utils/trpc";
import type { Route } from "./+types/market";
import type { MarketRow, NewsItem } from "@Name_Pending/api/routers/index";
import type { OHLC } from "@Name_Pending/api/routers/index";
import "@/styles/market.css";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Market Details | Name_Pending" },
    { name: "description", content: "View top 100 stocks with candlestick views and details" },
  ];
}

type SortKey = "marketCap" | "price" | "changePercent" | "volume" | "name";

type ChartPeriod = "1D" | "1W" | "1M" | "3M" | "1Y" | "ALL";

const CHART_PERIOD_MS: Record<ChartPeriod, number | null> = {
  "1D": 1 * 24 * 60 * 60 * 1000,
  "1W": 7 * 24 * 60 * 60 * 1000,
  "1M": 30 * 24 * 60 * 60 * 1000,
  "3M": 90 * 24 * 60 * 60 * 1000,
  "1Y": 365 * 24 * 60 * 60 * 1000,
  ALL: null,
};

function filterHistoryByPeriod(history: OHLC[], period: ChartPeriod): OHLC[] {
  if (history.length === 0 || period === "ALL") return history;
  if (period === "1D") return history.slice(-1); /* last trading day */
  const cutoffMs = CHART_PERIOD_MS[period];
  if (cutoffMs == null) return history;
  const lastDate = new Date(history[history.length - 1].date).getTime();
  const cutoff = lastDate - cutoffMs;
  return history.filter((d) => new Date(d.date).getTime() >= cutoff);
}

function getThemeColors() {
  if (typeof document === "undefined") {
    return {
      success: "oklch(0.696 0.17 162.48)",
      destructive: "oklch(0.396 0.141 25.723)",
      muted: "oklch(0.708 0 0)",
      border: "oklch(0.269 0 0)",
      card: "oklch(0.145 0 0)",
      background: "oklch(0.145 0 0)",
      foreground: "oklch(0.985 0 0)",
    };
  }
  const root = document.documentElement;
  const get = (v: string) => getComputedStyle(root).getPropertyValue(v).trim() || undefined;
  return {
    success: get("--success") ?? "oklch(0.696 0.17 162.48)",
    destructive: get("--destructive") ?? "oklch(0.396 0.141 25.723)",
    muted: get("--muted-foreground") ?? "oklch(0.708 0 0)",
    border: get("--border") ?? "oklch(0.269 0 0)",
    card: get("--card") ?? "oklch(0.145 0 0)",
    background: get("--background") ?? "oklch(0.145 0 0)",
    foreground: get("--foreground") ?? "oklch(0.985 0 0)",
  };
}

const LIGHT_CHART_THEME = {
  success: "oklch(0.6 0.118 184.704)",
  destructive: "oklch(0.577 0.245 27.325)",
  muted: "oklch(0.556 0 0)",
  border: "oklch(0.922 0 0)",
  card: "oklch(1 0 0)",
  background: "oklch(0.97 0 0)",
  foreground: "oklch(0.145 0 0)",
};

const DARK_CHART_THEME = {
  success: "oklch(0.696 0.17 162.48)",
  destructive: "oklch(0.396 0.141 25.723)",
  muted: "oklch(0.708 0 0)",
  border: "oklch(0.269 0 0)",
  card: "oklch(0.145 0 0)",
  background: "oklch(0.145 0 0)",
  foreground: "oklch(0.985 0 0)",
};

function useChartTheme(themeOverride?: "light" | "dark") {
  const [theme, setTheme] = useState(getThemeColors);
  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(getThemeColors()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  const resolved = themeOverride === "light" ? LIGHT_CHART_THEME : themeOverride === "dark" ? DARK_CHART_THEME : theme;
  return useMemo(
    () => {
      const grid = {
        gridLineColor: resolved.border,
        gridLineWidth: 1,
        gridLineDashStyle: "Dot",
      };
      return {
        ...resolved,
        chartTheme: {
          chart: { backgroundColor: "transparent", zooming: { type: "x" as const } },
          title: { style: { color: resolved.muted } },
          xAxis: {
            labels: { style: { color: resolved.muted } },
            lineColor: resolved.border,
            tickColor: resolved.border,
            ...grid,
          },
          yAxis: {
            title: { style: { color: resolved.muted } },
            labels: { style: { color: resolved.muted } },
            gridLineColor: resolved.border,
            gridLineWidth: 1,
            gridLineDashStyle: "Dot",
            lineColor: resolved.border,
            tickColor: resolved.border,
            tickAmount: 8,
          },
          tooltip: { backgroundColor: resolved.card, borderColor: resolved.border, style: { color: resolved.foreground } },
          legend: { itemStyle: { color: resolved.muted } },
        },
      };
    },
    [resolved.success, resolved.destructive, resolved.muted, resolved.border, resolved.card, resolved.foreground]
  );
}

function ohlcToHighcharts(data: OHLC[]): [number, number, number, number, number][] {
  return data.map((d) => [
    new Date(d.date).getTime(),
    d.open,
    d.high,
    d.low,
    d.close,
  ]);
}

/** TradingView-style candlestick chart (lightweight-charts) */
function TradingViewCandlestickChart({
  data,
  themeMode,
  height = 340,
  symbol,
  periodLabel,
}: {
  data: OHLC[];
  themeMode: "light" | "dark";
  height?: number;
  symbol?: string;
  periodLabel?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);
  const seriesRef = useRef<{ setData: (d: unknown[]) => void } | null>(null);

  const isLight = themeMode === "light";
  const layout = useMemo(
    () => ({
      background: { type: ColorType.Solid, color: isLight ? "#ffffff" : "#131722" },
      textColor: isLight ? "#131722" : "#d1d4dc",
    }),
    [isLight]
  );
  const grid = useMemo(
    () => ({
      vertLines: { color: isLight ? "#e0e3eb" : "#2b2b43" },
      horzLines: { color: isLight ? "#e0e3eb" : "#2b2b43" },
    }),
    [isLight]
  );
  const borderColor = isLight ? "#e0e3eb" : "#2b2b43";
  const upColor = "#26a69a";
  const downColor = "#ef5350";

  const chartData = useMemo(
    () =>
      data.map((d) => {
        const dStr = d.date.split(" ")[0] ?? d.date;
        const [y, m, day] = dStr.split("-");
        const time = (y && m && day ? `${y}-${m.padStart(2, "0")}-${day.padStart(2, "0")}` : dStr) as string;
        return { time, open: d.open, high: d.high, low: d.low, close: d.close };
      }),
    [data]
  );

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height,
      layout,
      grid,
      rightPriceScale: {
        borderColor,
        scaleMargins: { top: 0.1, bottom: 0.2 },
      },
      timeScale: {
        borderColor,
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: { vertLine: { labelVisible: true }, horzLine: { labelVisible: true } },
    });
    chartRef.current = chart;

    const candlestickSeries = chart.addCandlestickSeries({
      upColor,
      downColor,
      borderDownColor: downColor,
      borderUpColor: upColor,
    });
    seriesRef.current = candlestickSeries as unknown as { setData: (d: unknown[]) => void };
    if (chartData.length > 0) candlestickSeries.setData(chartData);

    const handleResize = () => {
      if (containerRef.current && chartRef.current) chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      seriesRef.current = null;
      chart.remove();
      chartRef.current = null;
    };
  }, [height, layout, grid, borderColor, upColor, downColor]);

  useEffect(() => {
    if (!seriesRef.current || chartData.length === 0) return;
    seriesRef.current.setData(chartData);
  }, [chartData]);

  const last = data[data.length - 1];
  const prev = data.length >= 2 ? data[data.length - 2] : null;
  const change = last && prev ? last.close - prev.close : 0;
  const changePct = last && prev && prev.close ? (change / prev.close) * 100 : 0;
  const isUp = change >= 0;

  return (
    <div className="tradingview-chart-wrap">
      {(symbol || last) && (
        <div className="tradingview-chart-header">
          {symbol && periodLabel && (
            <span className="tradingview-chart-title">{symbol} – {periodLabel}</span>
          )}
          {last && (
            <div className={`tradingview-chart-ohlc ${isUp ? "up" : "down"}`}>
              <span>O{last.open.toFixed(2)}</span>
              <span>H{last.high.toFixed(2)}</span>
              <span>L{last.low.toFixed(2)}</span>
              <span>C{last.close.toFixed(2)}</span>
              <span>
                {change >= 0 ? "+" : ""}{change.toFixed(2)} ({change >= 0 ? "+" : ""}{changePct.toFixed(2)}%)
              </span>
            </div>
          )}
        </div>
      )}
      <div ref={containerRef} style={{ width: "100%", height }} />
    </div>
  );
}

function MiniCandlestickHighcharts({
  open,
  high,
  low,
  close,
  gain,
  height = 36,
  width = 120,
}: {
  open: number;
  high: number;
  low: number;
  close: number;
  gain: boolean;
  height?: number;
  width?: number;
}) {
  const { chartTheme, success, destructive } = useChartTheme();
  const options = useMemo<Highcharts.Options>(() => {
    const t = new Date().getTime();
    const color = gain ? success : destructive;
    return {
      ...chartTheme,
      chart: { ...chartTheme.chart, height, width },
      xAxis: { type: "datetime", visible: false },
      yAxis: { visible: false },
      title: { text: undefined },
      legend: { enabled: false },
      credits: { enabled: false },
      series: [{
        type: "candlestick",
        name: "Price",
        data: [[t, open, high, low, close]],
        upColor: color,
        color: color,
        lineColor: color,
      }],
    };
  }, [open, high, low, close, gain, height, width, chartTheme, success, destructive]);

  return (
    <div className="market-candlestick-cell" style={{ width, height }}>
      <HighchartsReact highcharts={Highcharts} options={options} immutable={true} />
    </div>
  );
}

function MiniCandlestick({
  open,
  high,
  low,
  close,
  width = 120,
  height = 36,
  gain,
}: {
  open: number;
  high: number;
  low: number;
  close: number;
  width?: number;
  height?: number;
  gain: boolean;
}) {
  const { success, destructive } = useChartTheme();
  const min = Math.min(low, open, close);
  const max = Math.max(high, open, close);
  const range = max - min || 1;
  const padding = 2;
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;
  const y = (v: number) => padding + innerH - ((v - min) / range) * innerH;
  const bodyTop = Math.min(y(open), y(close));
  const bodyH = Math.abs(y(close) - y(open)) || 1;
  const wickX = padding + innerW / 2;
  const color = gain ? success : destructive;

  return (
    <svg width={width} height={height} className="market-candlestick-cell">
      <line x1={wickX} y1={y(high)} x2={wickX} y2={y(low)} stroke={color} strokeWidth={1} />
      <rect
        x={padding + innerW * 0.25}
        y={bodyTop}
        width={innerW * 0.5}
        height={bodyH}
        fill={color}
        stroke={color}
      />
    </svg>
  );
}

function CardSparkline({ row }: { row: MarketRow }) {
  const open = row.dayLow + (row.dayHigh - row.dayLow) * 0.5;
  const high = row.dayHigh;
  const low = row.dayLow;
  const close = row.price;
  const gain = row.changePercent >= 0;
  return (
    <div className="market-mini-chart">
      <MiniCandlestickHighcharts
        open={open}
        high={high}
        low={low}
        close={close}
        gain={gain}
        width={280}
        height={48}
      />
    </div>
  );
}

function formatMarketCapShort(n: number): string {
  if (n >= 1e12) return (n / 1e12).toFixed(1) + "T";
  if (n >= 1e9) return (n / 1e9).toFixed(1) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  return String(n);
}

export default function MarketDetails() {
  const [search, setSearch] = useState("");
  const [sectorFilter, setSectorFilter] = useState<string>("");
  const [sortBy, setSortBy] = useState<SortKey>("marketCap");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [modalTab, setModalTab] = useState<"overview" | "chart" | "stats">("overview");
  const [showAllStocks, setShowAllStocks] = useState(false);
  const [initialHighlight, setInitialHighlight] = useState(true);
  const overlayRef = useRef<HTMLDivElement>(null);
  const cardsOverlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setInitialHighlight(false), 2500);
    return () => clearTimeout(t);
  }, []);

  const marketQuery = useQuery(trpc.getMarketData.queryOptions());
  const historyQuery = useQuery({
    ...trpc.getStockHistory.queryOptions({ symbol: selectedSymbol ?? "" }),
    enabled: !!selectedSymbol,
  });

  const rows = marketQuery.data?.ok ? marketQuery.data.rows : [];
  const totalMarketCap = marketQuery.data?.ok ? marketQuery.data.totalMarketCap : 0;
  const wins = rows.filter((r) => r.changePercent >= 0).length;
  const losses = rows.filter((r) => r.changePercent < 0).length;

  const sectors = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach((r) => map.set(r.sector, (map.get(r.sector) ?? 0) + 1));
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [rows]);

  const filtered = useMemo(() => {
    let list = rows;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (r) =>
          r.symbol.toLowerCase().includes(q) ||
          r.name.toLowerCase().includes(q)
      );
    }
    if (sectorFilter) {
      list = list.filter((r) => r.sector === sectorFilter);
    }
    return list;
  }, [rows, search, sectorFilter]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    switch (sortBy) {
      case "marketCap":
        list.sort((a, b) => b.marketCap - a.marketCap);
        break;
      case "price":
        list.sort((a, b) => b.price - a.price);
        break;
      case "changePercent":
        list.sort((a, b) => b.changePercent - a.changePercent);
        break;
      case "volume":
        list.sort((a, b) => b.volume - a.volume);
        break;
      case "name":
        list.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }
    return list;
  }, [filtered, sortBy]);

  const newsSymbol = useMemo(
    () => (sorted.length > 0 ? sorted[0].symbol : "AAPL"),
    [sorted]
  );
  const newsQuery = useQuery({
    ...trpc.getStockNews.queryOptions({ symbol: newsSymbol }),
    enabled: !!newsSymbol,
  });
  const newsItems: NewsItem[] = newsQuery.data?.ok ? newsQuery.data.items : [];

  const displayedStocks = useMemo(() => {
    if (showAllStocks) return sorted;
    return sorted.slice(0, 30);
  }, [sorted, showAllStocks]);

  const topGainers = useMemo(
    () => [...rows].sort((a, b) => b.changePercent - a.changePercent).slice(0, 3),
    [rows]
  );
  const topLosers = useMemo(
    () => [...rows].sort((a, b) => a.changePercent - b.changePercent).slice(0, 3),
    [rows]
  );

  const selectedRow = selectedSymbol ? rows.find((r) => r.symbol === selectedSymbol) : null;
  const historyData = historyQuery.data?.ok ? historyQuery.data.data : [];

  return (
    <div className={`market-dashboard ${initialHighlight ? "initial-highlight" : ""}`}>
      <header className="market-header">
        <div>
          <h1>Market Details</h1>
          <p className="market-subtitle">Top 100 Stocks Dashboard</p>
        </div>
        <div className="market-metrics">
          <span className="market-metric">
            Market Cap: <span>{formatMarketCapShort(totalMarketCap)}</span>
          </span>
          <div className="market-wins-losses">
            <span className="wins"><TrendingUp className="inline w-4 h-4" /> {wins}</span>
            <span className="losses"><TrendingDown className="inline w-4 h-4" /> {losses}</span>
          </div>
        </div>
      </header>

      <div className="market-filters">
        <div className="market-search-wrap" style={{ position: "relative" }}>
          <Search
            style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "var(--market-muted)" }}
            className="w-4 h-4"
          />
          <input
            type="text"
            placeholder="Search by symbol or company name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="market-select"
          value={sectorFilter}
          onChange={(e) => setSectorFilter(e.target.value)}
        >
          <option value="">All Sectors</option>
          {sectors.map(([sec]) => (
            <option key={sec} value={sec}>{sec}</option>
          ))}
        </select>
        <select
          className="market-select"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortKey)}
        >
          <option value="marketCap">Market Cap</option>
          <option value="price">Price</option>
          <option value="changePercent">% Change</option>
          <option value="volume">Volume</option>
          <option value="name">Name</option>
        </select>
      </div>

      <div
        className="market-summary-section"
        onMouseMove={(e) => {
          const el = overlayRef.current;
          if (!el) return;
          const rect = el.getBoundingClientRect();
          el.style.setProperty("--x", `${e.clientX - rect.left}px`);
          el.style.setProperty("--y", `${e.clientY - rect.top}px`);
        }}
      >
        <div className="market-summary-panels-wrap">
          <div className="market-summary-panels">
            <div className="market-panel top-gainers">
            <h3><span className="dot" /> Top Gainers</h3>
            <ul className="panel-list">
              {topGainers.map((r) => (
                <li key={r.symbol}>
                  <span><strong>{r.symbol}</strong> {r.priceStr}</span>
                  <span className="panel-change gain">{r.changeStr}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="market-panel top-losers">
            <h3><span className="dot" /> Top Losers</h3>
            <ul className="panel-list">
              {topLosers.map((r) => (
                <li key={r.symbol}>
                  <span><strong>{r.symbol}</strong> {r.priceStr}</span>
                  <span className="panel-change loss">{r.changeStr}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="market-panel sector-panel">
            <h3>Sector Distribution</h3>
            <div className="sector-badges">
              {sectors.map(([sec, count]) => (
                <button
                  key={sec}
                  type="button"
                  className={`sector-badge ${sectorFilter === sec ? "active" : ""}`}
                  onClick={() => setSectorFilter(sectorFilter === sec ? "" : sec)}
                >
                  {sec}: {count}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="cards-overlay" ref={overlayRef} aria-hidden="true">
          <div className="overlay-card" />
          <div className="overlay-card" />
          <div className="overlay-card" />
        </div>
        </div>
      </div>

      <div className="market-cards-wrap">
        <div className="market-view-tabs">
          <button
            type="button"
            className={viewMode === "cards" ? "active" : ""}
            onClick={() => setViewMode("cards")}
          >
            Cards
          </button>
          <button
            type="button"
            className={viewMode === "table" ? "active" : ""}
            onClick={() => setViewMode("table")}
          >
            Table (Candlestick)
          </button>
        </div>
        <p className="text-sm text-muted-foreground mb-2">
          Showing {displayedStocks.length} of {sorted.length} stocks
        </p>

        {marketQuery.isLoading && (
          <p className="text-sm text-muted-foreground">Loading market data…</p>
        )}
        {marketQuery.isError && (
          <p className="text-sm text-destructive">Error: {marketQuery.error.message}</p>
        )}
        {marketQuery.data && !marketQuery.data.ok && (
          <p className="text-sm text-muted-foreground">Failed: {marketQuery.data.error}</p>
        )}

        {marketQuery.data?.ok && viewMode === "cards" && (
          <div
            className="market-cards-grid-wrap"
            onMouseMove={(e) => {
              const el = cardsOverlayRef.current;
              if (!el) return;
              const rect = el.getBoundingClientRect();
              el.style.setProperty("--x", `${e.clientX - rect.left}px`);
              el.style.setProperty("--y", `${e.clientY - rect.top}px`);
            }}
          >
            <div className="market-cards-grid">
            {displayedStocks.map((row) => (
              <div
                key={row.symbol}
                className="market-stock-card"
                onClick={() => {
                  setSelectedSymbol(row.symbol);
                  setModalTab("overview");
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && setSelectedSymbol(row.symbol)}
              >
                <div className="card-header">
                  <div>
                    <div className="card-symbol-sector">
                      <span className="card-symbol">{row.symbol}</span>
                      <span className="card-sector">{row.sector}</span>
                    </div>
                    <div className="card-name">{row.name}</div>
                  </div>
                </div>
                <CardSparkline row={row} />
                <div className="card-price-row">
                  <span className="card-price">{row.priceStr}</span>
                  <span className={`card-change ${row.changePercent >= 0 ? "gain" : "loss"}`}>
                    {row.changeStr}
                  </span>
                </div>
                <div className="card-volume">Vol {row.volumeStr}</div>
              </div>
            ))}
            </div>
            <div className="market-cards-overlay" ref={cardsOverlayRef} aria-hidden="true">
              {displayedStocks.map((row) => (
                <div key={row.symbol} className="market-stock-card-overlay" />
              ))}
            </div>
          </div>
        )}

        {marketQuery.data?.ok && viewMode === "table" && (
          <div className="market-table-wrap">
            <table className="market-table">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Name</th>
                  <th>Sector</th>
                  <th>Price</th>
                  <th>Change</th>
                  <th>Volume</th>
                  <th>Daily (Candlestick)</th>
                </tr>
              </thead>
              <tbody>
                {displayedStocks.map((row) => {
                  const open = row.dayLow + (row.dayHigh - row.dayLow) * 0.5;
                  return (
                    <tr
                      key={row.symbol}
                      onClick={() => {
                        setSelectedSymbol(row.symbol);
                        setModalTab("overview");
                      }}
                    >
                      <td className="td-symbol">{row.symbol}</td>
                      <td>{row.name}</td>
                      <td>{row.sector}</td>
                      <td>{row.priceStr}</td>
                      <td className={`td-change ${row.changePercent >= 0 ? "gain" : "loss"}`}>
                        {row.changeStr}
                      </td>
                      <td>{row.volumeStr}</td>
                      <td>
                        <MiniCandlestick
                          open={open}
                          high={row.dayHigh}
                          low={row.dayLow}
                          close={row.price}
                          gain={row.changePercent >= 0}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {marketQuery.data?.ok && sorted.length >= 2 && (
          <div className="market-stocks-see-more-wrap">
            <button
              type="button"
              className="market-stocks-see-more-btn"
              onClick={() => setShowAllStocks((v) => !v)}
            >
              {showAllStocks ? "See less" : `See more (${sorted.length - displayedStocks.length} more)`}
            </button>
          </div>
        )}

        <section className="market-see-more">
          <h2 className="market-see-more-title">News</h2>
          <p className="market-see-more-subtitle">Latest news for {newsSymbol}</p>
          <div className="market-news-carousel-wrap">
            <div className="market-news-carousel">
              {newsQuery.isLoading && (
                <p className="market-news-loading">Loading news…</p>
              )}
              {!newsQuery.isLoading && newsItems.length === 0 && (
                <p className="market-news-empty">No news items right now.</p>
              )}
              {!newsQuery.isLoading &&
                newsItems.map((item) => (
                  <a
                    key={item.link}
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="market-news-card"
                  >
                    <span className="market-news-card-title">{item.title}</span>
                    <span className="market-news-card-meta">
                      {item.source} · {item.published}
                    </span>
                  </a>
                ))}
            </div>
          </div>
        </section>
      </div>

      {selectedSymbol && (
        <StockModal
          symbol={selectedSymbol}
          row={selectedRow ?? undefined}
          history={historyData}
          historyLoading={historyQuery.isLoading}
          onClose={() => setSelectedSymbol(null)}
          tab={modalTab}
          onTab={setModalTab}
        />
      )}
    </div>
  );
}

const CHART_PERIOD_LABELS: Record<ChartPeriod, string> = {
  "1D": "1D",
  "1W": "1W",
  "1M": "1M",
  "3M": "3M",
  "1Y": "1Y",
  ALL: "All",
};

function StockModal({
  symbol,
  row,
  history,
  historyLoading,
  onClose,
  tab,
  onTab,
}: {
  symbol: string;
  row: MarketRow | undefined;
  history: OHLC[];
  historyLoading: boolean;
  onClose: () => void;
  tab: string;
  onTab: (t: "overview" | "chart" | "stats") => void;
}) {
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>("3M");
  const [chartThemeMode, setChartThemeMode] = useState<"light" | "dark">("dark");
  const [isChartFullscreen, setIsChartFullscreen] = useState(false);
  const [chartFullscreenHeight, setChartFullscreenHeight] = useState(400);

  useEffect(() => {
    if (!isChartFullscreen) return;
    const updateHeight = () => setChartFullscreenHeight(window.innerHeight - 72);
    updateHeight();
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, [isChartFullscreen]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isChartFullscreen) setIsChartFullscreen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isChartFullscreen]);

  const filteredHistory = useMemo(
    () => filterHistoryByPeriod(history, chartPeriod),
    [history, chartPeriod]
  );

  const winDays = useMemo(() => {
    let count = 0;
    for (let i = 1; i < history.length; i++) {
      if (history[i].close > history[i - 1].close) count++;
    }
    return count;
  }, [history]);
  const lossDays = history.length > 1 ? history.length - 1 - winDays : 0;
  const winRate = history.length > 1 ? (winDays / (history.length - 1)) * 100 : 0;
  const return90 = history.length >= 2
    ? ((history[history.length - 1].close - history[0].close) / history[0].close) * 100
    : 0;

  const periodSelector = (
    <div className="market-period-selector">
      {(["1D", "1W", "1M", "3M", "1Y", "ALL"] as const).map((p) => (
        <button
          key={p}
          type="button"
          className={`market-period-btn ${chartPeriod === p ? "active" : ""}`}
          onClick={() => setChartPeriod(p)}
        >
          {CHART_PERIOD_LABELS[p]}
        </button>
      ))}
    </div>
  );

  const chartThemeToggle = (
    <div className="market-chart-theme-toggle-wrap">
      <span className="market-chart-theme-label">Chart:</span>
      <button
        type="button"
        className="market-chart-theme-toggle"
        role="switch"
        aria-checked={chartThemeMode === "dark"}
        aria-label="Chart theme"
        title={chartThemeMode === "dark" ? "Dark mode (click for light)" : "Light mode (click for dark)"}
        onClick={() => setChartThemeMode((m) => (m === "dark" ? "light" : "dark"))}
      >
        <span className="market-chart-theme-toggle-label">Light</span>
        <span className="market-chart-theme-toggle-track">
          <span className={`market-chart-theme-toggle-thumb ${chartThemeMode === "dark" ? "dark" : "light"}`} />
        </span>
        <span className="market-chart-theme-toggle-label">Dark</span>
      </button>
    </div>
  );

  return (
    <div className="market-modal-backdrop" onClick={onClose} role="presentation">
      <div className="market-modal" onClick={(e) => e.stopPropagation()} role="dialog">
        <div className="modal-header">
          <div className="modal-title-wrap">
            <div className="modal-symbol">
              {symbol}
              {row && <span className="card-sector" style={{ marginLeft: 8 }}>{row.sector}</span>}
            </div>
            {row && (
              <div style={{ marginTop: 4, fontSize: "0.875rem", color: "var(--market-muted)" }}>
                {row.name}
              </div>
            )}
            {row && (
              <div style={{ marginTop: 8 }}>
                <span style={{ fontSize: "1.5rem", fontWeight: 700 }}>{row.priceStr}</span>
                <span className={row.changePercent >= 0 ? "market-gain" : "market-loss"} style={{ marginLeft: 8 }}>
                  {row.changeStr}
                </span>
              </div>
            )}
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="modal-tabs">
          <button type="button" className={tab === "overview" ? "active" : ""} onClick={() => onTab("overview")}>
            Overview
          </button>
          <button type="button" className={tab === "chart" ? "active" : ""} onClick={() => onTab("chart")}>
            Price Chart
          </button>
          <button type="button" className={tab === "stats" ? "active" : ""} onClick={() => onTab("stats")}>
            Statistics
          </button>
        </div>

        <div className="modal-body">
          {tab === "overview" && (
            <>
              <div className="win-loss-cards">
                <div className="win-loss-card">
                  <div className="label">Win Days</div>
                  <div className="value gain">{winDays}</div>
                </div>
                <div className="win-loss-card">
                  <div className="label">Loss Days</div>
                  <div className="value loss">{lossDays}</div>
                </div>
                <div className="win-loss-card">
                  <div className="label">Win Rate</div>
                  <div className="value">{isNaN(winRate) ? "—" : `${winRate.toFixed(1)}%`}</div>
                </div>
                <div className="win-loss-card">
                  <div className="label">90d Return</div>
                  <div className={return90 >= 0 ? "value gain" : "value loss"}>
                    {history.length < 2 ? "—" : `${return90 >= 0 ? "+" : ""}${return90.toFixed(2)}%`}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2" style={{ marginBottom: 8 }}>
                <h4 style={{ fontSize: "0.875rem", margin: 0 }}>Price History</h4>
                <div className="flex flex-wrap items-center gap-3">
                  {chartThemeToggle}
                  {periodSelector}
                </div>
              </div>
              <div className="chart-container">
                {historyLoading && <p className="text-sm text-muted-foreground">Loading chart…</p>}
                {!historyLoading && filteredHistory.length > 0 && (
                  <TradingViewCandlestickChart
                    data={filteredHistory}
                    themeMode={chartThemeMode}
                    symbol={symbol}
                    periodLabel={CHART_PERIOD_LABELS[chartPeriod]}
                  />
                )}
                {!historyLoading && filteredHistory.length === 0 && (
                  <p className="text-sm text-muted-foreground">No history data for this period.</p>
                )}
              </div>
              {row && (
                <div className="stats-grid">
                  <div className="stat-item">
                    <span className="stat-label">Market Cap </span>
                    <span className="stat-value">{row.marketCapStr}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Volume </span>
                    <span className="stat-value">{row.volumeStr}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">52W High </span>
                    <span className="stat-value">{row.fiftyTwoWeekHigh.toFixed(2)}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">52W Low </span>
                    <span className="stat-value">{row.fiftyTwoWeekLow.toFixed(2)}</span>
                  </div>
                </div>
              )}
            </>
          )}

          {tab === "chart" && (
            <>
              <div className="market-period-selector-wrap flex flex-wrap items-center gap-3">
                {chartThemeToggle}
                {periodSelector}
                {!historyLoading && filteredHistory.length > 0 && (
                  <button
                    type="button"
                    className="market-chart-fullscreen-btn"
                    onClick={() => setIsChartFullscreen(true)}
                    title="Full screen"
                    aria-label="Full screen chart"
                  >
                    <Maximize2 className="size-4" />
                    <span>Full screen</span>
                  </button>
                )}
              </div>
              {!isChartFullscreen && (
                <div className="chart-container">
                  {historyLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
                  {!historyLoading && filteredHistory.length > 0 && (
                    <TradingViewCandlestickChart
                      data={filteredHistory}
                      themeMode={chartThemeMode}
                      symbol={symbol}
                      periodLabel={CHART_PERIOD_LABELS[chartPeriod]}
                    />
                  )}
                  {!historyLoading && filteredHistory.length === 0 && (
                    <p className="text-sm text-muted-foreground">No data for this period.</p>
                  )}
                </div>
              )}
            </>
          )}

          {tab === "chart" && isChartFullscreen && (
            <div className="chart-fullscreen-overlay" role="dialog" aria-label="Chart full screen">
              <div className="chart-fullscreen-toolbar">
                <span className="chart-fullscreen-title">{symbol} – {CHART_PERIOD_LABELS[chartPeriod]}</span>
                <div className="chart-fullscreen-controls">
                  {chartThemeToggle}
                  {periodSelector}
                  <button
                    type="button"
                    className="market-chart-fullscreen-btn"
                    onClick={() => setIsChartFullscreen(false)}
                    title="Exit full screen"
                    aria-label="Exit full screen"
                  >
                    <Minimize2 className="size-4" />
                    <span>Exit full screen</span>
                  </button>
                </div>
              </div>
              <div className="chart-fullscreen-chart">
                {!historyLoading && filteredHistory.length > 0 && (
                  <TradingViewCandlestickChart
                    data={filteredHistory}
                    themeMode={chartThemeMode}
                    height={chartFullscreenHeight}
                    symbol={symbol}
                    periodLabel={CHART_PERIOD_LABELS[chartPeriod]}
                  />
                )}
              </div>
            </div>
          )}

          {tab === "stats" && row && (
            <div className="stats-grid" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
              <div className="stat-item">
                <span className="stat-label">Market Cap</span>
                <span className="stat-value">{row.marketCapStr}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Volume</span>
                <span className="stat-value">{row.volumeStr}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">52-Week High</span>
                <span className="stat-value">{row.fiftyTwoWeekHigh.toFixed(2)}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">52-Week Low</span>
                <span className="stat-value">{row.fiftyTwoWeekLow.toFixed(2)}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Day High</span>
                <span className="stat-value">{row.dayHigh.toFixed(2)}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Day Low</span>
                <span className="stat-value">{row.dayLow.toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

