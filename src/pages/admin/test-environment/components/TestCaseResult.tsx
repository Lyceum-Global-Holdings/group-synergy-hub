import { CheckCircle2, XCircle, Loader2, MinusCircle } from "lucide-react";
import { TestStatus } from "../tests/types";

interface Props {
  id: string;
  name: string;
  status: TestStatus;
  priority: string;
  duration?: number;
  error?: string;
  details?: string;
  onRun: () => void;
  isRunning: boolean;
}

const statusIcon: Record<TestStatus, React.ReactNode> = {
  idle: <MinusCircle className="h-4 w-4 text-muted-foreground" />,
  running: <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />,
  passed: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  failed: <XCircle className="h-4 w-4 text-destructive" />,
  skipped: <MinusCircle className="h-4 w-4 text-muted-foreground/50" />,
};

const priorityBadge: Record<string, string> = {
  critical: "bg-destructive/10 text-destructive",
  high: "bg-yellow-500/10 text-yellow-700",
  medium: "bg-blue-500/10 text-blue-700",
};

export function TestCaseResult({ id, name, status, priority, duration, error, details, onRun, isRunning }: Props) {
  return (
    <div className={`flex items-center gap-3 px-4 py-2 rounded-lg border ${status === "failed" ? "border-destructive/30 bg-destructive/5" : "border-transparent bg-muted/30"}`}>
      {statusIcon[status]}
      <span className="text-xs font-mono text-muted-foreground w-16 shrink-0">{id}</span>
      <span className="text-sm flex-1 truncate">{name}</span>
      <span className={`text-xs px-2 py-0.5 rounded-full ${priorityBadge[priority] || ""}`}>{priority}</span>
      {duration != null && <span className="text-xs text-muted-foreground w-16 text-right">{duration}ms</span>}
      {details && status === "passed" && <span className="text-xs text-green-600 max-w-[200px] truncate">{details}</span>}
      {error && status === "failed" && <span className="text-xs text-destructive max-w-[250px] truncate" title={error}>{error}</span>}
      <button
        onClick={onRun}
        disabled={isRunning}
        className="text-xs px-2 py-1 rounded border hover:bg-muted disabled:opacity-50"
      >
        Run
      </button>
    </div>
  );
}
