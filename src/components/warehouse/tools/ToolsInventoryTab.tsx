import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { WarehouseTool } from "@/types/toolManagement";
import { MoreHorizontal, Pencil, SlidersHorizontal } from "lucide-react";

interface ToolsInventoryTabProps {
  tools: WarehouseTool[];
  isLoading: boolean;
  onAdjustQuantity?: (tool: WarehouseTool) => void;
  onEditTool?: (tool: WarehouseTool) => void;
}

const createColumns = (
  onAdjustQuantity?: (tool: WarehouseTool) => void,
  onEditTool?: (tool: WarehouseTool) => void
): ColumnDef<WarehouseTool>[] => [
  {
    accessorKey: "tool_code",
    header: "Code",
    cell: ({ row }) => (
      <span className="font-mono text-sm">{row.getValue("tool_code")}</span>
    ),
  },
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => (
      <div>
        <div className="font-medium">{row.getValue("name")}</div>
        {row.original.description && (
          <div className="text-sm text-muted-foreground truncate max-w-[200px]">
            {row.original.description}
          </div>
        )}
      </div>
    ),
  },
  {
    accessorKey: "category",
    header: "Category",
    cell: ({ row }) => row.original.category?.name || "-",
  },
  {
    accessorKey: "location",
    header: "Location",
    cell: ({ row }) => row.original.location?.name || "-",
  },
  {
    accessorKey: "unit",
    header: "Unit",
    cell: ({ row }) => row.original.unit?.abbreviation || "-",
  },
  {
    accessorKey: "total_quantity",
    header: "Total",
    cell: ({ row }) => row.getValue("total_quantity"),
  },
  {
    accessorKey: "available_quantity",
    header: "Available",
    cell: ({ row }) => {
      const available = row.getValue("available_quantity") as number;
      const total = row.original.total_quantity;
      const percentage = total > 0 ? (available / total) * 100 : 0;
      
      return (
        <Badge variant={percentage > 50 ? "default" : percentage > 0 ? "secondary" : "destructive"}>
          {available}
        </Badge>
      );
    },
  },
  {
    accessorKey: "issued_quantity",
    header: "Issued",
    cell: ({ row }) => {
      const issued = row.getValue("issued_quantity") as number;
      return issued > 0 ? (
        <Badge variant="outline">{issued}</Badge>
      ) : (
        <span className="text-muted-foreground">0</span>
      );
    },
  },
  {
    accessorKey: "condition",
    header: "Condition",
    cell: ({ row }) => {
      const condition = row.getValue("condition") as string;
      const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
        good: "default",
        fair: "secondary",
        poor: "destructive",
        needs_repair: "outline",
      };
      return (
        <Badge variant={variants[condition] || "secondary"}>
          {condition.replace("_", " ")}
        </Badge>
      );
    },
  },
  {
    accessorKey: "unit_cost",
    header: "Unit Cost",
    cell: ({ row }) => {
      const cost = row.getValue("unit_cost") as number | null;
      return cost ? `$${cost.toFixed(2)}` : "-";
    },
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => {
      const tool = row.original;
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEditTool?.(tool)}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit Tool
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAdjustQuantity?.(tool)}>
              <SlidersHorizontal className="h-4 w-4 mr-2" />
              Adjust Quantity
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];

export function ToolsInventoryTab({ tools, isLoading, onAdjustQuantity, onEditTool }: ToolsInventoryTabProps) {
  const columns = createColumns(onAdjustQuantity, onEditTool);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">Total Tools</div>
          <div className="text-2xl font-bold">{tools.length}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">Total Quantity</div>
          <div className="text-2xl font-bold">
            {tools.reduce((sum, t) => sum + t.total_quantity, 0)}
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">Available</div>
          <div className="text-2xl font-bold text-green-600">
            {tools.reduce((sum, t) => sum + t.available_quantity, 0)}
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">Currently Issued</div>
          <div className="text-2xl font-bold text-orange-600">
            {tools.reduce((sum, t) => sum + t.issued_quantity, 0)}
          </div>
        </div>
      </div>

      <DataTable columns={columns} data={tools} isLoading={isLoading} />
    </div>
  );
}
