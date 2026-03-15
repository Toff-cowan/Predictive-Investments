/**
 * Chart UI – Recharts container, tooltip, and legend (reference design).
 * Use with Recharts for actual vs predicted overlay comparison.
 */
import * as React from "react";
import * as RechartsPrimitive from "recharts";
import { cn } from "@Name_Pending/ui/lib/utils";

const THEMES = { light: "", dark: ".dark" } as const;

export type ChartConfig = {
  [k in string]: {
    label?: React.ReactNode;
    icon?: React.ComponentType;
  } & (
    | { color?: string; theme?: never }
    | { color?: never; theme: Record<keyof typeof THEMES, string> }
  );
};

const ChartContext = React.createContext<{ config: ChartConfig } | null>(null);

function useChart() {
  const context = React.useContext(ChartContext);
  if (!context) throw new Error("useChart must be used within a <ChartContainer />");
  return context;
}

function ChartContainer({
  id,
  className,
  children,
  config,
  ...props
}: React.ComponentProps<"div"> & {
  config: ChartConfig;
  children: React.ReactElement;
}) {
  const uniqueId = React.useId();
  const chartId = `chart-${id ?? uniqueId.replace(/:/g, "")}`;

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-slot="chart"
        data-chart={chartId}
        className={cn(
          "[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-layer]:outline-hidden [&_.recharts-surface]:outline-hidden flex justify-center text-xs",
          className
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer width="100%" height="100%">
          {children}
        </RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
}

function ChartStyle({ id, config }: { id: string; config: ChartConfig }) {
  const colorConfig = Object.entries(config).filter(
    ([, c]) => (c as { theme?: unknown; color?: unknown }).theme ?? (c as { color?: unknown }).color
  );
  if (!colorConfig.length) return null;
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: Object.entries(THEMES)
          .map(
            ([theme, prefix]) => `
${prefix} [data-chart=${id}] {
${colorConfig
  .map(([key, itemConfig]) => {
    const c = itemConfig as { theme?: Record<string, string>; color?: string };
    const color = c.theme?.[theme] ?? c.color;
    return color ? `  --color-${key}: ${color};` : null;
  })
  .filter(Boolean)
  .join("\n")}
}
`
          )
          .join("\n"),
      }}
    />
  );
}

const ChartTooltip = RechartsPrimitive.Tooltip;

function getPayloadConfig(config: ChartConfig, payload: unknown, key: string) {
  if (typeof payload !== "object" || payload === null) return undefined;
  const p = payload as Record<string, unknown>;
  const labelKey = (p[key] as string) ?? key;
  return config[labelKey] ?? config[key as keyof typeof config];
}

function ChartTooltipContent({
  active,
  payload,
  label,
  labelFormatter,
  formatter,
}: React.ComponentProps<typeof RechartsPrimitive.Tooltip>) {
  const { config } = useChart();
  if (!active || !payload?.length) return null;

  type TooltipPayload = Array<{ name?: string; dataKey?: string; value?: unknown }>;
  const pl = payload as TooltipPayload;
  const labelVal =
    labelFormatter && label != null
      ? (labelFormatter as (label: unknown, p: TooltipPayload) => React.ReactNode)(label, pl)
      : label;

  return (
    <div className="border-border/50 bg-background grid min-w-[8rem] items-start gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl">
      {labelVal != null && <div className="font-medium">{labelVal}</div>}
      <div className="grid gap-1.5">
        {payload.map((item) => {
          const key = String(item.name ?? item.dataKey ?? "value");
          const itemConfig = getPayloadConfig(config, item, key);
          const value =
            formatter && item.value !== undefined && item.name != null
              ? (formatter as (v: unknown, n: string, p: unknown, i: number, payload: unknown) => React.ReactNode)(
                  item.value,
                  String(item.name),
                  item,
                  0,
                  pl
                )
              : item.value != null
                ? Number(item.value).toLocaleString(undefined, { maximumFractionDigits: 2 })
                : null;
          return (
            <div
              key={String(item.dataKey)}
              className="flex w-full items-center justify-between gap-2"
            >
              <div className="flex items-center gap-1.5">
                <div
                  className="h-2.5 w-2.5 shrink-0 rounded-[2px] border border-(--color-border) bg-(--color-bg)"
                  style={
                    {
                      "--color-bg": item.color ?? item.fill,
                      "--color-border": item.color ?? item.fill,
                    } as React.CSSProperties
                  }
                />
                <span className="text-muted-foreground">
                  {itemConfig?.label ?? item.name ?? key}
                </span>
              </div>
              {value != null && (
                <span className="font-mono font-medium tabular-nums text-foreground">{value}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { ChartContainer, ChartTooltip, ChartTooltipContent, ChartStyle, useChart };
