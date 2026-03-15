/**
 * Subtle educational hint: optional static text + optional AI insight.
 * Use next to labels/terms so users can learn without leaving the page.
 */
import { useState, useRef, useEffect } from "react";
import { Info, Sparkles } from "lucide-react";
import { env } from "@pi/env/web";
import { getShortInsight } from "@/lib/stockAnalysis";

export type InsightTriggerProps = {
  /** Short static explanation (shown first; works without API key). */
  hint?: string;
  /** Topic for AI (e.g. "market cap", "gainers vs losers"). */
  topic?: string;
  /** Optional context for the AI. */
  context?: string;
  /** Accessible label. */
  ariaLabel?: string;
};

export function InsightTrigger({
  hint,
  topic,
  context,
  ariaLabel = "Learn more",
}: InsightTriggerProps) {
  const [open, setOpen] = useState(false);
  const [aiText, setAiText] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const fetchInsight = async () => {
    if (!topic) return;
    const apiKey = env.VITE_GEMINI_API_KEY?.trim();
    if (!apiKey) {
      setAiError("API key not set");
      return;
    }
    setAiLoading(true);
    setAiError(null);
    setAiText(null);
    try {
      const result = await getShortInsight(apiKey, topic, context);
      if ("error" in result && result.error) {
        setAiError(result.message);
      } else if ("text" in result) {
        setAiText(result.text);
      }
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="relative inline-flex align-middle" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted-foreground/70 hover:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={ariaLabel}
        aria-expanded={open}
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div
          className="absolute left-0 top-full z-50 mt-1.5 w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-popover p-3 text-left text-sm text-popover-foreground shadow-md"
          role="dialog"
          aria-label={ariaLabel}
        >
          {hint && <p className="text-muted-foreground">{hint}</p>}
          {topic && (
            <div className="mt-2">
              {!aiText && !aiLoading && !aiError && (
                <button
                  type="button"
                  onClick={fetchInsight}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-accent-foreground hover:underline"
                >
                  <Sparkles className="h-3 w-3" />
                  Get AI insight
                </button>
              )}
              {aiLoading && (
                <p className="text-xs text-muted-foreground">Thinking…</p>
              )}
              {aiError && (
                <p className="text-xs text-destructive">{aiError}</p>
              )}
              {aiText && (
                <p className="text-muted-foreground">{aiText}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
