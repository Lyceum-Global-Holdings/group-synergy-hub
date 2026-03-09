import { useEffect, useRef, useState, useCallback } from "react";
import mermaid from "mermaid";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ZoomIn, ZoomOut, Maximize2, Move } from "lucide-react";

// Domain groupings
const DOMAIN_GROUPS: Record<string, { label: string; tables: string[] }> = {
  all: {
    label: "All Tables (Overview)",
    tables: [],
  },
  assets: {
    label: "Asset Management",
    tables: [
      "asset_categories", "asset_master", "asset_master_purchase_history",
      "asset_request_approvals", "asset_request_deliveries", "asset_request_delivery_items",
      "asset_request_items", "asset_request_returns", "asset_request_workflow_history",
      "asset_requests", "asset_transactions", "asset_transfers", "warehouse_assets",
    ],
  },
  finance: {
    label: "Finance & Banking",
    tables: [
      "bank_accounts", "bank_reconciliation_sessions", "bank_reconciliations",
      "bank_statement_imports", "bank_statement_lines", "bank_statements", "bank_transactions",
      "chart_of_accounts", "journal_entries", "journal_entry_lines", "accounting_periods",
    ],
  },
  warehouse: {
    label: "Warehouse & Inventory",
    tables: [
      "warehouse_items", "warehouse_bins", "warehouse_locations", "warehouse_assets",
      "warehouse_stock_transactions", "stock_transactions",
      "batch_issue_details", "batch_stock_allocations", "item_batches",
      "bin_types", "inventory_adjustments",
      "material_issue_items", "material_issues",
    ],
  },
  procurement: {
    label: "Procurement & PO",
    tables: [
      "purchase_orders", "purchase_order_items",
      "purchase_requisitions", "purchase_requisition_items",
      "grn_master", "grn_items", "suppliers", "supplier_blacklist", "blacklist_reviews",
      "blanket_purchase_orders", "blanket_po_items", "blanket_po_releases",
      "blanket_po_release_items", "blanket_po_amendments", "blanket_po_spending_analytics",
    ],
  },
  bom: {
    label: "Bill of Materials",
    tables: [
      "bill_of_materials", "product_master",
    ],
  },
  approvals: {
    label: "Approvals & Workflow",
    tables: [
      "approval_routing_rules", "approval_stages", "approver_assignments",
    ],
  },
  users: {
    label: "Users & Access",
    tables: [
      "profiles", "user_roles", "roles", "role_permissions",
      "module_access", "location_user_permissions", "companies", "company_settings", "departments",
    ],
  },
  construction: {
    label: "Construction Inventory",
    tables: [
      "construction_inventory_items", "construction_inventory_stock",
      "construction_inventory_transactions",
    ],
  },
};

interface Relationship {
  from: string;
  fromCol: string;
  to: string;
  toCol: string;
}

const RELATIONSHIPS: Relationship[] = [
  { from: "approval_routing_rules", fromCol: "company_id", to: "companies", toCol: "id" },
  { from: "approval_stages", fromCol: "company_id", to: "companies", toCol: "id" },
  { from: "approver_assignments", fromCol: "company_id", to: "companies", toCol: "id" },
  { from: "asset_categories", fromCol: "parent_id", to: "asset_categories", toCol: "id" },
  { from: "asset_master", fromCol: "category_id", to: "asset_categories", toCol: "id" },
  { from: "asset_master", fromCol: "subcategory_id", to: "asset_categories", toCol: "id" },
  { from: "asset_master_purchase_history", fromCol: "asset_master_id", to: "asset_master", toCol: "id" },
  { from: "asset_request_approvals", fromCol: "request_id", to: "asset_requests", toCol: "id" },
  { from: "asset_request_deliveries", fromCol: "request_id", to: "asset_requests", toCol: "id" },
  { from: "asset_request_delivery_items", fromCol: "delivery_id", to: "asset_request_deliveries", toCol: "id" },
  { from: "asset_request_delivery_items", fromCol: "request_item_id", to: "asset_request_items", toCol: "id" },
  { from: "asset_request_items", fromCol: "asset_master_id", to: "asset_master", toCol: "id" },
  { from: "asset_request_items", fromCol: "category_id", to: "asset_categories", toCol: "id" },
  { from: "asset_request_items", fromCol: "request_id", to: "asset_requests", toCol: "id" },
  { from: "asset_request_items", fromCol: "subcategory_id", to: "asset_categories", toCol: "id" },
  { from: "asset_request_items", fromCol: "warehouse_asset_id", to: "warehouse_assets", toCol: "id" },
  { from: "asset_request_returns", fromCol: "company_id", to: "companies", toCol: "id" },
  { from: "asset_request_returns", fromCol: "delivery_id", to: "asset_request_deliveries", toCol: "id" },
  { from: "asset_request_returns", fromCol: "request_id", to: "asset_requests", toCol: "id" },
  { from: "asset_request_workflow_history", fromCol: "request_id", to: "asset_requests", toCol: "id" },
  { from: "asset_requests", fromCol: "department_id", to: "warehouse_locations", toCol: "id" },
  { from: "asset_transactions", fromCol: "asset_id", to: "asset_master", toCol: "id" },
  { from: "asset_transactions", fromCol: "company_id", to: "companies", toCol: "id" },
  { from: "asset_transactions", fromCol: "journal_entry_id", to: "journal_entries", toCol: "id" },
  { from: "asset_transactions", fromCol: "warehouse_asset_id", to: "warehouse_assets", toCol: "id" },
  { from: "asset_transfers", fromCol: "asset_id", to: "warehouse_assets", toCol: "id" },
  { from: "asset_transfers", fromCol: "from_location_id", to: "warehouse_locations", toCol: "id" },
  { from: "asset_transfers", fromCol: "to_location_id", to: "warehouse_locations", toCol: "id" },
  { from: "bank_accounts", fromCol: "company_id", to: "companies", toCol: "id" },
  { from: "bank_accounts", fromCol: "gl_account_id", to: "chart_of_accounts", toCol: "id" },
  { from: "bank_reconciliation_sessions", fromCol: "bank_account_id", to: "bank_accounts", toCol: "id" },
  { from: "bank_reconciliation_sessions", fromCol: "company_id", to: "companies", toCol: "id" },
  { from: "bank_reconciliation_sessions", fromCol: "statement_import_id", to: "bank_statement_imports", toCol: "id" },
  { from: "bank_reconciliations", fromCol: "bank_account_id", to: "bank_accounts", toCol: "id" },
  { from: "bank_reconciliations", fromCol: "company_id", to: "companies", toCol: "id" },
  { from: "bank_reconciliations", fromCol: "statement_id", to: "bank_statements", toCol: "id" },
  { from: "bank_statement_imports", fromCol: "bank_account_id", to: "bank_accounts", toCol: "id" },
  { from: "bank_statement_imports", fromCol: "company_id", to: "companies", toCol: "id" },
  { from: "bank_statement_lines", fromCol: "gl_account_id", to: "chart_of_accounts", toCol: "id" },
  { from: "bank_statement_lines", fromCol: "import_id", to: "bank_statement_imports", toCol: "id" },
  { from: "bank_statement_lines", fromCol: "matched_transaction_id", to: "bank_transactions", toCol: "id" },
  { from: "bank_statements", fromCol: "bank_account_id", to: "bank_accounts", toCol: "id" },
  { from: "bank_statements", fromCol: "company_id", to: "companies", toCol: "id" },
  { from: "bank_transactions", fromCol: "bank_account_id", to: "bank_accounts", toCol: "id" },
  { from: "bank_transactions", fromCol: "company_id", to: "companies", toCol: "id" },
  { from: "bank_transactions", fromCol: "journal_entry_id", to: "journal_entries", toCol: "id" },
  { from: "journal_entry_lines", fromCol: "journal_entry_id", to: "journal_entries", toCol: "id" },
  { from: "journal_entry_lines", fromCol: "account_id", to: "chart_of_accounts", toCol: "id" },
  { from: "stock_transactions", fromCol: "item_id", to: "warehouse_items", toCol: "id" },
  { from: "stock_transactions", fromCol: "issued_to_location_id", to: "warehouse_locations", toCol: "id" },
  { from: "batch_issue_details", fromCol: "batch_id", to: "item_batches", toCol: "id" },
  { from: "batch_issue_details", fromCol: "issue_item_id", to: "material_issue_items", toCol: "id" },
  { from: "batch_stock_allocations", fromCol: "batch_id", to: "item_batches", toCol: "id" },
  { from: "batch_stock_allocations", fromCol: "bin_id", to: "warehouse_bins", toCol: "id" },
  { from: "material_issue_items", fromCol: "material_issue_id", to: "material_issues", toCol: "id" },
  { from: "material_issue_items", fromCol: "item_id", to: "warehouse_items", toCol: "id" },
  { from: "purchase_orders", fromCol: "supplier_id", to: "suppliers", toCol: "id" },
  { from: "purchase_orders", fromCol: "company_id", to: "companies", toCol: "id" },
  { from: "purchase_order_items", fromCol: "purchase_order_id", to: "purchase_orders", toCol: "id" },
  { from: "purchase_requisitions", fromCol: "company_id", to: "companies", toCol: "id" },
  { from: "purchase_requisition_items", fromCol: "requisition_id", to: "purchase_requisitions", toCol: "id" },
  { from: "grn_master", fromCol: "purchase_order_id", to: "purchase_orders", toCol: "id" },
  { from: "grn_master", fromCol: "supplier_id", to: "suppliers", toCol: "id" },
  { from: "grn_items", fromCol: "grn_id", to: "grn_master", toCol: "id" },
  { from: "supplier_blacklist", fromCol: "supplier_id", to: "suppliers", toCol: "id" },
  { from: "blacklist_reviews", fromCol: "blacklist_id", to: "supplier_blacklist", toCol: "id" },
  { from: "blanket_purchase_orders", fromCol: "supplier_id", to: "suppliers", toCol: "id" },
  { from: "blanket_purchase_orders", fromCol: "company_id", to: "companies", toCol: "id" },
  { from: "blanket_po_items", fromCol: "bpo_id", to: "blanket_purchase_orders", toCol: "id" },
  { from: "blanket_po_items", fromCol: "warehouse_item_id", to: "warehouse_items", toCol: "id" },
  { from: "blanket_po_releases", fromCol: "bpo_id", to: "blanket_purchase_orders", toCol: "id" },
  { from: "blanket_po_release_items", fromCol: "bpo_item_id", to: "blanket_po_items", toCol: "id" },
  { from: "blanket_po_release_items", fromCol: "release_id", to: "blanket_po_releases", toCol: "id" },
  { from: "blanket_po_amendments", fromCol: "bpo_id", to: "blanket_purchase_orders", toCol: "id" },
  { from: "blanket_po_spending_analytics", fromCol: "bpo_id", to: "blanket_purchase_orders", toCol: "id" },
  { from: "bill_of_materials", fromCol: "company_id", to: "companies", toCol: "id" },
  { from: "bill_of_materials", fromCol: "po_id", to: "purchase_orders", toCol: "id" },
  { from: "bill_of_materials", fromCol: "product_master_id", to: "product_master", toCol: "id" },
  { from: "bill_of_materials", fromCol: "warehouse_item_id", to: "warehouse_items", toCol: "id" },
  { from: "company_settings", fromCol: "company_id", to: "companies", toCol: "id" },
];

function abbr(name: string): string {
  return name.replace(/-/g, "_");
}

function buildMermaidDiagram(domain: string): string {
  const group = DOMAIN_GROUPS[domain];
  if (!group) return "";

  let tables: Set<string>;
  let rels: Relationship[];

  if (domain === "all") {
    const allTables = new Set<string>();
    Object.values(DOMAIN_GROUPS).forEach((g) => g.tables.forEach((t) => allTables.add(t)));
    tables = allTables;
    rels = RELATIONSHIPS.filter((r) => allTables.has(r.from) && allTables.has(r.to));
    const domainOf = (t: string) => {
      for (const [key, val] of Object.entries(DOMAIN_GROUPS)) {
        if (key !== "all" && val.tables.includes(t)) return key;
      }
      return "other";
    };
    rels = rels.filter((r) => domainOf(r.from) !== domainOf(r.to));
  } else {
    tables = new Set(group.tables);
    rels = RELATIONSHIPS.filter((r) => tables.has(r.from) || tables.has(r.to));
    rels.forEach((r) => { tables.add(r.from); tables.add(r.to); });
  }

  const seen = new Set<string>();
  const uniqueRels = rels.filter((r) => {
    const key = `${r.from}.${r.fromCol}->${r.to}.${r.toCol}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  let diagram = "erDiagram\n";

  const mentionedTables = new Set<string>();
  uniqueRels.forEach((r) => { mentionedTables.add(r.from); mentionedTables.add(r.to); });

  tables.forEach((t) => {
    if (!mentionedTables.has(t)) {
      diagram += `    ${abbr(t)} {\n        string id PK\n    }\n`;
    }
  });

  uniqueRels.forEach((r) => {
    const label = `${r.fromCol} to ${r.toCol}`;
    diagram += `    ${abbr(r.to)} ||--o{ ${abbr(r.from)} : "${label}"\n`;
  });

  return diagram;
}

mermaid.initialize({
  startOnLoad: false,
  theme: "default",
  er: {
    useMaxWidth: false,
    layoutDirection: "TB",
    fontSize: 14,
  },
  securityLevel: "loose",
});

export function SchemaDiagramPanel() {
  const [domain, setDomain] = useState("finance");
  const [svgContent, setSvgContent] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const renderDiagram = useCallback(async () => {
    setLoading(true);
    try {
      const definition = buildMermaidDiagram(domain);
      const id = `schema-diagram-${Date.now()}`;
      const { svg } = await mermaid.render(id, definition);
      setSvgContent(svg);
      setScale(0.8);
      setPosition({ x: 0, y: 0 });
    } catch (err) {
      console.error("Mermaid render error:", err);
      setSvgContent(`<p style="color:red;padding:20px;">Failed to render diagram. Try a specific domain group.</p>`);
    }
    setLoading(false);
  }, [domain]);

  useEffect(() => {
    renderDiagram();
  }, [renderDiagram]);

  const handleZoomIn = () => setScale((s) => Math.min(s + 0.2, 3));
  const handleZoomOut = () => setScale((s) => Math.max(s - 0.2, 0.2));
  const handleFit = () => { setScale(0.6); setPosition({ x: 0, y: 0 }); };

  // Removed scroll-wheel zoom — only toolbar buttons control zoom

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  }, [position]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const group = DOMAIN_GROUPS[domain];
  const relevantRels = domain === "all"
    ? RELATIONSHIPS
    : RELATIONSHIPS.filter((r) => group.tables.includes(r.from) || group.tables.includes(r.to));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="text-lg">Schema Diagram</CardTitle>
            <div className="flex items-center gap-2">
              <Select value={domain} onValueChange={setDomain}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(DOMAIN_GROUPS).map(([key, val]) => (
                    <SelectItem key={key} value={key}>
                      {val.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Badge variant="outline" className="text-xs whitespace-nowrap">
                {group?.tables.length || 0} tables
              </Badge>
              <Badge variant="secondary" className="text-xs whitespace-nowrap">
                {relevantRels.length} relations
              </Badge>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Entity-Relationship diagram showing foreign key connections between tables. Use toolbar buttons to zoom, click and drag to pan.
          </p>
        </CardHeader>
        <CardContent>
          {/* Zoom controls */}
          <div className="flex items-center gap-1 mb-3">
            <Button variant="outline" size="sm" onClick={handleZoomIn} title="Zoom In">
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleZoomOut} title="Zoom Out">
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleFit} title="Fit to View">
              <Maximize2 className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground ml-2">{Math.round(scale * 100)}%</span>
            <div className="flex items-center gap-1 ml-3 text-xs text-muted-foreground">
              <Move className="h-3 w-3" />
              Drag to pan
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-[600px]">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div
              ref={wrapperRef}
              className="relative border border-border rounded-lg overflow-hidden bg-muted/30"
              style={{ height: "600px", cursor: isDragging ? "grabbing" : "grab" }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <div
                ref={containerRef}
                style={{
                  transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                  transformOrigin: "top left",
                  transition: isDragging ? "none" : "transform 0.15s ease",
                  display: "inline-block",
                  minWidth: "max-content",
                  padding: "20px",
                }}
                dangerouslySetInnerHTML={{ __html: svgContent }}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Relationship Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Foreign Key References</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[250px]">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2 font-semibold">From Table</th>
                  <th className="text-left py-2 px-2 font-semibold">FK Column</th>
                  <th className="text-left py-2 px-2 font-semibold">References</th>
                  <th className="text-left py-2 px-2 font-semibold">PK Column</th>
                </tr>
              </thead>
              <tbody>
                {relevantRels.map((r, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-muted/50">
                    <td className="py-1.5 px-2 font-mono">{r.from}</td>
                    <td className="py-1.5 px-2">
                      <Badge variant="outline" className="text-xs font-mono">{r.fromCol}</Badge>
                    </td>
                    <td className="py-1.5 px-2 font-mono">{r.to}</td>
                    <td className="py-1.5 px-2">
                      <Badge variant="secondary" className="text-xs font-mono">{r.toCol}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}