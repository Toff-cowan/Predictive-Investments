/**
 * ChatGPT-style input bar for the Lab: ticker query + send button.
 */
import { useState, useCallback } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@pi/ui/components/button";
import { Input } from "@pi/ui/components/input";

const PLACEHOLDER = "Ask about a stock... e.g. Analyze AAPL";
const SUPPORT_TEXT = "AI predictions are not financial advice";

/** Extracts a ticker symbol from natural language input (e.g. "Analyze AAPL" -> "AAPL", "What about TSLA?" -> "TSLA"). */
export function parseTickerFromInput(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const upper = trimmed.toUpperCase();
  const tickerPattern = /\b([A-Z]{1,5}(?:\.[A-Z]+)?)\b/g;
  const matches = upper.match(tickerPattern);
  if (matches && matches.length > 0) {
    const candidates = matches.filter((m) => m.length >= 2 && m.length <= 5 && !/^(I|A|AN|WE|IT|DO|BE|SO|ON|AT|HE|ME|MY|UP|GO|NO|OR|AS|TO|OF|IN|IS|BY|FOR)$/.test(m));
    const preferred = candidates.length > 0 ? candidates[candidates.length - 1]! : matches[0]!;
    return preferred ?? null;
  }
  if (/^[A-Za-z]{1,5}(\.[A-Za-z]+)?$/.test(trimmed)) return trimmed.toUpperCase();
  return null;
}

export interface AnalysisInputProps {
  onSubmit: (ticker: string) => void;
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
    // Log every submit attempt so we can see when the button is pressed
    // and whether the ticker parsing succeeds.
    // eslint-disable-next-line no-console
    console.log("[Lab] Analyze button pressed", {
      rawInput: value,
      disabled,
    });
    const ticker = parseTickerFromInput(value);
    // eslint-disable-next-line no-console
    console.log("[Lab] Parsed ticker", { rawInput: value, ticker });
    if (ticker) {
      onSubmit(ticker);
      setValue("");
    }
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
          aria-label="Analyze"
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
