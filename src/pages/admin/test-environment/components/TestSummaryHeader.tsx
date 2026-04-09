import { CheckCircle2, XCircle, Loader2, MinusCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface Props {
  total: number;
  passed: number;
  failed: number;
  running: number;
  idle: number;
  isRunning: boolean;
  runningLabel: string;
  onRunAll: () => void;
  onAbort: () => void;
  onReset: () => void;
  onExport: () => void;
}

export function TestSummaryHeader({ total, passed, failed, running, idle, isRunning, runningLabel, onRunAll, onAbort, onReset, onExport }: Props) {
  const completed = passed + failed;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="bg-card border rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Test Environment</h1>
          <p className="text-sm text-muted-foreground">ISO 29119 / ISTQB compliant module testing dashboard</p>
        </div>
        <div className="flex gap-2">
          {isRunning ? (
            <button onClick={onAbort} className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:opacity-90">
              Stop
            </button>
          ) : (
            <button onClick={onRunAll} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
              ▶ Run All Tests
            </button>
          )}
          <button onClick={onReset} className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-muted">Reset</button>
          <button onClick={onExport} className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-muted">Export</button>
        </div>
      </div>

      {isRunning && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Running: {runningLabel}
        </div>
      )}

      <Progress value={pct} className="h-3" />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatBox label="Total" value={total} icon={<MinusCircle className="h-4 w-4 text-muted-foreground" />} />
        <StatBox label="Passed" value={passed} icon={<CheckCircle2 className="h-4 w-4 text-green-500" />} />
        <StatBox label="Failed" value={failed} icon={<XCircle className="h-4 w-4 text-destructive" />} />
        <StatBox label="Running" value={running} icon={<Loader2 className="h-4 w-4 animate-spin text-yellow-500" />} />
        <StatBox label="Pending" value={idle} icon={<MinusCircle className="h-4 w-4 text-muted-foreground" />} />
      </div>
    </div>
  );
}

function StatBox({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 bg-muted/50 rounded-lg p-3">
      {icon}
      <div>
        <div className="text-xl font-bold">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}
