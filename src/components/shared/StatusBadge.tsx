import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusConfig: Record<string, { dot: string; bg: string; text: string }> = {
  // Success states
  active: { dot: "bg-success", bg: "bg-success/10", text: "text-success" },
  approved: { dot: "bg-success", bg: "bg-success/10", text: "text-success" },
  completed: { dot: "bg-success", bg: "bg-success/10", text: "text-success" },
  paid: { dot: "bg-success", bg: "bg-success/10", text: "text-success" },
  received: { dot: "bg-success", bg: "bg-success/10", text: "text-success" },
  accepted: { dot: "bg-success", bg: "bg-success/10", text: "text-success" },
  delivered: { dot: "bg-success", bg: "bg-success/10", text: "text-success" },
  matched: { dot: "bg-success", bg: "bg-success/10", text: "text-success" },

  // Warning / in-progress
  pending: { dot: "bg-warning", bg: "bg-warning/10", text: "text-warning" },
  draft: { dot: "bg-muted-foreground", bg: "bg-muted", text: "text-muted-foreground" },
  submitted: { dot: "bg-info", bg: "bg-info/10", text: "text-info" },
  in_progress: { dot: "bg-info", bg: "bg-info/10", text: "text-info" },
  processing: { dot: "bg-info", bg: "bg-info/10", text: "text-info" },
  picking: { dot: "bg-info", bg: "bg-info/10", text: "text-info" },
  confirmed: { dot: "bg-info", bg: "bg-info/10", text: "text-info" },
  partial: { dot: "bg-warning", bg: "bg-warning/10", text: "text-warning" },
  partially_paid: { dot: "bg-warning", bg: "bg-warning/10", text: "text-warning" },
  partially_received: { dot: "bg-warning", bg: "bg-warning/10", text: "text-warning" },

  // Error states
  rejected: { dot: "bg-destructive", bg: "bg-destructive/10", text: "text-destructive" },
  cancelled: { dot: "bg-destructive", bg: "bg-destructive/10", text: "text-destructive" },
  failed: { dot: "bg-destructive", bg: "bg-destructive/10", text: "text-destructive" },
  overdue: { dot: "bg-destructive", bg: "bg-destructive/10", text: "text-destructive" },

  // Neutral
  inactive: { dot: "bg-muted-foreground/50", bg: "bg-muted", text: "text-muted-foreground" },
  closed: { dot: "bg-muted-foreground/50", bg: "bg-muted", text: "text-muted-foreground" },
  expired: { dot: "bg-muted-foreground/50", bg: "bg-muted", text: "text-muted-foreground" },
};

const defaultConfig = { dot: "bg-muted-foreground", bg: "bg-muted", text: "text-muted-foreground" };

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const normalizedStatus = status?.toLowerCase().replace(/[\s-]/g, "_") || "unknown";
  const config = statusConfig[normalizedStatus] || defaultConfig;

  return (
    <Badge
      variant="outline"
      className={cn(
        "border-0 font-medium capitalize gap-1.5",
        config.bg,
        config.text,
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", config.dot)} />
      {status?.replace(/_/g, " ") || "Unknown"}
    </Badge>
  );
}
