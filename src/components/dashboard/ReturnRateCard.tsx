import { cn } from "@/lib/utils";
import { DashCard, DashCardHeader, Skeleton } from "./DashCard";
import { FLOW_COLORS } from "./charts/MaterialFlowChart";

interface Props {
  data: Array<{ issued: number; returned: number }> | undefined;
  loading?: boolean;
  className?: string;
}

export function ReturnRateCard({ data, loading, className }: Props) {
  const rows = data ?? [];
  const issued = rows.reduce((s, r) => s + Number(r.issued || 0), 0);
  const returned = rows.reduce((s, r) => s + Number(r.returned || 0), 0);
  const ratio = issued > 0 ? (returned / issued) * 100 : 0;
  const status =
    issued === 0
      ? { label: "No issues yet", cls: "bg-muted text-muted-foreground" }
      : ratio > 15
        ? { label: "High", cls: "bg-warning/15 text-warning" }
        : ratio > 5
          ? { label: "Watch", cls: "bg-primary/10 text-primary" }
          : { label: "Healthy", cls: "bg-success/15 text-success" };
  const issuedShare = issued + returned > 0 ? (issued / (issued + returned)) * 100 : 50;

  return (
    <DashCard className={cn("flex flex-col", className)}>
      <DashCardHeader title="Return Rate" subtitle="Returned ÷ issued, last 14 days" />
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-28" />
          <Skeleton className="h-3 w-full rounded-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <span className="text-4xl font-semibold leading-none tracking-tight tabular-nums text-foreground">
              {ratio.toFixed(1)}%
            </span>
            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", status.cls)}>{status.label}</span>
          </div>

          <div className="mt-5 flex h-3 overflow-hidden rounded-full bg-muted" aria-hidden>
            <div style={{ width: `${issuedShare}%`, background: FLOW_COLORS.issued }} />
            <div className="ml-0.5 flex-1" style={{ background: FLOW_COLORS.returned }} />
          </div>

          <dl className="mt-auto space-y-2 pt-5 text-sm">
            <div className="flex justify-between">
              <dt className="flex items-center gap-2 text-muted-foreground">
                <span className="h-2 w-2 rounded-full" style={{ background: FLOW_COLORS.issued }} />
                Issued
              </dt>
              <dd className="font-medium tabular-nums">{issued.toLocaleString()}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="flex items-center gap-2 text-muted-foreground">
                <span className="h-2 w-2 rounded-full" style={{ background: FLOW_COLORS.returned }} />
                Returned
              </dt>
              <dd className="font-medium tabular-nums">{returned.toLocaleString()}</dd>
            </div>
            <div className="flex justify-between border-t border-border/60 pt-2">
              <dt className="text-muted-foreground">Net consumption</dt>
              <dd className="font-semibold tabular-nums">{(issued - returned).toLocaleString()}</dd>
            </div>
          </dl>
        </>
      )}
    </DashCard>
  );
}
