import { useState } from "react";
import { cn } from "@/lib/utils";
import { DashCard, DashCardHeader, Skeleton } from "./DashCard";

type Row = { item_id: string; name: string; item_code: string | null; qty: number };

interface Props {
  issued: Row[] | undefined;
  returned: Row[] | undefined;
  loading?: boolean;
  className?: string;
}

// Rank tiles cycle through the blue family, like the coloured icons on a list.
const RANK_TILE = [
  "bg-[linear-gradient(145deg,hsl(213_94%_46%),hsl(224_85%_30%))] text-white",
  "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400",
  "bg-cyan-500/15 text-cyan-700 dark:text-cyan-400",
  "bg-blue-500/10 text-blue-700 dark:text-blue-300",
];

const TABS = [
  { key: "issued", label: "Issued" },
  { key: "returned", label: "Returned" },
] as const;

export function TopItemsCard({ issued, returned, loading, className }: Props) {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("issued");
  const rows = (tab === "issued" ? issued : returned) ?? [];
  const max = Math.max(...rows.map((r) => Number(r.qty) || 0), 1);

  return (
    <DashCard className={cn("flex flex-col", className)}>
      <DashCardHeader
        title="Top Items"
        subtitle="By quantity, last 30 days"
        action={
          <div role="tablist" aria-label="Movement type" className="inline-flex rounded-full bg-muted p-0.5">
            {TABS.map((t) => (
              <button
                key={t.key}
                role="tab"
                type="button"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-all",
                  tab === t.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        }
      />

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-xl" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-2.5 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="flex flex-1 items-center justify-center py-8 text-sm text-muted-foreground">
          No {tab} items in the last 30 days.
        </p>
      ) : (
        <ol className="space-y-3.5">
          {rows.slice(0, 5).map((r, i) => (
            <li key={r.item_id} className="flex items-center gap-3">
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-semibold",
                  RANK_TILE[i % RANK_TILE.length],
                )}
              >
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-sm font-medium text-foreground" title={r.name}>
                    {r.name}
                  </p>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                    {Number(r.qty).toLocaleString()}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="max-w-[65%] shrink-0 truncate font-mono text-[10px] text-muted-foreground">
                    {r.item_code ?? "—"}
                  </span>
                  <div className="h-1 min-w-[32px] flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary/70"
                      style={{ width: `${(Number(r.qty) / max) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </DashCard>
  );
}
