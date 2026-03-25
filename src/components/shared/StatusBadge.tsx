import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusColorMap: Record<string, string> = {
  // General
  active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  approved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  paid: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  received: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  accepted: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  delivered: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  matched: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",

  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  draft: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  submitted: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  processing: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  picking: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  confirmed: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  partial: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  partially_paid: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  partially_received: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",

  rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  failed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  overdue: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",

  inactive: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  closed: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  expired: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const normalizedStatus = status?.toLowerCase().replace(/[\s-]/g, "_") || "unknown";
  const colorClass = statusColorMap[normalizedStatus] || "bg-muted text-muted-foreground";

  return (
    <Badge variant="outline" className={cn("border-0 font-medium capitalize", colorClass, className)}>
      {status?.replace(/_/g, " ") || "Unknown"}
    </Badge>
  );
}
