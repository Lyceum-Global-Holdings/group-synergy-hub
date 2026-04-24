import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Download, Activity } from "lucide-react";
import { usePerformanceSummary, type VitalRow } from "@/hooks/usePerformanceSummary";

const VITAL_THRESHOLDS = {
  lcp: { good: 2500, poor: 4000, unit: "ms" },
  inp: { good: 200, poor: 500, unit: "ms" },
  cls: { good: 0.1, poor: 0.25, unit: "" },
  fcp: { good: 1800, poor: 3000, unit: "ms" },
  ttfb: { good: 800, poor: 1800, unit: "ms" },
} as const;

type VitalKind = keyof typeof VITAL_THRESHOLDS;

function gradeBadge(kind: VitalKind, value: number) {
  const t = VITAL_THRESHOLDS[kind];
  if (value <= t.good) return <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">good</Badge>;
  if (value <= t.poor) return <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30">needs-improvement</Badge>;
  return <Badge variant="destructive">poor</Badge>;
}

function fmtVital(kind: VitalKind, v: number) {
  const t = VITAL_THRESHOLDS[kind];
  return kind === "cls" ? v.toFixed(3) : `${Math.round(v)}${t.unit}`;
}

function downloadCSV(filename: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function PerformanceDashboard() {
  const [days, setDays] = useState<number>(7);
  const { data, isLoading, error } = usePerformanceSummary(days);

  // Group vitals by route for the table view
  const vitalsByRoute = useMemo(() => {
    const map = new Map<string, Partial<Record<VitalKind, VitalRow>>>();
    (data?.vitals ?? []).forEach((row) => {
      const existing = map.get(row.route) ?? {};
      existing[row.metric_kind as VitalKind] = row;
      map.set(row.route, existing);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [data]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Performance Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Core Web Vitals, slow queries, and long-task hotspots from production telemetry.
            </p>
          </div>
        </div>
        <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Last 24 hours</SelectItem>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && (
        <Card>
          <CardContent className="py-6 text-destructive">
            Failed to load performance data: {(error as Error).message}
          </CardContent>
        </Card>
      )}

      {!isLoading && data && (
        <Tabs defaultValue="vitals">
          <TabsList>
            <TabsTrigger value="vitals">Core Web Vitals</TabsTrigger>
            <TabsTrigger value="queries">Slow Queries</TabsTrigger>
            <TabsTrigger value="longtasks">Long Tasks</TabsTrigger>
          </TabsList>

          <TabsContent value="vitals" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Vitals by Route (p75)</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadCSV(`vitals-${days}d.csv`, data.vitals as unknown as Record<string, unknown>[])}
                  disabled={data.vitals.length === 0}
                >
                  <Download className="h-4 w-4 mr-2" />
                  CSV
                </Button>
              </CardHeader>
              <CardContent>
                {vitalsByRoute.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    No telemetry yet. Browse the app for a few minutes and refresh.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="py-2 pr-4">Route</th>
                          {(Object.keys(VITAL_THRESHOLDS) as VitalKind[]).map((k) => (
                            <th key={k} className="py-2 pr-4 uppercase">{k}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {vitalsByRoute.map(([route, vitals]) => (
                          <tr key={route} className="border-b last:border-0">
                            <td className="py-2 pr-4 font-mono text-xs">{route}</td>
                            {(Object.keys(VITAL_THRESHOLDS) as VitalKind[]).map((k) => {
                              const v = vitals[k];
                              return (
                                <td key={k} className="py-2 pr-4">
                                  {v ? (
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono">{fmtVital(k, v.p75)}</span>
                                      {gradeBadge(k, v.p75)}
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="queries" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Slow Queries (&gt;1s)</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    downloadCSV(`slow-queries-${days}d.csv`, data.slow_queries as unknown as Record<string, unknown>[])
                  }
                  disabled={data.slow_queries.length === 0}
                >
                  <Download className="h-4 w-4 mr-2" />
                  CSV
                </Button>
              </CardHeader>
              <CardContent>
                {data.slow_queries.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    No slow queries recorded in the selected window. 🎉
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="py-2 pr-4">Target</th>
                          <th className="py-2 pr-4 text-right">Calls</th>
                          <th className="py-2 pr-4 text-right">p50</th>
                          <th className="py-2 pr-4 text-right">p95</th>
                          <th className="py-2 pr-4 text-right">Max</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.slow_queries.map((row) => (
                          <tr key={row.target} className="border-b last:border-0">
                            <td className="py-2 pr-4 font-mono text-xs">{row.target}</td>
                            <td className="py-2 pr-4 text-right">{row.call_count}</td>
                            <td className="py-2 pr-4 text-right font-mono">{Math.round(row.p50)}ms</td>
                            <td className="py-2 pr-4 text-right font-mono">{Math.round(row.p95)}ms</td>
                            <td className="py-2 pr-4 text-right font-mono">{Math.round(row.max_ms)}ms</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="longtasks" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Long Tasks by Route (&gt;200ms)</CardTitle>
              </CardHeader>
              <CardContent>
                {data.long_tasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    No long tasks recorded. Main thread is healthy.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="py-2 pr-4">Route</th>
                          <th className="py-2 pr-4 text-right">Count</th>
                          <th className="py-2 pr-4 text-right">p75 duration</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.long_tasks.map((row) => (
                          <tr key={row.route} className="border-b last:border-0">
                            <td className="py-2 pr-4 font-mono text-xs">{row.route}</td>
                            <td className="py-2 pr-4 text-right">{row.task_count}</td>
                            <td className="py-2 pr-4 text-right font-mono">{Math.round(row.p75_duration)}ms</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
