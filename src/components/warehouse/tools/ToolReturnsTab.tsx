import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { ToolReturn } from "@/types/toolManagement";
import { format } from "date-fns";

interface ToolReturnsTabProps {
  returns: ToolReturn[];
  isLoading: boolean;
}

const columns: ColumnDef<ToolReturn>[] = [
  {
    accessorKey: "return_number",
    header: "Return #",
    cell: ({ row }) => (
      <span className="font-mono text-sm">{row.getValue("return_number")}</span>
    ),
  },
  {
    accessorKey: "issue",
    header: "Issue #",
    cell: ({ row }) => {
      const issue = row.original.issue;
      return issue ? (
        <span className="font-mono text-sm">{issue.issue_number}</span>
      ) : "-";
    },
  },
  {
    accessorKey: "tool",
    header: "Tool",
    cell: ({ row }) => {
      const issue = row.original.issue;
      const tool = issue?.tool;
      return tool ? (
        <div>
          <div className="font-medium">{tool.name}</div>
          <div className="text-sm text-muted-foreground">{tool.tool_code}</div>
        </div>
      ) : "-";
    },
  },
  {
    accessorKey: "return_date",
    header: "Return Date",
    cell: ({ row }) => format(new Date(row.getValue("return_date")), "MMM d, yyyy"),
  },
  {
    accessorKey: "quantity_returned",
    header: "Qty Returned",
    cell: ({ row }) => row.getValue("quantity_returned"),
  },
  {
    accessorKey: "returned_by_name",
    header: "Returned By",
    cell: ({ row }) => row.getValue("returned_by_name") || "-",
  },
  {
    accessorKey: "condition",
    header: "Condition",
    cell: ({ row }) => {
      const condition = row.getValue("condition") as string;
      const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
        good: "default",
        needs_repair: "secondary",
        damaged: "destructive",
        lost: "destructive",
      };
      return (
        <Badge variant={variants[condition] || "secondary"}>
          {condition.replace("_", " ")}
        </Badge>
      );
    },
  },
  {
    accessorKey: "condition_notes",
    header: "Condition Notes",
    cell: ({ row }) => {
      const notes = row.getValue("condition_notes") as string | null;
      return notes ? (
        <span className="truncate max-w-[150px] block">{notes}</span>
      ) : (
        <span className="text-muted-foreground">-</span>
      );
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as string;
      return <Badge variant="default">{status}</Badge>;
    },
  },
];

export function ToolReturnsTab({ returns, isLoading }: ToolReturnsTabProps) {
  return <DataTable columns={columns} data={returns} isLoading={isLoading} />;
}
