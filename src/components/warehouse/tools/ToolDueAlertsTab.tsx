import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Gauge, Wrench, Clock, CheckCircle2 } from "lucide-react";
import { useCompany } from "@/contexts/CompanyContext";
import { useFormatDate } from "@/lib/formatters";
import { useToolDueSummary } from "@/hooks/useToolDueSummary";

export function ToolDueAlertsTab() {
  const { selectedCompany } = useCompany();
  const fmt = useFormatDate();
  const { summary: s, isLoading } = useToolDueSummary(selectedCompany?.id);

  if (isLoading) {
    return <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  const tone = (state: string, days: number | null) =>
    state === "overdue" || (days ?? 0) < 0 ? "text-destructive" : "text-warning";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <DueCard
        title="Calibration due"
        icon={<Gauge className="h-4 w-4" />}
        count={s.calibration.count}
        standard="ISO/IEC 17025"
        empty="No calibrations due."
      >
        {s.calibration.items.map((it, i) => (
          <Row key={i} main={it.tool_name} sub={it.unit_code}
               right={<span className={tone(it.due_state, it.days_to_due)}>{it.next_due_date ? fmt(it.next_due_date) : "—"}</span>}
               note={it.days_to_due != null ? (it.days_to_due < 0 ? `${-it.days_to_due}d overdue` : `in ${it.days_to_due}d`) : ""} />
        ))}
      </DueCard>

      <DueCard
        title="Maintenance due"
        icon={<Wrench className="h-4 w-4" />}
        count={s.maintenance.count}
        standard="ISO 55000"
        empty="No maintenance due."
      >
        {s.maintenance.items.map((it, i) => (
          <Row key={i} main={it.tool_name} sub={it.unit_code}
               right={<span className={tone(it.due_state, it.days_to_due)}>{it.next_due_date ? fmt(it.next_due_date) : "—"}</span>}
               note={it.due_state === "unscheduled" ? "in repair" : (it.days_to_due != null ? (it.days_to_due < 0 ? `${-it.days_to_due}d overdue` : `in ${it.days_to_due}d`) : "")} />
        ))}
      </DueCard>

      <DueCard
        title="Overdue returns"
        icon={<Clock className="h-4 w-4" />}
        count={s.overdue_returns.count}
        standard="Tool crib"
        empty="No overdue tool returns."
      >
        {s.overdue_returns.items.map((it, i) => (
          <Row key={i} main={it.tool_name} sub={`${it.issued_to_name || "—"}${it.job_reference ? ` · ${it.job_reference}` : ""}`}
               right={<span className="text-destructive">{it.expected_return_date ? fmt(it.expected_return_date) : "—"}</span>}
               note={`${it.days_overdue}d overdue`} />
        ))}
      </DueCard>
    </div>
  );
}

function DueCard({ title, icon, count, standard, empty, children }: {
  title: string; icon: React.ReactNode; count: number; standard: string; empty: string; children: React.ReactNode;
}) {
  const items = Array.isArray(children) ? children : [children];
  const has = count > 0;
  return (
    <Card className={has ? "border-l-2 border-l-warning" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <span className="p-1.5 rounded-md bg-muted text-muted-foreground">{icon}</span>
            {title}
          </CardTitle>
          <Badge variant={has ? "destructive" : "outline"} className={has ? "" : "text-muted-foreground"}>{count}</Badge>
        </div>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{standard}</p>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {has ? items : (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
            <CheckCircle2 className="h-4 w-4 text-success" /> {empty}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Row({ main, sub, right, note }: { main: string; sub: string; right: React.ReactNode; note: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs border-b border-border/60 last:border-0 py-1.5">
      <div className="min-w-0">
        <div className="font-medium truncate">{main}</div>
        <div className="text-muted-foreground truncate">{sub}</div>
      </div>
      <div className="text-right shrink-0">
        <div className="tabular-nums">{right}</div>
        <div className="text-[10px] text-muted-foreground">{note}</div>
      </div>
    </div>
  );
}
