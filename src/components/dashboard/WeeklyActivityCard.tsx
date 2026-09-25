import { TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { DashCard, DashCardHeader, HATCH, PillLink, Skeleton } from "./DashCard";

interface Props {
  data: Array<{ d: string; issued: number; returned: number }> | undefined;
  loading?: boolean;
  className?: string;
}

const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 0 });

// "2026-09-25" or an ISO timestamp → local calendar date (no UTC day shift).
function toLocalDate(d: string) {
  const [y, m, day] = d.slice(0, 10).split("-").map(Number);
  return new Date(y, (m || 1) - 1, day || 1);
}

export function WeeklyActivityCard({ data, loading, className }: Props) {
  const rows = [...(data ?? [])]
    .sort((a, b) => a.d.localeCompare(b.d))
    .map((r) => ({ d: r.d, v: Number(r.issued || 0) + Number(r.returned || 0) }));
  const week = rows.slice(-7);
  const prevWeek = rows.slice(-14, -7);
  const total = week.reduce((s, r) => s + r.v, 0);
  const prevTotal = prevWeek.reduce((s, r) => s + r.v, 0);
  const max = Math.max(...week.map((r) => r.v), 0);
  const peakIdx = max > 0 ? week.findIndex((r) => r.v === max) : -1;
  const change = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : null;

  return (
    <DashCard className={cn("flex flex-col", className)}>
      <DashCardHeader
        title="Weekly Activity"
        subtitle="Units issued + returned per day"
        action={<PillLink to="/warehouse/material-issue">Issues</PillLink>}
      />

      <div className="flex h-[200px] items-end justify-between gap-2 pt-2 sm:gap-3">
        {loading
          ? Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                <div
                  className="w-full max-w-[52px] animate-pulse rounded-full bg-muted"
                  style={{ height: `${35 + ((i * 37) % 50)}%` }}
                />
                <Skeleton className="h-3 w-3" />
              </div>
            ))
          : week.length === 0
            ? <p className="w-full self-center text-center text-sm text-muted-foreground">No stock movements yet.</p>
            : week.map((r, i) => {
                const date = toLocalDate(r.d);
                const ratio = max > 0 ? r.v / max : 0;
                const isPeak = i === peakIdx;
                const label = date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
                return (
                  <div key={r.d} className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
                    {/* Hatched full-height track; the solid pill fills it by volume. */}
                    <div
                      className="relative flex w-full max-w-[52px] flex-1 items-end rounded-full"
                      style={{ background: HATCH }}
                    >
                      {r.v > 0 && (
                        <div
                          className={cn(
                            "relative w-full rounded-full transition-all duration-300 group-hover:brightness-110",
                            isPeak && "bg-[linear-gradient(180deg,hsl(216_90%_40%),hsl(224_85%_26%))] shadow-lg shadow-primary/25",
                          )}
                          style={{
                            height: `${Math.max(ratio * 100, 22)}%`,
                            // Tint over an opaque card base so the hatching doesn't show through.
                            background: isPeak
                              ? undefined
                              : `linear-gradient(hsl(var(--primary) / ${0.4 + ratio * 0.5}) 0 0), hsl(var(--card))`,
                          }}
                        />
                      )}
                      <span
                        role="img"
                        aria-label={`${label}: ${fmt(r.v)} units`}
                        title={`${label}: ${fmt(r.v)} units`}
                        className="absolute inset-0 rounded-full"
                      />
                      <span
                        className={cn(
                          "pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-semibold tabular-nums text-foreground shadow-sm transition-opacity",
                          isPeak ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                        )}
                        // Near-full pills carry the chip inside their top edge so it
                        // never collides with the card header.
                        style={
                          ratio >= 0.8
                            ? { top: 8 }
                            : { bottom: `calc(${r.v > 0 ? Math.max(ratio * 100, 22) : 0}% + 6px)` }
                        }
                      >
                        {fmt(r.v)}
                      </span>
                    </div>
                    <span className="text-xs font-medium text-muted-foreground">
                      {date.toLocaleDateString(undefined, { weekday: "narrow" })}
                    </span>
                  </div>
                );
              })}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/60 pt-4 text-sm">
        <div>
          <span className="font-semibold tabular-nums text-foreground">{loading ? "—" : fmt(total)}</span>
          <span className="text-muted-foreground"> units this week</span>
        </div>
        {!loading && change !== null && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
              "bg-primary/10 text-primary",
            )}
          >
            {change >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {`${change >= 0 ? "+" : ""}${change.toFixed(0)}% vs last week`}
          </span>
        )}
      </div>
    </DashCard>
  );
}
