import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Activity, AlertCircle, ExternalLink } from "lucide-react";
import { Sparkline } from "@/components/dashboard/Sparkline";
import {
  useUptimeRollup,
  useUptimeRecent,
  type UptimeRollupRow,
  type UptimeRecentCheck,
} from "@/hooks/useUptimeRollup";

const TARGET_LABEL: Record<string, string> = {
  app_home: "App home (/)",
  app_manifest: "PWA manifest",
  fn_public_bin_qr: "Edge · public-bin-qr",
  fn_security_settings_public: "Edge · security-settings-public",
  fn_send_telegram_report: "Edge · send-telegram-report",
  fn_peppol_send: "Edge · peppol-send",
};

function uptimeTone(pct: number | null): { color: string; label: string } {
  if (pct == null) return { color: "bg-muted text-muted-foreground", label: "—" };
  if (pct >= 99) return { color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", label: "Healthy" };
  if (pct >= 95) return { color: "bg-amber-500/15 text-amber-700 dark:text-amber-300", label: "Degraded" };
  return { color: "bg-destructive/15 text-destructive", label: "At risk" };
}

function buildHourlyOk(
  recent: UptimeRecentCheck[],
  target: string,
  hours = 24,
): Array<{ d: string; v: number }> {
  const counts = new Array(hours).fill(0) as number[];
  const oks = new Array(hours).fill(0) as number[];
  const now = Date.now();
  for (const c of recent) {
    if (c.target !== target) continue;
    const ageH = Math.floor((now - new Date(c.checked_at).getTime()) / 3_600_000);
    if (ageH < 0 || ageH >= hours) continue;
    counts[ageH] += 1;
    if (c.ok) oks[ageH] += 1;
  }
  // Sparkline draws oldest -> newest left to right.
  const series: Array<{ d: string; v: number }> = [];
  for (let i = hours - 1; i >= 0; i--) {
    const v = counts[i] > 0 ? Math.round((oks[i] / counts[i]) * 100) : 100;
    series.push({ d: String(i), v });
  }
  return series;
}

function TargetCard({
  row,
  recent,
}: {
  row: UptimeRollupRow;
  recent: UptimeRecentCheck[];
}) {
  const tone = uptimeTone(row.uptime_pct);
  const series = useMemo(() => buildHourlyOk(recent, row.target), [recent, row.target]);
  const pct = row.uptime_pct == null ? "—" : `${Number(row.uptime_pct).toFixed(2)}%`;
  const lastChecked = row.last_checked_at
    ? new Date(row.last_checked_at).toLocaleString()
    : "Never";

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-sm font-semibold truncate">
              {TARGET_LABEL[row.target] ?? row.target}
            </CardTitle>
            {row.url && (
              <CardDescription className="truncate text-xs">{row.url}</CardDescription>
            )}
          </div>
          <Badge variant="outline" className={tone.color}>
            {tone.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-2xl font-bold tabular-nums">{pct}</div>
            <div className="text-xs text-muted-foreground">30-day uptime</div>
          </div>
          <div className="text-right text-xs text-muted-foreground space-y-0.5">
            <div>p50 {row.p50_ms != null ? `${Math.round(row.p50_ms)} ms` : "—"}</div>
            <div>p95 {row.p95_ms != null ? `${Math.round(row.p95_ms)} ms` : "—"}</div>
            <div>{row.checks} checks · {row.failures} fail</div>
          </div>
        </div>
        <Sparkline data={series} height={40} />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Last: {row.last_status ?? (row.last_ok ? "OK" : "error")}</span>
          <span>{lastChecked}</span>
        </div>
      </CardContent>
    </Card>
  );
}

export function UptimeMonitorPanel() {
  const rollup = useUptimeRollup();
  const recent = useUptimeRecent(24, 3000);

  if (rollup.isLoading || recent.isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading uptime…
      </div>
    );
  }

  if (rollup.isError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Could not load uptime data</AlertTitle>
        <AlertDescription>
          {(rollup.error as Error)?.message ?? "Unknown error"}
        </AlertDescription>
      </Alert>
    );
  }

  const rows = rollup.data ?? [];
  const overall =
    rows.length === 0
      ? null
      : rows.reduce((acc, r) => acc + (Number(r.uptime_pct) || 0), 0) / rows.length;
  const overallTone = uptimeTone(overall);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Uptime monitor
          </h2>
          <p className="text-xs text-muted-foreground">
            Probed every 5 minutes from Supabase. 30-day rolling window. Target ≥ 99%.
          </p>
        </div>
        {overall != null && (
          <Badge variant="outline" className={overallTone.color}>
            Overall {overall.toFixed(2)}%
          </Badge>
        )}
      </div>

      {rows.length === 0 ? (
        <Alert>
          <Activity className="h-4 w-4" />
          <AlertTitle>No checks recorded yet</AlertTitle>
          <AlertDescription>
            The probe runs every 5 minutes. The first results will appear within a few minutes of
            deployment. If nothing shows after 15 minutes, verify the <code>uptime-probe-5min</code>{" "}
            pg_cron schedule is active.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {rows.map((row) => (
            <TargetCard key={row.target} row={row} recent={recent.data ?? []} />
          ))}
        </div>
      )}

      <Alert>
        <ExternalLink className="h-4 w-4" />
        <AlertTitle>External monitoring</AlertTitle>
        <AlertDescription>
          For independent third-party verification (and a public status page), register{" "}
          <code>https://stores.lgh.lk</code> as an HTTP(s) monitor at{" "}
          <a
            href="https://uptimerobot.com/"
            target="_blank"
            rel="noreferrer"
            className="underline text-primary"
          >
            UptimeRobot
          </a>{" "}
          (free, 5-minute interval). See the <em>Uptime monitoring</em> section of the project
          README for setup steps.
        </AlertDescription>
      </Alert>
    </div>
  );
}
