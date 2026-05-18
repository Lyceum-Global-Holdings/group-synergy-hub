import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Play, Eye, Trash2, Pencil, Clock } from "lucide-react";
import { format } from "date-fns";
import {
  useTelegramJobs,
  useTelegramJobRuns,
  REPORT_TYPE_LABELS,
  type TelegramScheduledJob,
} from "@/hooks/useTelegramJobs";
import { JobEditorDialog } from "@/components/admin/telegram/JobEditorDialog";
import { TelegramSettingsTab } from "@/components/construction/TelegramSettingsTab";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  success: "default",
  partial: "secondary",
  failed: "destructive",
  running: "outline",
};

export default function TelegramReports() {
  const { data: jobs = [], isLoading, saveJob, deleteJob, toggleJob, runNow } = useTelegramJobs();
  const { data: runs = [] } = useTelegramJobRuns();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<TelegramScheduledJob | null>(null);

  const handleNew = () => {
    setEditingJob(null);
    setEditorOpen(true);
  };
  const handleEdit = (j: TelegramScheduledJob) => {
    setEditingJob(j);
    setEditorOpen(true);
  };
  const handleDelete = (j: TelegramScheduledJob) => {
    if (confirm(`Delete schedule "${j.name}"?`)) deleteJob.mutate(j.id);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Telegram Reports</h1>
        <p className="text-muted-foreground">
          Configure automated daily, weekly, and monthly Telegram reports.
        </p>
      </div>

      <Tabs defaultValue="jobs">
        <TabsList>
          <TabsTrigger value="jobs">Scheduled Jobs</TabsTrigger>
          <TabsTrigger value="history">Run History</TabsTrigger>
          <TabsTrigger value="connection">Connection</TabsTrigger>
        </TabsList>

        <TabsContent value="jobs" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={handleNew}>
              <Plus className="h-4 w-4 mr-2" />
              New Schedule
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Report</TableHead>
                    <TableHead>Frequency</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Timezone</TableHead>
                    <TableHead>Next Run</TableHead>
                    <TableHead>Enabled</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8">Loading…</TableCell></TableRow>
                  ) : jobs.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No scheduled jobs yet. Click "New Schedule" to create one.</TableCell></TableRow>
                  ) : (
                    jobs.map((j) => (
                      <TableRow key={j.id}>
                        <TableCell className="font-medium">{j.name}</TableCell>
                        <TableCell>{REPORT_TYPE_LABELS[j.report_type]}</TableCell>
                        <TableCell className="capitalize">
                          {j.frequency}
                          {j.frequency === "weekly" && j.weekday != null && ` (${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][j.weekday]})`}
                          {j.frequency === "monthly" && j.day_of_month != null && ` (day ${j.day_of_month})`}
                        </TableCell>
                        <TableCell>{j.send_time.slice(0, 5)}</TableCell>
                        <TableCell>{j.timezone}</TableCell>
                        <TableCell className="text-sm">
                          {j.next_run_at ? format(new Date(j.next_run_at), "MMM d, HH:mm") : "—"}
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={j.is_enabled}
                            onCheckedChange={(v) => toggleJob.mutate({ id: j.id, is_enabled: v })}
                          />
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button size="sm" variant="ghost" onClick={() => runNow.mutate({ jobId: j.id, dryRun: true })} title="Preview">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => runNow.mutate({ jobId: j.id })} title="Run now">
                            <Play className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleEdit(j)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDelete(j)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Recent Runs
              </CardTitle>
              <CardDescription>Last 100 executions across all schedules.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Started</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Trigger</TableHead>
                    <TableHead>Recipients</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No runs yet.</TableCell></TableRow>
                  ) : runs.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm">{format(new Date(r.started_at), "MMM d, HH:mm:ss")}</TableCell>
                      <TableCell><Badge variant={STATUS_VARIANT[r.status]}>{r.status}</Badge></TableCell>
                      <TableCell className="text-sm capitalize">{r.triggered_by}</TableCell>
                      <TableCell>{r.recipient_count}</TableCell>
                      <TableCell className="text-sm text-destructive max-w-md truncate" title={r.error_text ?? undefined}>{r.error_text ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="connection">
          <TelegramSettingsTab />
        </TabsContent>
      </Tabs>

      <JobEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        job={editingJob}
        onSave={(data) => {
          saveJob.mutate(data, { onSuccess: () => setEditorOpen(false) });
        }}
      />
    </div>
  );
}
