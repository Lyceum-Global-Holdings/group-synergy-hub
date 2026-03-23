import { useState, useMemo, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataTable } from '@/components/ui/data-table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  ShieldAlert,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Wrench,
  History,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';
import { useStockAudit, type StockAuditItem, type StockAuditStatus, type StockAuditLogEntry } from '@/hooks/useStockAudit';
import { useIsAdminOrHigher } from '@/hooks/useIsAdminOrHigher';
import { useCompany } from '@/contexts/CompanyContext';
import { format, parseISO } from 'date-fns';
import type { ColumnDef } from '@tanstack/react-table';
import { AssignLocationDialog } from './AssignLocationDialog';
import { supabase } from '@/integrations/supabase/client';

type FilterValue = 'all' | StockAuditStatus;

const statusConfig: Record<StockAuditStatus, { label: string; variant: 'default' | 'destructive' | 'secondary'; icon: React.ReactNode }> = {
  ok: {
    label: 'In Sync',
    variant: 'secondary',
    icon: <CheckCircle2 className="h-3 w-3 text-success" />,
  },
  desync: {
    label: 'Desynced',
    variant: 'destructive',
    icon: <XCircle className="h-3 w-3" />,
  },
  no_bins: {
    label: 'No Bins',
    variant: 'secondary',
    icon: <AlertTriangle className="h-3 w-3 text-warning" />,
  },
};

function TrendIndicator({ current, previous }: { current: number; previous: number | undefined }) {
  if (previous === undefined) return <Minus className="h-3.5 w-3.5 text-muted-foreground inline" />;
  if (current > previous) return <TrendingUp className="h-3.5 w-3.5 text-destructive inline" />;
  if (current < previous) return <TrendingDown className="h-3.5 w-3.5 text-success inline" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground inline" />;
}

function AuditHistoryPanel({ history }: { history: StockAuditLogEntry[] }) {
  const [open, setOpen] = useState(false);

  if (history.length === 0) {
    return (
      <Card className="opacity-60">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" />
            Audit History
          </CardTitle>
          <CardDescription>No history yet — history is recorded each time this tab is opened.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CardHeader className="pb-3">
          <CollapsibleTrigger asChild>
            <button className="flex w-full items-center justify-between text-left">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <History className="h-4 w-4" />
                  Audit History
                  <Badge variant="secondary" className="text-xs font-normal">{history.length} snapshots</Badge>
                </CardTitle>
                <CardDescription className="mt-0.5">
                  Snapshot recorded each time this tab is opened — track desync trends over time
                </CardDescription>
              </div>
              {open
                ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
              }
            </button>
          </CollapsibleTrigger>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-0">
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">Date / Time</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">Total</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">In Sync</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">Desynced</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">No Bins</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Desynced Items</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((entry, idx) => {
                    const prev = history[idx + 1];
                    const hasDesyncs = entry.desync_count > 0;
                    return (
                      <tr key={entry.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        {/* Date */}
                        <td className="px-3 py-2 whitespace-nowrap font-mono text-xs text-muted-foreground">
                          {format(parseISO(entry.recorded_at), 'yyyy-MM-dd HH:mm')}
                        </td>

                        {/* Total */}
                        <td className="px-3 py-2 text-right tabular-nums">{entry.total_items}</td>

                        {/* In Sync */}
                        <td className="px-3 py-2 text-right tabular-nums text-success">{entry.in_sync_count}</td>

                        {/* Desynced */}
                        <td className="px-3 py-2 text-right tabular-nums">
                          <span className={`inline-flex items-center gap-1 font-medium ${hasDesyncs ? 'text-destructive' : 'text-success'}`}>
                            {entry.desync_count}
                            <TrendIndicator current={entry.desync_count} previous={prev?.desync_count} />
                          </span>
                        </td>

                        {/* No Bins */}
                        <td className="px-3 py-2 text-right tabular-nums">
                          <span className={entry.no_bins_count > 0 ? 'text-warning' : 'text-muted-foreground'}>
                            {entry.no_bins_count}
                          </span>
                        </td>

                        {/* Desynced Items list */}
                        <td className="px-3 py-2">
                          {entry.desynced_items.length === 0 ? (
                            <span className="text-muted-foreground italic text-xs">—</span>
                          ) : (
                            <Popover>
                              <PopoverTrigger asChild>
                                <button className="text-xs text-destructive underline underline-offset-2 hover:no-underline">
                                  {entry.desynced_items.length} item{entry.desynced_items.length > 1 ? 's' : ''}
                                </button>
                              </PopoverTrigger>
                              <PopoverContent className="w-80 p-3" align="start">
                                <p className="text-xs font-medium text-muted-foreground mb-2">Desynced Items at this snapshot</p>
                                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                  {entry.desynced_items.map((item) => (
                                    <div key={item.id} className="flex items-center justify-between text-xs">
                                      <span className="font-mono font-medium">{item.item_code}</span>
                                      <span className="text-muted-foreground truncate max-w-[140px] ml-2">{item.name}</span>
                                      <span className={`ml-2 tabular-nums shrink-0 ${item.variance > 0 ? 'text-warning' : 'text-destructive'}`}>
                                        {item.variance > 0 ? '+' : ''}{item.variance.toFixed(2)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </PopoverContent>
                            </Popover>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

export function StockAuditTab() {
  const { auditItems, isLoading, refetch, summary, auditHistory, logSnapshot, fixDesync, isFixingDesync, fixAllDesyncs, isFixingAll } = useStockAudit();
  const { canDelete: isAdmin } = useIsAdminOrHigher();
  const { selectedCompany } = useCompany();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterValue>('all');
  const [fixItem, setFixItem] = useState<StockAuditItem | null>(null);
  const [showFixAllDialog, setShowFixAllDialog] = useState(false);
  const [showAssignLocationDialog, setShowAssignLocationDialog] = useState(false);
  const [pendingLocationItems, setPendingLocationItems] = useState<StockAuditItem[]>([]);
  const [pendingFixMode, setPendingFixMode] = useState<'single' | 'all'>('all');
  const [pendingFixItem, setPendingFixItem] = useState<StockAuditItem | null>(null);

  // Log a snapshot once per mount, after data finishes loading
  const hasLogged = useRef(false);
  useEffect(() => {
    if (!isLoading && auditItems.length > 0 && !hasLogged.current) {
      hasLogged.current = true;
      logSnapshot(undefined);
    }
  }, [isLoading, auditItems, logSnapshot]);

  const filteredItems = useMemo(() => {
    let items = auditItems;

    if (filterStatus !== 'all') {
      items = items.filter((i) => i.status === filterStatus);
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      items = items.filter(
        (i) =>
          i.item_code.toLowerCase().includes(term) ||
          i.name.toLowerCase().includes(term),
      );
    }

    return items;
  }, [auditItems, searchTerm, filterStatus]);

  const columns: ColumnDef<StockAuditItem>[] = [
    {
      accessorKey: 'item_code',
      header: 'Item Code',
      cell: ({ row }) => (
        <span className="font-mono text-sm font-medium">{row.original.item_code}</span>
      ),
    },
    {
      accessorKey: 'name',
      header: 'Item Name',
    },
    {
      accessorKey: 'current_stock',
      header: 'Item Master Stock',
      cell: ({ row }) => (
        <span className="font-medium tabular-nums">{row.original.current_stock.toFixed(2)}</span>
      ),
    },
    {
      accessorKey: 'bin_total',
      header: 'Bin Total (Sum)',
      cell: ({ row }) => (
        <span className="tabular-nums">
          {row.original.bin_count === 0 ? (
            <span className="text-muted-foreground italic">no bins</span>
          ) : (
            row.original.bin_total.toFixed(2)
          )}
        </span>
      ),
    },
    {
      accessorKey: 'variance',
      header: 'Variance',
      cell: ({ row }) => {
        const v = row.original.variance;
        if (row.original.bin_count === 0 && v > 0) {
          return <span className="text-warning tabular-nums font-medium">+{v.toFixed(2)}</span>;
        }
        if (Math.abs(v) < 0.001) {
          return <span className="text-muted-foreground tabular-nums">0.00</span>;
        }
        return (
          <span className={`tabular-nums font-medium ${v > 0 ? 'text-warning' : 'text-destructive'}`}>
            {v > 0 ? '+' : ''}{v.toFixed(2)}
          </span>
        );
      },
    },
    {
      accessorKey: 'bin_count',
      header: 'Bins',
      cell: ({ row }) => (
        <span className="tabular-nums text-muted-foreground">{row.original.bin_count}</span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const cfg = statusConfig[row.original.status];
        return (
          <Badge
            variant={cfg.variant}
            className={
              row.original.status === 'ok'
                ? 'bg-success/15 text-success border-success/30'
                : row.original.status === 'no_bins'
                ? 'bg-warning/15 text-warning border-warning/30'
                : ''
            }
          >
            <span className="flex items-center gap-1">
              {cfg.icon}
              {cfg.label}
            </span>
          </Badge>
        );
      },
    },
    ...(isAdmin
      ? ([
          {
            id: 'actions',
            header: 'Fix',
            cell: ({ row }: { row: { original: StockAuditItem } }) => {
              if (row.original.status !== 'desync') return null;
              return (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setFixItem(row.original)}
                  disabled={isFixingDesync}
                  className="h-7 text-xs gap-1"
                >
                  <Wrench className="h-3 w-3" />
                  Fix
                </Button>
              );
            },
          },
        ] as ColumnDef<StockAuditItem>[])
      : []),
  ];

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold tabular-nums">{summary.total}</div>
            <div className="text-sm text-muted-foreground mt-1">Items Audited</div>
          </CardContent>
        </Card>

        <Card className={summary.inSync === summary.total && summary.total > 0 ? 'border-success/50' : ''}>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-success tabular-nums">{summary.inSync}</div>
            <div className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-success" />
              In Sync
            </div>
          </CardContent>
        </Card>

        <Card className={summary.desynced > 0 ? 'border-destructive/50' : ''}>
          <CardContent className="pt-6">
            <div className={`text-2xl font-bold tabular-nums ${summary.desynced > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
              {summary.desynced}
            </div>
            <div className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
              <XCircle className="h-3.5 w-3.5 text-destructive" />
              Desynced
            </div>
          </CardContent>
        </Card>

        <Card className={summary.noBins > 0 ? 'border-warning/50' : ''}>
          <CardContent className="pt-6">
            <div className={`text-2xl font-bold tabular-nums ${summary.noBins > 0 ? 'text-warning' : 'text-muted-foreground'}`}>
              {summary.noBins}
            </div>
            <div className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5 text-warning" />
              No Bin Allocations
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Table Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5" />
              Stock Audit
            </CardTitle>
            <CardDescription>
              Compares item master stock against the sum of bin allocations to surface desyncs
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search */}
            <div className="relative w-56">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>

            {/* Filter */}
            <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as FilterValue)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Items</SelectItem>
                <SelectItem value="desync">Desynced Only</SelectItem>
                <SelectItem value="no_bins">No Bins Only</SelectItem>
                <SelectItem value="ok">In Sync Only</SelectItem>
              </SelectContent>
            </Select>

            {/* Refresh */}
            <Button variant="outline" size="icon" onClick={() => refetch()} title="Refresh audit data">
              <RefreshCw className="h-4 w-4" />
            </Button>

            {/* Fix All (admin only) */}
            {isAdmin && summary.desynced > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowFixAllDialog(true)}
                disabled={isFixingAll}
                className="gap-1"
              >
                <Wrench className="h-4 w-4" />
                Fix All ({summary.desynced})
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={filteredItems}
            isLoading={isLoading}
          />
        </CardContent>
      </Card>

      {/* Audit History Panel */}
      <AuditHistoryPanel history={auditHistory} />

      {/* Fix Single Item Dialog */}
      <AlertDialog open={!!fixItem} onOpenChange={() => setFixItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fix Stock Desync</AlertDialogTitle>
            <AlertDialogDescription>
              This will update the bin allocation for{' '}
              <span className="font-semibold">{fixItem?.name}</span> so that the bin total
              matches the item master stock of{' '}
              <span className="font-semibold">{fixItem?.current_stock.toFixed(2)}</span>.
              <br /><br />
              Current bin total: <span className="font-semibold">{fixItem?.bin_total.toFixed(2)}</span>{' '}
              → New bin total:{' '}
              <span className="font-semibold text-success">{fixItem?.current_stock.toFixed(2)}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (fixItem) {
                  fixDesync(fixItem);
                  setFixItem(null);
                }
              }}
              disabled={isFixingDesync}
            >
              Fix Desync
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Fix All Dialog */}
      <AlertDialog open={showFixAllDialog} onOpenChange={setShowFixAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fix All Desynced Items</AlertDialogTitle>
            <AlertDialogDescription>
              This will update bin allocations for all{' '}
              <span className="font-semibold">{summary.desynced}</span> desynced item(s) so that
              their bin totals match the item master stock values. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                fixAllDesyncs(undefined);
                setShowFixAllDialog(false);
              }}
              disabled={isFixingAll}
            >
              Fix All {summary.desynced} Items
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
