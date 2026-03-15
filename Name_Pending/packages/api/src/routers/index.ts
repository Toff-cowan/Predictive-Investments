import * as child_process from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { z } from "zod";
import { publicProcedure, router } from "../index";

export type OHLC = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

export type MarketRow = {
  symbol: string;
  name: string;
  price: number;
  priceStr: string;
  changePercent: number;
  changeStr: string;
  volume: number;
  volumeStr: string;
  marketCap: number;
  marketCapStr: string;
  dayHigh: number;
  dayLow: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  sector: string;
  exchange: string;
};

export type MarketScrapeResult =
  | {
      ok: true;
      source: string;
      scrapedAt: string;
      rows: MarketRow[];
      totalMarketCap: number;
    }
  | {
      ok: false;
      source: string;
      scrapedAt: string;
      error: string;
    };

function findYahooOutputDir(): string {
  try {
    const cwd = process.cwd();
    const candidates = [
      path.join(cwd, "scripts", "yahoo_top_100_output"),
      path.join(cwd, "server", "scripts", "yahoo_top_100_output"),
      path.join(cwd, "Name_Pending", "server", "scripts", "yahoo_top_100_output"),
      path.join(__dirname, "..", "..", "..", "..", "server", "scripts", "yahoo_top_100_output"),
      path.join(__dirname, "..", "..", "..", "..", "Name_Pending", "server", "scripts", "yahoo_top_100_output"),
    ];
    // Prefer a directory that actually has our data (summary or history CSVs)
    for (const p of candidates) {
      try {
        const resolved = path.resolve(p);
        if (!fs.existsSync(resolved)) continue;
        const summaryPath = path.join(resolved, "top_100_summary.csv");
        if (fs.existsSync(summaryPath)) return resolved;
        const entries = fs.readdirSync(resolved);
        const hasHistory = entries.some((e) => e.endsWith("_history.csv"));
        if (hasHistory) return resolved;
      } catch {
        /* skip this candidate */
      }
    }
    // Fallback: any candidate directory that exists
    for (const p of candidates) {
      try {
        const resolved = path.resolve(p);
        if (fs.existsSync(resolved)) return resolved;
      } catch {
        /* skip */
      }
    }
    return path.join(cwd, "scripts", "yahoo_top_100_output");
  } catch {
    return path.join(process.cwd(), "scripts", "yahoo_top_100_output");
  }
}

function getSummaryPath(): string {
  return path.join(findYahooOutputDir(), "top_100_summary.csv");
}
function getOutputDir(): string {
  return findYahooOutputDir();
}

/** Path to the predicted CSV for a symbol (yahoo_top_100_output/{SYMBOL}/predicted.csv). */
export function getPredictedCsvPath(symbol: string): string {
  const safe = symbol.replace(/[^A-Z0-9\-]/gi, "").toUpperCase();
  return path.join(getOutputDir(), safe, "predicted.csv");
}

/**
 * Resolve a relative path under the output dir for CSV access. Use with GET /api/csv?path=...
 * Allows only paths like "AAPL/predicted.csv" (no "..", only alphanumeric, hyphen, underscore, slash).
 * Returns null if path is invalid or would escape the output dir.
 */
export function getCsvPathByRelativePath(relativePath: string): string | null {
  const normalized = path.normalize(relativePath).replace(/\\/g, "/");
  if (normalized.startsWith("..") || normalized.includes("/..") || normalized.includes("../")) return null;
  if (!/^[A-Za-z0-9_\-/.]+$/.test(normalized)) return null;
  const outputDir = path.resolve(getOutputDir());
  const fullPath = path.resolve(outputDir, normalized);
  if (!fullPath.startsWith(outputDir + path.sep) && fullPath !== outputDir) return null;
  return fullPath;
}

function parseSummary(): MarketRow[] {
  const summaryPath = getSummaryPath();
  if (!fs.existsSync(summaryPath)) return [];
  const raw = fs.readFileSync(summaryPath, "utf-8");
  const lines = raw.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  const rows: MarketRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, j) => {
      row[h] = values[j] ?? "";
    });
    const currentPrice = parseFloat(row.current_price ?? "0") || 0;
    const dayHigh = parseFloat(row.day_high ?? "0") || currentPrice;
    const dayLow = parseFloat(row.day_low ?? "0") || currentPrice;
    const prevClose = (dayHigh + dayLow) / 2;
    const changePercent =
      prevClose > 0 ? ((currentPrice - prevClose) / prevClose) * 100 : 0;
    const volume = parseInt(row.volume ?? "0", 10) || 0;
    const marketCap = parseFloat(row.market_cap ?? "0") || 0;
    rows.push({
      symbol: row.symbol ?? "",
      name: (row.name ?? "").replace(/^"|"$/g, ""),
      price: currentPrice,
      priceStr: formatPrice(currentPrice),
      changePercent,
      changeStr: `${changePercent >= 0 ? "+" : ""}${changePercent.toFixed(2)}%`,
      volume,
      volumeStr: formatVolume(volume),
      marketCap,
      marketCapStr: formatMarketCap(marketCap),
      dayHigh: parseFloat(row.day_high ?? "0") || 0,
      dayLow: parseFloat(row.day_low ?? "0") || 0,
      fiftyTwoWeekHigh: parseFloat(row.fifty_two_week_high ?? "0") || 0,
      fiftyTwoWeekLow: parseFloat(row.fifty_two_week_low ?? "0") || 0,
      sector: inferSector(row.symbol ?? "", row.name ?? ""),
      exchange: row.exchange ?? "",
    });
  }
  return rows;
}

function parseCSVLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if ((c === "," && !inQuotes) || (c === "\n" && !inQuotes)) {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur.trim());
  return out;
}

function formatPrice(n: number): string {
  return n >= 1 ? n.toFixed(2) : n.toFixed(4);
}
function formatVolume(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return String(n);
}
function formatMarketCap(n: number): string {
  if (n >= 1e12) return (n / 1e12).toFixed(2) + "T";
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
  return String(n);
}

const SECTOR_MAP: Record<string, string> = {
  NVDA: "Technology",
  AAPL: "Technology",
  MSFT: "Technology",
  GOOGL: "Technology",
  META: "Technology",
  AMZN: "Technology",
  AMD: "Technology",
  INTC: "Technology",
  ADBE: "Technology",
  ORCL: "Technology",
  CSCO: "Technology",
  NFLX: "Technology",
  AVGO: "Technology",
  CRM: "Technology",
  PLTR: "Technology",
  MU: "Technology",
  SMCI: "Technology",
  SOUN: "Technology",
  SOFI: "Technology",
  HOOD: "Technology",
  PATH: "Technology",
  SNAP: "Technology",
  PINS: "Technology",
  RGTI: "Technology",
  NVTS: "Technology",
  IBRX: "Technology",
  CIFR: "Technology",
  APLD: "Technology",
  IREN: "Technology",
  CLSK: "Technology",
  MARA: "Technology",
  RIOT: "Technology",
  MSTR: "Technology",
  WULF: "Technology",
  CRWV: "Technology",
  QBTS: "Technology",
  S: "Technology",
  OPEN: "Technology",
  JOBY: "Technology",
  ACHR: "Technology",
  ONDS: "Technology",
  BMNR: "Technology",
  BAC: "Finance",
  JPM: "Finance",
  KEY: "Finance",
  HBAN: "Finance",
  LYG: "Finance",
  ITUB: "Finance",
  BBD: "Finance",
  OWL: "Finance",
  RKT: "Finance",
  UWMC: "Finance",
  PFE: "Healthcare",
  HIMS: "Healthcare",
  XOM: "Energy",
  CVX: "Energy",
  RIG: "Energy",
  BTE: "Energy",
  HAL: "Energy",
  FCX: "Energy",
  PR: "Energy",
  ET: "Energy",
  PBR: "Energy",
  "PBR-A": "Energy",
  VALE: "Energy",
  CLF: "Energy",
  PTEN: "Energy",
  CNH: "Energy",
  STLA: "Consumer",
  F: "Consumer",
  NIO: "Consumer",
  RIVN: "Consumer",
  TSLA: "Consumer",
  CCL: "Consumer",
  NCLH: "Consumer",
  CMG: "Consumer",
  KHC: "Consumer",
  CAG: "Consumer",
  CPNG: "Consumer",
  GRAB: "Consumer",
  NU: "Consumer",
  VZ: "Communications",
  T: "Communications",
  CMCSA: "Communications",
  WBD: "Communications",
  PSKY: "Communications",
};
function inferSector(symbol: string, _name: string): string {
  return SECTOR_MAP[symbol] ?? "Other";
}

export type NewsItem = {
  ticker: string;
  title: string;
  link: string;
  source: string;
  published: string;
};

export type PredictionPoint = {
  date: string;
  predictedClose: number;
};

export type PredictionAccuracy = {
  mae: number;
  mape: number;
  backtestDays: number;
};

function findNewsScraperScript(): string | null {
  const cwd = process.cwd();
  const candidates = [
    path.join(cwd, "scripts", "news_scraper.py"),
    path.join(cwd, "server", "scripts", "news_scraper.py"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function findPredictScript(): string | null {
  const cwd = process.cwd();
  const candidates = [
    path.join(cwd, "scripts", "predict_stock.py"),
    path.join(cwd, "server", "scripts", "predict_stock.py"),
    path.join(cwd, "Name_Pending", "server", "scripts", "predict_stock.py"),
    path.join(__dirname, "..", "..", "..", "..", "server", "scripts", "predict_stock.py"),
    path.join(__dirname, "..", "..", "..", "..", "Name_Pending", "server", "scripts", "predict_stock.py"),
  ];
  for (const p of candidates) {
    const resolved = path.resolve(p);
    if (fs.existsSync(resolved)) return resolved;
  }
  return null;
}

function runStockPredict(
  ticker: string,
  forecastDays: number
): Promise<{ predictions: PredictionPoint[]; accuracy: PredictionAccuracy | null; error?: string }> {
  return new Promise((resolve) => {
    const scriptPath = findPredictScript();
    if (!scriptPath) {
      resolve({
        predictions: [],
        accuracy: null,
        error: "Prediction script not found. Looked for predict_stock.py in scripts/ and server/scripts/.",
      });
      return;
    }
    const py = process.platform === "win32" ? "python" : "python3";
    const proc = child_process.spawn(py, [scriptPath, ticker, String(forecastDays)], {
      cwd: path.dirname(path.dirname(scriptPath)),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    proc.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf-8");
    });
    proc.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf-8");
    });
    proc.on("error", (err) => {
      resolve({
        predictions: [],
        accuracy: null,
        error: `Failed to run Python: ${err.message}. Is Python installed?`,
      });
    });
    proc.on("close", (code) => {
      const pickError = (): string | undefined => {
        if (stderr.trim()) return stderr.trim();
        if (code !== 0) return `Script exited with code ${code}.`;
        return undefined;
      };
      if (code !== 0) {
        try {
          const errJson = JSON.parse(stderr.trim()) as { error?: string };
          resolve({
            predictions: [],
            accuracy: null,
            error: errJson.error ?? pickError(),
          });
          return;
        } catch {
          resolve({ predictions: [], accuracy: null, error: pickError() });
          return;
        }
      }
      try {
        const parsed = JSON.parse(stdout.trim()) as unknown;
        let predictions: PredictionPoint[] = [];
        let accuracy: PredictionAccuracy | null = null;
        if (Array.isArray(parsed)) {
          predictions = (parsed as unknown[]).filter(
            (x): x is PredictionPoint =>
              x != null &&
              typeof x === "object" &&
              typeof (x as PredictionPoint).date === "string" &&
              typeof (x as PredictionPoint).predictedClose === "number"
          );
        } else if (parsed != null && typeof parsed === "object" && Array.isArray((parsed as { predictions?: unknown }).predictions)) {
          const obj = parsed as { predictions: unknown[]; accuracy?: unknown };
          predictions = obj.predictions.filter(
            (x): x is PredictionPoint =>
              x != null &&
              typeof x === "object" &&
              typeof (x as PredictionPoint).date === "string" &&
              typeof (x as PredictionPoint).predictedClose === "number"
          );
          const acc = obj.accuracy;
          if (
            acc != null &&
            typeof acc === "object" &&
            typeof (acc as PredictionAccuracy).mae === "number" &&
            typeof (acc as PredictionAccuracy).mape === "number" &&
            typeof (acc as PredictionAccuracy).backtestDays === "number"
          ) {
            accuracy = acc as PredictionAccuracy;
          }
        }
        if (predictions.length === 0 && stderr.trim()) {
          try {
            const errJson = JSON.parse(stderr.trim()) as { error?: string };
            resolve({ predictions, accuracy, error: errJson.error });
            return;
          } catch {
            resolve({ predictions, accuracy, error: stderr.trim() });
            return;
          }
        }
        resolve({ predictions, accuracy });
      } catch {
        resolve({
          predictions: [],
          accuracy: null,
          error: stderr.trim() || "Invalid JSON from prediction script.",
        });
      }
    });
  });
}

function runNewsScraper(ticker: string, maxItems: number = 15): Promise<NewsItem[]> {
  return new Promise((resolve) => {
    const scriptPath = findNewsScraperScript();
    if (!scriptPath) {
      resolve([]);
      return;
    }
    const py = process.platform === "win32" ? "python" : "python3";
    const proc = child_process.spawn(py, [scriptPath, ticker, String(maxItems)], {
      cwd: path.dirname(path.dirname(scriptPath)),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    proc.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf-8");
    });
    proc.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf-8");
    });
    proc.on("error", () => resolve([]));
    proc.on("close", (code) => {
      if (code !== 0) {
        resolve([]);
        return;
      }
      try {
        const parsed = JSON.parse(stdout.trim()) as unknown;
        const arr = Array.isArray(parsed) ? parsed : [];
        resolve(
          arr.filter(
            (x): x is NewsItem =>
              x != null &&
              typeof x === "object" &&
              typeof (x as NewsItem).title === "string" &&
              typeof (x as NewsItem).link === "string"
          )
        );
      } catch {
        resolve([]);
      }
    });
  });
}

function getAvailableHistorySymbols(): string[] {
  try {
    const dir = getOutputDir();
    if (!fs.existsSync(dir)) return [];
    const entries = fs.readdirSync(dir);
    const symbols = entries
      .filter((e) => e.endsWith("_history.csv"))
      .map((e) => e.replace(/_history\.csv$/i, ""));
    return symbols.filter((s) => s.length > 0).sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

export const appRouter = router({
  healthCheck: publicProcedure.query(() => {
    return "OK";
  }),
  /** Diagnostic: what path the server is using and whether data files exist. Call from browser or API client to debug "data not listing". */
  getDataStatus: publicProcedure.query(() => {
    try {
      const cwd = process.cwd();
      const outputDir = getOutputDir();
      const summaryPath = getSummaryPath();
      const summaryExists = fs.existsSync(summaryPath);
      let historyCount = 0;
      let sampleSymbols: string[] = [];
      try {
        if (fs.existsSync(outputDir)) {
          const entries = fs.readdirSync(outputDir);
          historyCount = entries.filter((e) => e.endsWith("_history.csv")).length;
          sampleSymbols = getAvailableHistorySymbols().slice(0, 10);
        }
      } catch {
        /* ignore */
      }
      return {
        cwd,
        outputDir,
        summaryPath,
        summaryExists,
        historyCount,
        sampleSymbols,
        hint: !summaryExists && historyCount === 0
          ? "Run the server from the repo root (or the folder that contains server/scripts/yahoo_top_100_output). Ensure top_100_summary.csv and *_history.csv exist there, or run the market scrape first."
          : undefined,
      };
    } catch (err) {
      return {
        cwd: process.cwd(),
        outputDir: "(failed to resolve)",
        summaryPath: "(failed to resolve)",
        summaryExists: false,
        historyCount: 0,
        sampleSymbols: [],
        hint: err instanceof Error ? err.message : String(err),
      };
    }
  }),
  getAvailableSymbols: publicProcedure.query(async (): Promise<{ ok: true; symbols: string[] } | { ok: false; error: string }> => {
    try {
      const symbols = getAvailableHistorySymbols();
      return { ok: true, symbols };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }),
  getMarketData: publicProcedure.query(async (): Promise<MarketScrapeResult> => {
    try {
      const rows = parseSummary();
      const totalMarketCap = rows.reduce((s, r) => s + r.marketCap, 0);
      return {
        ok: true,
        source: getSummaryPath(),
        scrapedAt: new Date().toISOString(),
        rows,
        totalMarketCap,
      };
    } catch (err) {
      return {
        ok: false,
        source: "",
        scrapedAt: new Date().toISOString(),
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }),
  getStockHistory: publicProcedure
    .input(z.object({ symbol: z.string().min(1).max(12).regex(/^[A-Z0-9\-]+$/i) }))
    .query(async ({ input }): Promise<{ ok: true; data: OHLC[] } | { ok: false; error: string }> => {
      try {
        const safeSymbol = input.symbol.replace(/[^A-Z0-9\-]/gi, "");
        const csvPath = path.join(getOutputDir(), `${safeSymbol}_history.csv`);
        if (!fs.existsSync(csvPath)) {
          return { ok: false, error: "History not found" };
        }
        const raw = fs.readFileSync(csvPath, "utf-8");
        const lines = raw.trim().split(/\r?\n/);
        if (lines.length < 2) return { ok: true, data: [] };
        const data: OHLC[] = [];
        for (let i = 1; i < lines.length; i++) {
          const parts = parseCSVLine(lines[i]);
          const date = parts[0]?.split(" ")[0] ?? "";
          const open = parseFloat(parts[1] ?? "0") || 0;
          const high = parseFloat(parts[2] ?? "0") || 0;
          const low = parseFloat(parts[3] ?? "0") || 0;
          const close = parseFloat(parts[4] ?? "0") || 0;
          const vol = parseInt(parts[6] ?? "0", 10) || 0;
          if (date) data.push({ date, open, high, low, close, volume: vol });
        }
        return { ok: true, data };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }),
  getStockNews: publicProcedure
    .input(z.object({ symbol: z.string().min(1).max(12).regex(/^[A-Z0-9\-]+$/i) }))
    .query(async ({ input }): Promise<{ ok: true; items: NewsItem[] } | { ok: false; error: string }> => {
      try {
        const ticker = input.symbol.replace(/[^A-Z0-9\-]/gi, "").toUpperCase();
        const items = await runNewsScraper(ticker, 20);
        return { ok: true, items };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }),
  getStockPrediction: publicProcedure
    .input(
      z.object({
        symbol: z.string().min(1).max(12).regex(/^[A-Z0-9\-]+$/i),
        forecastDays: z.number().min(1).max(90).default(10),
      })
    )
    .query(
      async ({
        input,
      }): Promise<
        | { ok: true; predictions: PredictionPoint[]; accuracy: PredictionAccuracy | null }
        | { ok: false; error: string }
      > => {
        try {
          const ticker = input.symbol.replace(/[^A-Z0-9\-]/gi, "").toUpperCase();
          const { predictions, accuracy, error: scriptError } = await runStockPredict(
            ticker,
            input.forecastDays
          );
          if (scriptError) {
            return { ok: false, error: scriptError };
          }
          return { ok: true, predictions, accuracy };
        } catch (err) {
          return {
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      }
    ),
});
export type AppRouter = typeof appRouter;
