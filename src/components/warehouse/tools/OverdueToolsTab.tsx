import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { ToolIssue } from "@/types/toolManagement";
import { format, differenceInDays } from "date-fns";
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface OverdueToolsTabProps {
  issues: ToolIssue[];
  isLoading: boolean;
}

const columns: ColumnDef<ToolIssue>[] = [
  {
    accessorKey: "issue_number",
    header: "Issue #",
    cell: ({ row }) => (
      <span className="font-mono text-sm">{row.getValue("issue_number")}</span>
    ),
  },
  {
    accessorKey: "tool",
    header: "Tool",
    cell: ({ row }) => {
      const tool = row.original.tool;
      return tool ? (
        <div>
          <div className="font-medium">{tool.name}</div>
          <div className="text-sm text-muted-foreground">{tool.tool_code}</div>
        </div>
      ) : "-";
    },
  },
  {
    accessorKey: "issued_to_name",
    header: "Issued To",
    cell: ({ row }) => (
      <div>
        <div className="font-medium">{row.getValue("issued_to_name")}</div>
        {row.original.department && (
          <div className="text-sm text-muted-foreground">{row.original.department}</div>
        )}
      </div>
    ),
  },
  {
    accessorKey: "issue_date",
    header: "Issue Date",
    cell: ({ row }) => format(new Date(row.getValue("issue_date")), "MMM d, yyyy"),
  },
  {
    accessorKey: "expected_return_date",
    header: "Expected Return",
    cell: ({ row }) => {
      const date = row.getValue("expected_return_date") as string | null;
      if (!date) return "-";
      return format(new Date(date), "MMM d, yyyy");
    },
  },
  {
    accessorKey: "days_overdue",
    header: "Days Overdue",
    cell: ({ row }) => {
      const date = row.original.expected_return_date;
      if (!date) return "-";
      
      const daysOverdue = differenceInDays(new Date(), new Date(date));
      return (
        <Badge variant="destructive">
          {daysOverdue} {daysOverdue === 1 ? "day" : "days"}
        </Badge>
      );
    },
  },
  {
    accessorKey: "quantity_issued",
    header: "Qty Outstanding",
    cell: ({ row }) => {
      const issued = row.original.quantity_issued;
      const returned = row.original.quantity_returned;
      return (
        <span className="font-medium text-destructive">
          {issued - returned}
        </span>
      );
    },
  },
  {
    accessorKey: "purpose",
    header: "Purpose",
    cell: ({ row }) => {
      const purpose = row.getValue("purpose") as string | null;
      return purpose ? (
        <span className="truncate max-w-[150px] block">{purpose}</span>
      ) : (
        <span className="text-muted-foreground">-</span>
      );
    },
  },
];

export function OverdueToolsTab({ issues, isLoading }: OverdueToolsTabProps) {
  if (!isLoading && issues.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="rounded-full bg-green-100 p-3 mb-4">
          <AlertTriangle className="h-6 w-6 text-green-600" />
        </div>
        <h3 className="text-lg font-semibold">No Overdue Tools</h3>
        <p className="text-muted-foreground mt-1">
          All tools have been returned on time or are within their expected return dates.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {issues.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Overdue Tools</AlertTitle>
          <AlertDescription>
            {issues.length} tool {issues.length === 1 ? "issue is" : "issues are"} past their expected return date.
            Please follow up with the assigned personnel.
          </AlertDescription>
        </Alert>
      )}

      <DataTable columns={columns} data={issues} isLoading={isLoading} />
    </div>
  );
}
