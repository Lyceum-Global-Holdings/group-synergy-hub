import { useMemo } from "react";
import { BarChart3 } from "lucide-react";
import type { ReportEnvelope } from "@/lib/reports/types";
import { formatFull, resolveVisuals } from "@/lib/reports/visuals";
import { ReportChart } from "./charts/ReportChart";

/** KPI tiles + charts for a report preview (same visuals as the exports). */
export function ReportVisuals({ envelope }: { envelope: ReportEnvelope }) {
  const visuals = useMemo(() => resolveVisuals(envelope), [envelope]);

  if (envelope.rows.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
        No data for the selected parameters.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {visuals.kpis.length > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {visuals.kpis.map((k) => (
            <div key={k.label} className="rounded-xl border bg-card px-4 py-3">
              <div className="truncate text-xs text-muted-foreground" title={k.label}>
                {k.label}
              </div>
              <div className="mt-1 truncate text-lg font-semibold tabular-nums" title={formatFull(k.value, k.format, envelope.currency)}>
                {formatFull(k.value, k.format, envelope.currency)}
              </div>
            </div>
          ))}
        </div>
      )}

      {visuals.charts.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          <BarChart3 className="h-6 w-6" />
          This report has no numeric or categorical columns to chart — see the Table view.
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {visuals.charts.map(({ spec, data }) => (
            <figure key={spec.id} className="rounded-xl border bg-card p-4">
              <figcaption className="mb-2">
                <div className="text-sm font-semibold">{spec.title}</div>
                {spec.subtitle && <div className="text-xs text-muted-foreground">{spec.subtitle}</div>}
              </figcaption>
              <ReportChart spec={spec} data={data} currency={envelope.currency} />
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
