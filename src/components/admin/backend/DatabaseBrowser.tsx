import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Database, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

// List of known public tables from the types file
const KNOWN_TABLES = [
  "accounting_periods", "approval_routing_rules", "approval_stages", "approver_assignments",
  "asset_categories", "asset_master", "asset_master_purchase_history",
  "asset_request_approvals", "asset_request_deliveries", "asset_request_delivery_items",
  "asset_request_items", "asset_request_returns", "asset_request_workflow_history",
  "asset_requests", "asset_transactions", "asset_transfers",
  "bank_accounts", "bank_reconciliation_sessions", "bank_reconciliations",
  "bank_statement_imports", "bank_statement_lines", "bank_statements", "bank_transactions",
  "batch_issue_details", "batch_stock_allocations", "bill_of_materials", "bin_types",
  "blacklist_reviews", "blanket_po_amendments", "blanket_po_items",
  "blanket_po_release_items", "blanket_po_releases", "blanket_po_spending_analytics",
  "blanket_purchase_orders", "chart_of_accounts", "companies", "company_settings",
  "construction_inventory_items", "construction_inventory_stock",
  "construction_inventory_transactions", "departments",
  "grn_items", "grn_master", "inventory_adjustments",
  "item_batches", "journal_entries", "journal_entry_lines",
  "location_user_permissions", "material_issue_items", "material_issues",
  "module_access", "notifications",
  "product_master", "profiles", "purchase_order_items", "purchase_orders",
  "purchase_requisition_items", "purchase_requisitions",
  "role_permissions", "roles", "supplier_blacklist", "suppliers",
  "system_error_logs", "user_roles",
  "warehouse_assets", "warehouse_bins", "warehouse_items", "warehouse_locations",
  "warehouse_stock_transactions",
] as const;

type TableName = typeof KNOWN_TABLES[number];

export function DatabaseBrowser() {
  const [search, setSearch] = useState("");
  const [selectedTable, setSelectedTable] = useState<TableName | null>(null);
  const [page, setPage] = useState(0);
  const pageSize = 25;

  const filteredTables = KNOWN_TABLES.filter((t) =>
    t.toLowerCase().includes(search.toLowerCase())
  );

  const { data: tableData, isLoading } = useQuery({
    queryKey: ["admin-db-browse", selectedTable, page],
    queryFn: async () => {
      if (!selectedTable) return null;
      const from = page * pageSize;
      const to = from + pageSize - 1;
      
      try {
        const { data, error, count } = await (supabase
          .from(selectedTable as any) as any)
          .select("*", { count: "exact" })
          .range(from, to)
          .order("created_at", { ascending: false });

        if (error) throw error;
        return { rows: data || [], count: count || 0 };
      } catch {
        // Fallback without ordering if created_at doesn't exist
        const { data: d2, error: e2, count: c2 } = await (supabase
          .from(selectedTable as any) as any)
          .select("*", { count: "exact" })
          .range(from, to);
        if (e2) throw e2;
        return { rows: d2 || [], count: c2 || 0 };
      }
    },
    enabled: !!selectedTable,
  });

  const columns = tableData?.rows?.[0] ? Object.keys(tableData.rows[0]) : [];
  const totalPages = tableData ? Math.ceil(tableData.count / pageSize) : 0;

  return (
    <div className="flex gap-4 h-[calc(100vh-280px)]">
      {/* Table List */}
      <Card className="w-72 shrink-0">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Database className="h-4 w-4" />
            Tables ({filteredTables.length})
          </CardTitle>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tables..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 text-sm"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[calc(100vh-400px)]">
            <div className="space-y-0.5 p-2">
              {filteredTables.map((table) => (
                <button
                  key={table}
                  onClick={() => { setSelectedTable(table); setPage(0); }}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                    selectedTable === table
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted"
                  }`}
                >
                  {table}
                </button>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Data View */}
      <Card className="flex-1 overflow-hidden">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">
              {selectedTable ? (
                <span className="flex items-center gap-2">
                  {selectedTable}
                  <Badge variant="secondary">{tableData?.count ?? "..."} rows</Badge>
                </span>
              ) : (
                "Select a table"
              )}
            </CardTitle>
            {selectedTable && totalPages > 1 && (
              <div className="flex items-center gap-2 text-sm">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-muted-foreground">
                  {page + 1} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !selectedTable ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              Select a table from the left panel to browse records
            </div>
          ) : (
            <ScrollArea className="h-[calc(100vh-360px)]">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {columns.map((col) => (
                        <TableHead key={col} className="whitespace-nowrap text-xs font-semibold">
                          {col}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tableData?.rows?.length ? (
                      tableData.rows.map((row: any, i: number) => (
                        <TableRow key={i}>
                          {columns.map((col) => (
                            <TableCell key={col} className="text-xs max-w-[200px] truncate whitespace-nowrap">
                              {row[col] === null ? (
                                <span className="text-muted-foreground italic">null</span>
                              ) : typeof row[col] === "object" ? (
                                JSON.stringify(row[col]).substring(0, 80)
                              ) : (
                                String(row[col]).substring(0, 80)
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={columns.length || 1} className="text-center h-24 text-muted-foreground">
                          No records found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
