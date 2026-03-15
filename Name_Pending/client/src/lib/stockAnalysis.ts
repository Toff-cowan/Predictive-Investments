/**
 * Stock Analysis & Prediction Engine — data processing and Gemini AI integration.
 * Builds a structured prompt from price/financials/news and calls Gemini for prediction.
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import type {
  PriceData,
  PriceDataPoint,
  FinancialsData,
  NewsData,
  NewsDataItem,
  StockPrediction,
  StockPredictionError,
} from "@/types/stock";

/** OHLC shape from API (getStockHistory). */
interface OHLCLike {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

/**
 * Derives PriceData from OHLC history and optional current price / change.
 * Computes 1d/7d/30d % change, simple RSI (14), and recent support/resistance.
 */
export function derivePriceDataFromOhlc(
  ticker: string,
  ohlc: OHLCLike[],
  options?: { currentPrice?: number; changePercent?: number }
): PriceData {
  const ohlcv: PriceDataPoint[] = ohlc.map((d) => ({
    date: d.date,
    open: d.open,
    high: d.high,
    low: d.low,
    close: d.close,
    volume: d.volume,
  }));
  const sorted = [...ohlc].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  const currentPrice =
    options?.currentPrice ?? (sorted.length > 0 ? sorted[sorted.length - 1].close : 0);
  const n = sorted.length;

  let change1d: number | undefined;
  let change7d: number | undefined;
  let change30d: number | undefined;
  if (n >= 2) {
    const prev1 = sorted[n - 2].close;
    change1d = prev1 ? ((currentPrice - prev1) / prev1) * 100 : undefined;
  }
  if (n >= 8) {
    const prev7 = sorted[n - 8].close;
    change7d = prev7 ? ((currentPrice - prev7) / prev7) * 100 : undefined;
  }
  if (n >= 31) {
    const prev30 = sorted[n - 31].close;
    change30d = prev30 ? ((currentPrice - prev30) / prev30) * 100 : undefined;
  }

  const closes = sorted.map((d) => d.close);
  let rsi: number | undefined;
  let rsiSignal: "overbought" | "oversold" | "neutral" | undefined;
  if (closes.length >= 15) {
    const period = 14;
    const recent = closes.slice(-(period + 1));
    let gains = 0;
    let losses = 0;
    for (let i = 1; i < recent.length; i++) {
      const diff = recent[i]! - recent[i - 1]!;
      if (diff > 0) gains += diff;
      else losses -= diff;
    }
    const avgGain = gains / period;
    const avgLoss = losses / period;
    if (avgLoss === 0) rsi = 100;
    else rsi = 100 - 100 / (1 + avgGain / avgLoss);
    if (rsi >= 70) rsiSignal = "overbought";
    else if (rsi <= 30) rsiSignal = "oversold";
    else rsiSignal = "neutral";
  }

  const recent = sorted.slice(-30);
  const supportLevel =
    recent.length > 0
      ? Math.min(...recent.map((d) => d.low))
      : undefined;
  const resistanceLevel =
    recent.length > 0
      ? Math.max(...recent.map((d) => d.high))
      : undefined;

  return {
    ticker,
    currentPrice,
    change1dPercent: change1d,
    change7dPercent: change7d,
    change30dPercent: change30d,
    rsi,
    rsiSignal,
    macdSignal: undefined,
    supportLevel,
    resistanceLevel,
    ohlcv,
  };
}

/**
 * Maps API news items to NewsData (top 5, optional sentiment).
 */
export function mapNewsToNewsData(
  ticker: string,
  items: { title: string; link?: string; source: string; published: string }[]
): NewsData {
  const dataItems: NewsDataItem[] = items.slice(0, 10).map((item) => ({
    ticker,
    title: item.title,
    link: item.link,
    source: item.source,
    published: item.published,
  }));
  return {
    ticker,
    items: dataItems,
    overallSentiment: undefined,
    majorEvents: undefined,
  };
}

const GEMINI_SYSTEM_INSTRUCTION = `You are an expert financial analyst AI. You will receive structured data about a stock including price indicators, financial health, and recent news sentiment. Your job is to analyze this data and return a JSON prediction object.

You must ALWAYS respond with valid JSON only — no markdown, no explanation outside the JSON. Use this exact schema:

{
  "ticker": "string",
  "prediction": "BULLISH" | "BEARISH" | "NEUTRAL",
  "confidence": number (0-100),
  "timeframe": "short-term (1-2 weeks)" | "medium-term (1-3 months)",
  "priceTarget": number or null,
  "rationale": {
    "summary": "2-3 sentence plain English summary",
    "technicalFactors": ["array of key technical signals"],
    "fundamentalFactors": ["array of key fundamental signals"],
    "sentimentFactors": ["array of key news/sentiment signals"],
    "risks": ["array of key risks to the prediction"]
  },
  "recommendation": "STRONG BUY" | "BUY" | "HOLD" | "SELL" | "STRONG SELL"
}`;

/**
 * Builds a single well-formatted prompt string from price, financials, and news
 * for injection into the Gemini prediction request.
 */
export function buildAnalysisPrompt(
  ticker: string,
  priceData: PriceData | null,
  financialsData: FinancialsData | null,
  newsData: NewsData | null
): string {
  const sections: string[] = [];

  sections.push(`# Stock analysis request for ${ticker.toUpperCase()}\n`);

  if (priceData) {
    sections.push("## Price & technical summary");
    sections.push(`- Current price: $${priceData.currentPrice.toFixed(2)}`);
    if (priceData.change1dPercent != null)
      sections.push(`- 1-day change: ${priceData.change1dPercent.toFixed(2)}%`);
    if (priceData.change7dPercent != null)
      sections.push(`- 7-day change: ${priceData.change7dPercent.toFixed(2)}%`);
    if (priceData.change30dPercent != null)
      sections.push(`- 30-day change: ${priceData.change30dPercent.toFixed(2)}%`);
    if (priceData.rsi != null)
      sections.push(
        `- RSI: ${priceData.rsi.toFixed(1)} (${priceData.rsiSignal ?? "neutral"})`
      );
    if (priceData.macdSignal) sections.push(`- MACD: ${priceData.macdSignal}`);
    if (priceData.supportLevel != null)
      sections.push(`- Support level: $${priceData.supportLevel.toFixed(2)}`);
    if (priceData.resistanceLevel != null)
      sections.push(
        `- Resistance level: $${priceData.resistanceLevel.toFixed(2)}`
      );
    if (priceData.ohlcv.length > 0) {
      const last = priceData.ohlcv[priceData.ohlcv.length - 1];
      sections.push(
        `- Recent close: $${last.close.toFixed(2)} (${last.date}), volume: ${last.volume ?? "N/A"}`
      );
    }
    sections.push("");
  } else {
    sections.push("## Price & technical summary\nNo price data available.\n");
  }

  if (financialsData) {
    sections.push("## Financials summary");
    if (financialsData.revenueTrend)
      sections.push(`- Revenue trend: ${financialsData.revenueTrend}`);
    if (financialsData.epsTrend)
      sections.push(`- EPS trend: ${financialsData.epsTrend}`);
    if (financialsData.peRatio != null)
      sections.push(`- P/E ratio: ${financialsData.peRatio}`);
    if (financialsData.sectorPeAverage != null)
      sections.push(
        `- Sector P/E average: ${financialsData.sectorPeAverage} (vs company ${financialsData.peRatio ?? "N/A"})`
      );
    if (financialsData.debtToEquity != null)
      sections.push(`- Debt-to-equity: ${financialsData.debtToEquity}`);
    if (
      financialsData.redFlags &&
      Array.isArray(financialsData.redFlags) &&
      financialsData.redFlags.length > 0
    )
      sections.push(
        `- Red flags: ${financialsData.redFlags.join("; ")}`
      );
    sections.push("");
  } else {
    sections.push("## Financials summary\nNo financial data available.\n");
  }

  if (newsData && newsData.items && newsData.items.length > 0) {
    sections.push("## News & sentiment");
    if (newsData.overallSentiment)
      sections.push(`- Overall sentiment: ${newsData.overallSentiment}`);
    if (
      newsData.majorEvents &&
      Array.isArray(newsData.majorEvents) &&
      newsData.majorEvents.length > 0
    )
      sections.push(`- Major events: ${newsData.majorEvents.join("; ")}`);
    sections.push("Top headlines:");
    const top5 = newsData.items.slice(0, 5);
    top5.forEach((item, i) => {
      sections.push(
        `  ${i + 1}. ${item.title} (${item.source}, ${item.published})`
      );
    });
    sections.push("");
  } else {
    sections.push("## News & sentiment\nNo news data available.\n");
  }

  sections.push(
    "Based on the above, return only the JSON prediction object as specified."
  );
  return sections.join("\n");
}

/**
 * Sends the structured prompt to Gemini and returns the parsed prediction object.
 * Uses model gemini-2.5-flash (gemini-1.5-flash is deprecated). Requires VITE_GEMINI_API_KEY to be set.
 */
export async function getStockPrediction(
  apiKey: string,
  ticker: string,
  promptPayload: string
): Promise<StockPrediction | StockPredictionError> {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: GEMINI_SYSTEM_INSTRUCTION,
    });

    const result = await model.generateContent(promptPayload);
    const response = result.response;
    const text = response.text();
    if (!text || !text.trim()) {
      return {
        error: true,
        message: "Empty response from AI",
      };
    }

    const cleaned = text
      .replace(/^```json\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();
    const parsed = JSON.parse(cleaned) as StockPrediction;

    if (!parsed.ticker || !parsed.prediction || typeof parsed.confidence !== "number") {
      return {
        error: true,
        message: "Invalid prediction schema from AI",
      };
    }

    return parsed;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown error calling Gemini";
    return {
      error: true,
      message: message.includes("API key") ? "Invalid or missing Gemini API key" : message,
    };
  }
}

/** System instruction for general Q&A (tips, list stocks, etc.). */
const GENERAL_ASSISTANT_INSTRUCTION = `You are a helpful financial assistant for a stock analysis app. The user may ask for:
- Tips or general investing advice
- A list of stocks we track (you will receive context with symbols and names)
- Comparison of two or more stocks (you will receive data for each)
- General market questions

Answer in clear, concise plain text. Use short paragraphs and bullet points where helpful. Do not use markdown code blocks for long output. Never recommend specific buy/sell actions; give educational context only. If the user asks to list stocks, present the list clearly from the context provided.`;

/**
 * Sends a free-form question and optional context to Gemini; returns plain text.
 * Used for tips, listing stocks, and stock comparisons.
 */
export async function getGeneralResponse(
  apiKey: string,
  userMessage: string,
  context?: string
): Promise<{ text: string } | StockPredictionError> {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: GENERAL_ASSISTANT_INSTRUCTION,
    });

    const prompt = context
      ? `Context (use this to answer):\n${context}\n\nUser question: ${userMessage}`
      : userMessage;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();
    if (!text || !text.trim()) {
      return { error: true, message: "Empty response from AI" };
    }
    return { text: text.trim() };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown error calling Gemini";
    return {
      error: true,
      message: message.includes("API key") ? "Invalid or missing Gemini API key" : message,
    };
  }
}
