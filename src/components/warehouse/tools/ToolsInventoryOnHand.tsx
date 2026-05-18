/**
 * Read-only "Tools on-hand by bin" view for the Warehouse → Inventory page.
 *
 * Renders the same allocations Tool Management shows, but in the central
 * inventory surface so users have one place to see "what is physically in
 * my warehouse" regardless of whether the row is an item or a tool.
 *
 * Edits (allocate / move / return) still live in Tool Management.
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Search, Wrench, ExternalLink } from "lucide-react";
import { useAllToolBinAllocations } from "@/hooks/useAllToolBinAllocations";
import type { ColumnDef } from "@tanstack/react-table";

interface Row {
  id: string;
  tool_code: string;
  name: string;
  bin_code: string;
  bin_name: string;
  location_path: string;
  allocated: number;
  reserved: number;
  available: number;
}

export function ToolsInventoryOnHand() {
  const { data: rows = [], isLoading } = useAllToolBinAllocations();
  const [search, setSearch] = useState("");

  const data = useMemo<Row[]>(() => {
    const mapped = rows.map((r): Row => {
      const loc = r.warehouse_bin?.warehouse_location;
      const parentRaw = loc?.parent;
      const parent = Array.isArray(parentRaw) ? parentRaw[0] : parentRaw;
      const child = loc ? (loc.location_code ? `${loc.name} (${loc.location_code})` : loc.name) : "";
      const parentLabel = parent ? (parent.location_code ? `${parent.name} (${parent.location_code})` : parent.name) : "";
      const path = parent ? `${parentLabel} › ${child}` : child;
      return {
        id: r.id,
        tool_code: r.warehouse_item?.item_code ?? "",
        name: r.warehouse_item?.name ?? "",
        bin_code: r.warehouse_bin?.bin_code ?? "",
        bin_name: r.warehouse_bin?.name ?? "",
        location_path: path,
        allocated: r.allocated_quantity,
        reserved: r.reserved_quantity,
        available: r.available_quantity,
      };
    });
    const term = search.trim().toLowerCase();
    if (!term) return mapped;
    return mapped.filter(
      (r) =>
        r.tool_code.toLowerCase().includes(term) ||
        r.name.toLowerCase().includes(term) ||
        r.bin_code.toLowerCase().includes(term) ||
        r.bin_name.toLowerCase().includes(term) ||
        r.location_path.toLowerCase().includes(term),
    );
  }, [rows, search]);

  const columns: ColumnDef<Row>[] = [
    {
      id: "type",
      header: "Type",
      cell: () => (
        <Badge variant="outline" className="gap-1 font-normal">
          <Wrench className="h-3 w-3" />
          Tool
        </Badge>
      ),
    },
    { accessorKey: "tool_code", header: "Tool Code" },
    { accessorKey: "name", header: "Name" },
    { accessorKey: "location_path", header: "Location" },
    { accessorKey: "bin_code", header: "Bin" },
    { accessorKey: "bin_name", header: "Bin Name" },
    {
      accessorKey: "allocated",
      header: "Allocated",
      cell: ({ row }) => row.original.allocated.toFixed(2),
    },
    {
      accessorKey: "reserved",
      header: "Reserved",
      cell: ({ row }) => <span className="text-warning">{row.original.reserved.toFixed(2)}</span>,
    },
    {
      accessorKey: "available",
      header: "Available",
      cell: ({ row }) => <span className="text-success font-medium">{row.original.available.toFixed(2)}</span>,
    },
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div className="space-y-1">
          <CardTitle>Tools on-hand</CardTitle>
          <CardDescription>
            Tool quantities per bin. Allocate, move and return tools from Tool Management.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tools, bins…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <Button asChild variant="outline">
            <Link to="/warehouse/tool-management">
              <ExternalLink className="mr-2 h-4 w-4" />
              Tool Management
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <DataTable columns={columns} data={data} isLoading={isLoading} />
      </CardContent>
    </Card>
  );
}
