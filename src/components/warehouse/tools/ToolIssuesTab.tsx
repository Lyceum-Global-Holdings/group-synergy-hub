import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { ToolIssue } from "@/types/toolManagement";
import { format, differenceInDays } from "date-fns";

interface ToolIssuesTabProps {
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
      if (!date) return <span className="text-muted-foreground">Not set</span>;
      
      const returnDate = new Date(date);
      const today = new Date();
      const daysRemaining = differenceInDays(returnDate, today);
      const status = row.original.status;
      
      if (status === "returned") {
        return <span className="text-muted-foreground">{format(returnDate, "MMM d, yyyy")}</span>;
      }
      
      return (
        <div>
          <div>{format(returnDate, "MMM d, yyyy")}</div>
          {daysRemaining < 0 ? (
            <Badge variant="destructive" className="text-xs">
              {Math.abs(daysRemaining)} days overdue
            </Badge>
          ) : daysRemaining <= 3 ? (
            <Badge variant="secondary" className="text-xs">
              {daysRemaining} days left
            </Badge>
          ) : null}
        </div>
      );
    },
  },
  {
    accessorKey: "quantity_issued",
    header: "Qty Issued",
    cell: ({ row }) => row.getValue("quantity_issued"),
  },
  {
    accessorKey: "quantity_returned",
    header: "Qty Returned",
    cell: ({ row }) => {
      const issued = row.original.quantity_issued;
      const returned = row.getValue("quantity_returned") as number;
      return (
        <span className={returned >= issued ? "text-green-600" : ""}>
          {returned} / {issued}
        </span>
      );
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as string;
      const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
        issued: "secondary",
        partially_returned: "outline",
        returned: "default",
        overdue: "destructive",
      };
      return (
        <Badge variant={variants[status] || "secondary"}>
          {status.replace("_", " ")}
        </Badge>
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

export function ToolIssuesTab({ issues, isLoading }: ToolIssuesTabProps) {
  return <DataTable columns={columns} data={issues} isLoading={isLoading} />;
}
