/**
 * ChatGPT-style input bar for the Lab: ticker query + send button.
 */
import { useState, useCallback } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@pi/ui/components/button";
import { Input } from "@pi/ui/components/input";

const PLACEHOLDER = "Ask anything: tips, list stocks, analyze AAPL, compare AAPL and MSFT…";
const SUPPORT_TEXT = "AI predictions are not financial advice";

const STOP_WORDS = /^(I|A|AN|WE|IT|DO|BE|SO|ON|AT|HE|ME|MY|UP|GO|NO|OR|AS|TO|OF|IN|IS|BY|FOR)$/;

/** Keywords: treated as commands, not tickers, unless typed in ALL CAPS. */
const KEYWORD_TICKER_LOOKALIKES = new Set(["TIPS", "COMPARE", "LIST"]);

/** True if the word appears in original text in all-caps form (so we treat it as a ticker). */
function isWordAllCapsIn(original: string, wordUpper: string): boolean {
  const escaped = wordUpper.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`\\b(${escaped})\\b`, "i");
  const m = original.match(re);
  if (!m) return false;
  const actual = m[1]!;
  return actual === actual.toUpperCase() && actual.length > 0;
}

/** Extracts a single ticker symbol from natural language input. */
export function parseTickerFromInput(input: string): string | null {
  const tickers = parseTickersFromInput(input);
  return tickers.length > 0 ? tickers[tickers.length - 1]! : null;
}

/** Extracts all ticker-like symbols (e.g. "Compare AAPL and MSFT" -> ["AAPL", "MSFT"]). Keywords "tips", "compare", "list" are not treated as tickers unless typed in ALL CAPS. */
export function parseTickersFromInput(input: string): string[] {
  const trimmed = input.trim();
  if (!trimmed) return [];
  const upper = trimmed.toUpperCase();
  const tickerPattern = /\b([A-Z]{1,5}(?:\.[A-Z]+)?)\b/g;
  const matches = upper.match(tickerPattern) ?? [];
  const candidates = matches.filter(
    (m) =>
      m.length >= 2 &&
      m.length <= 5 &&
      !STOP_WORDS.test(m)
  );
  const filtered = candidates.filter((m) => {
    if (KEYWORD_TICKER_LOOKALIKES.has(m) && !isWordAllCapsIn(trimmed, m)) return false;
    return true;
  });
  const seen = new Set<string>();
  return filtered.filter((m) => {
    if (seen.has(m)) return false;
    seen.add(m);
    return true;
  });
}

export interface AnalysisInputProps {
  /** Called with the raw user message. Lab parses tickers and routes to analyze / general / compare. */
  onSubmit: (userMessage: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function AnalysisInput({
  onSubmit,
  disabled = false,
  placeholder = PLACEHOLDER,
}: AnalysisInputProps) {
  const [value, setValue] = useState("");

  const handleSubmit = useCallback(() => {
    const rawMessage = value.trim();
    if (!rawMessage) return;
    // eslint-disable-next-line no-console
    console.log("[Lab] Submit", { rawInput: rawMessage, disabled });
    onSubmit(rawMessage);
    setValue("");
  }, [value, disabled, onSubmit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        // eslint-disable-next-line no-console
        console.log("[Lab] Enter key pressed in AnalysisInput");
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="relative flex items-center rounded-full border border-input bg-background px-4 py-2 shadow-sm focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
        <Input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="min-h-12 flex-1 border-0 bg-transparent pr-12 focus-visible:ring-0 focus-visible:ring-offset-0"
          aria-label="Stock ticker or question"
        />
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="absolute right-2 h-9 w-9 rounded-full"
          onClick={handleSubmit}
          disabled={disabled || !value.trim()}
          aria-label="Send"
        >
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        {SUPPORT_TEXT}
      </p>
    </div>
  );
}
