import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataTable } from '@/components/ui/data-table';
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
} from 'lucide-react';
import { useStockAudit, type StockAuditItem, type StockAuditStatus } from '@/hooks/useStockAudit';
import { useIsAdminOrHigher } from '@/hooks/useIsAdminOrHigher';
import type { ColumnDef } from '@tanstack/react-table';

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

export function StockAuditTab() {
  const { auditItems, isLoading, refetch, summary, fixDesync, isFixingDesync, fixAllDesyncs, isFixingAll } = useStockAudit();
  const { canDelete: isAdmin } = useIsAdminOrHigher();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterValue>('all');
  const [fixItem, setFixItem] = useState<StockAuditItem | null>(null);
  const [showFixAllDialog, setShowFixAllDialog] = useState(false);

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
