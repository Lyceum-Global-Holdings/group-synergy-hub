import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Building2, Warehouse as WarehouseIcon, Layers, ChevronRight, ChevronDown, AlertCircle, Network, ListTree, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';

type SubNode = {
  id: string;
  name: string;
  type: string;
  location_code: string | null;
  status: string | null;
  company_id: string | null;
  company_name: string | null;
  bin_count: number;
  sku_count: number;
  total_qty: number;
};

type WarehouseNode = SubNode & { children: SubNode[] };

type CompanyNode = {
  company_id: string | null;
  company_name: string;
  warehouses: WarehouseNode[];
};

function useHierarchy() {
  return useQuery({
    queryKey: ['warehouse-network-hierarchy'],
    staleTime: 30_000,
    queryFn: async (): Promise<CompanyNode[]> => {
      const { data, error } = await (supabase as any).rpc('get_location_hierarchy', {
        _company_id: null,
      });
      if (error) throw error;
      return (data ?? []) as CompanyNode[];
    },
  });
}

function StatPill({ label, value }: { label: string; value: number | string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
      <span className="font-medium text-foreground">{value}</span>
      {label}
    </span>
  );
}

function SubLocationRow({ node }: { node: SubNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-card px-3 py-2 hover:bg-muted/40">
      <div className="flex items-center gap-2 min-w-0">
        <Layers className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">{node.name}</div>
          {node.location_code && (
            <div className="text-xs text-muted-foreground truncate">{node.location_code}</div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <StatPill label="bins" value={node.bin_count} />
        <StatPill label="SKUs" value={node.sku_count} />
      </div>
    </div>
  );
}

function WarehouseCard({ node }: { node: WarehouseNode }) {
  const [open, setOpen] = useState(true);
  const hasChildren = node.children?.length > 0;
  return (
    <div className="rounded-lg border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 hover:bg-muted/30"
      >
        <div className="flex items-center gap-2 min-w-0">
          {hasChildren ? (
            open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
          ) : (
            <span className="w-4" />
          )}
          <WarehouseIcon className="h-4 w-4 text-primary" />
          <div className="text-left min-w-0">
            <div className="text-sm font-semibold truncate">{node.name}</div>
            <div className="text-xs text-muted-foreground truncate">
              {node.location_code || 'Warehouse'} · {node.children.length} sub-location{node.children.length === 1 ? '' : 's'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatPill label="bins" value={node.bin_count} />
          <StatPill label="SKUs" value={node.sku_count} />
          {node.status && node.status !== 'active' && (
            <Badge variant="secondary" className="text-xs">{node.status}</Badge>
          )}
        </div>
      </button>
      {open && hasChildren && (
        <div className="grid gap-2 px-4 pb-3 pl-10">
          {node.children.map((c) => <SubLocationRow key={c.id} node={c} />)}
        </div>
      )}
    </div>
  );
}

function CompanyBlock({ node }: { node: CompanyNode }) {
  const totals = useMemo(() => {
    let bins = 0, skus = 0;
    for (const w of node.warehouses) {
      bins += w.bin_count + w.children.reduce((s, c) => s + c.bin_count, 0);
      skus += w.sku_count + w.children.reduce((s, c) => s + c.sku_count, 0);
    }
    return { bins, skus };
  }, [node]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <span>{node.company_name}</span>
            {!node.company_id && (
              <Badge variant="destructive" className="ml-2 text-xs gap-1">
                <AlertCircle className="h-3 w-3" /> Unassigned
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm font-normal">
            <StatPill label="warehouses" value={node.warehouses.length} />
            <StatPill label="bins" value={totals.bins} />
            <StatPill label="SKUs" value={totals.skus} />
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {node.warehouses.length === 0 ? (
          <div className="text-sm text-muted-foreground italic">No warehouses configured</div>
        ) : (
          node.warehouses.map((w) => <WarehouseCard key={w.id} node={w} />)
        )}
      </CardContent>
    </Card>
  );
}

/* ─────────── Diagram view (SVG dendrogram) ─────────── */

function DiagramView({ companies }: { companies: CompanyNode[] }) {
  // Layout: columns Org → Company → Warehouse → Sub-location
  const ROW_H = 32;
  const COL_W = 260;
  const PAD_X = 16;

  // Flatten leaves to compute row positions
  type LeafRow = { type: 'company' | 'warehouse' | 'sub'; node: any; parent?: any; row: number };
  const rows: LeafRow[] = [];
  for (const c of companies) {
    const cStart = rows.length;
    if (c.warehouses.length === 0) {
      rows.push({ type: 'company', node: c, row: rows.length });
      continue;
    }
    for (const w of c.warehouses) {
      const wStart = rows.length;
      if (w.children.length === 0) {
        rows.push({ type: 'warehouse', node: w, parent: c, row: rows.length });
      } else {
        for (const s of w.children) {
          rows.push({ type: 'sub', node: s, parent: w, row: rows.length });
        }
        // tag warehouse row range
        (w as any)._range = [wStart, rows.length - 1];
      }
    }
    (c as any)._range = [cStart, rows.length - 1];
  }

  const height = Math.max(rows.length * ROW_H + 40, 200);
  const orgX = PAD_X;
  const companyX = orgX + COL_W;
  const warehouseX = companyX + COL_W;
  const subX = warehouseX + COL_W;
  const width = subX + COL_W;

  // Org node centered vertically
  const orgY = height / 2;

  const renderText = (x: number, y: number, label: string, sub?: string, bold = false) => (
    <g>
      <rect x={x} y={y - 12} width={COL_W - 20} height={24} rx={6}
        className="fill-card stroke-border" strokeWidth={1} />
      <text x={x + 10} y={y + 1} className={`fill-foreground text-[11px] ${bold ? 'font-semibold' : ''}`}
        dominantBaseline="middle">{label}</text>
      {sub && (
        <text x={x + COL_W - 30} y={y + 1} className="fill-muted-foreground text-[10px]"
          dominantBaseline="middle" textAnchor="end">{sub}</text>
      )}
    </g>
  );

  return (
    <div className="overflow-auto rounded-lg border border-border bg-card">
      <svg width={width} height={height} className="block">
        {/* Org node */}
        {renderText(orgX, orgY, 'All Companies', `${companies.length}`, true)}

        {companies.map((c, ci) => {
          const range = (c as any)._range as [number, number] | undefined;
          const cMid = range ? ((range[0] + range[1]) / 2) * ROW_H + 30 : ci * ROW_H + 30;

          return (
            <g key={c.company_id ?? `c-${ci}`}>
              {/* Edge org -> company */}
              <path
                d={`M ${orgX + COL_W - 20} ${orgY} C ${companyX - 20} ${orgY}, ${companyX - 20} ${cMid}, ${companyX} ${cMid}`}
                className="stroke-border fill-none" strokeWidth={1.2}
              />
              {renderText(companyX, cMid, c.company_name, `${c.warehouses.length}w`, true)}

              {c.warehouses.map((w) => {
                const wRange = (w as any)._range as [number, number] | undefined;
                const wMid = wRange ? ((wRange[0] + wRange[1]) / 2) * ROW_H + 30
                  : (rows.findIndex(r => r.node === w)) * ROW_H + 30;

                return (
                  <g key={w.id}>
                    <path
                      d={`M ${companyX + COL_W - 20} ${cMid} C ${warehouseX - 20} ${cMid}, ${warehouseX - 20} ${wMid}, ${warehouseX} ${wMid}`}
                      className="stroke-border fill-none" strokeWidth={1.2}
                    />
                    {renderText(warehouseX, wMid, w.name, `${w.bin_count}b · ${w.sku_count}s`)}

                    {w.children.map((s) => {
                      const sRow = rows.findIndex(r => r.node === s);
                      const sY = sRow * ROW_H + 30;
                      return (
                        <g key={s.id}>
                          <path
                            d={`M ${warehouseX + COL_W - 20} ${wMid} C ${subX - 20} ${wMid}, ${subX - 20} ${sY}, ${subX} ${sY}`}
                            className="stroke-border fill-none" strokeWidth={1.2}
                          />
                          {renderText(subX, sY, s.name, `${s.bin_count}b · ${s.sku_count}s`)}
                        </g>
                      );
                    })}
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ─────────── Page ─────────── */

export default function WarehouseNetwork() {
  const { data, isLoading, error, refetch, isRefetching } = useHierarchy();
  const companies = data ?? [];
  const orphans = companies.find((c) => !c.company_id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Network className="h-7 w-7 text-primary" />
            Warehouse Network
          </h1>
          <p className="text-muted-foreground">
            Org → Company → Warehouse → Sub-location interconnectivity. Bins live at warehouse
            or sub-location level; stock allocations always track the physical node.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {orphans && orphans.warehouses.length > 0 && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-destructive" />
              {orphans.warehouses.length} location{orphans.warehouses.length === 1 ? '' : 's'} not assigned to any company
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Open <em>Item &amp; Bin Master → Bin Master</em> to assign these to a company, or delete
            them if unused. Sub-locations under an unassigned warehouse cannot enforce company-scoped RLS.
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="tree" className="space-y-4">
        <TabsList>
          <TabsTrigger value="tree" className="gap-2"><ListTree className="h-4 w-4" />Tree</TabsTrigger>
          <TabsTrigger value="diagram" className="gap-2"><Network className="h-4 w-4" />Diagram</TabsTrigger>
        </TabsList>

        <TabsContent value="tree" className="space-y-4">
          {isLoading && <div className="text-sm text-muted-foreground">Loading hierarchy…</div>}
          {error && <div className="text-sm text-destructive">Failed to load: {(error as Error).message}</div>}
          {!isLoading && companies.length === 0 && (
            <div className="text-sm text-muted-foreground italic">No warehouses configured yet.</div>
          )}
          {companies.map((c, i) => <CompanyBlock key={c.company_id ?? `c-${i}`} node={c} />)}
        </TabsContent>

        <TabsContent value="diagram">
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : (
            <ScrollArea className="w-full">
              <DiagramView companies={companies} />
            </ScrollArea>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
