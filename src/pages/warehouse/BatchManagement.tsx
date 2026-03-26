import { useState } from "react";
import { useCompany } from "@/contexts/CompanyContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Layers, 
  Search, 
  AlertTriangle, 
  XCircle, 
  TrendingDown,
  CheckCircle,
  Eye,
  Package,
  Shield,
  RefreshCw
} from "lucide-react";
import { useAllBatches, useBatchSummary, useBatchTrackedItems } from "@/hooks/useBatches";
import { BatchFilters, BatchStatus, ItemBatch } from "@/types/batch";
import { BatchDetailsDialog } from "@/components/warehouse/BatchDetailsDialog";
import { format, parseISO, isAfter, isBefore, addDays } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";

const statusConfig: Record<BatchStatus, { label: string; color: string; icon: React.ReactNode }> = {
  active: { 
    label: 'Active', 
    color: 'bg-green-500/10 text-green-600 border-green-500/20',
    icon: <CheckCircle className="h-3 w-3" />
  },
  depleted: { 
    label: 'Depleted', 
    color: 'bg-muted text-muted-foreground border-border',
    icon: <Package className="h-3 w-3" />
  },
  expired: { 
    label: 'Expired', 
    color: 'bg-red-500/10 text-red-600 border-red-500/20',
    icon: <XCircle className="h-3 w-3" />
  },
  quarantine: { 
    label: 'Quarantine', 
    color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
    icon: <Shield className="h-3 w-3" />
  },
};

export default function BatchManagement() {
  const queryClient = useQueryClient();
  const { selectedCompany } = useCompany();
  const [filters, setFilters] = useState<BatchFilters>({
    status: 'all',
    expiryFilter: 'all',
    searchTerm: '',
    warehouseItemId: undefined,
  });
  const [selectedBatch, setSelectedBatch] = useState<ItemBatch | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const { data: batches = [], isLoading: batchesLoading, refetch } = useAllBatches(filters, selectedCompany?.id);
  const { data: summary, isLoading: summaryLoading } = useBatchSummary();
  const { data: batchTrackedItems = [] } = useBatchTrackedItems();

  const handleViewDetails = (batch: ItemBatch) => {
    setSelectedBatch(batch);
    setDetailsOpen(true);
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['all-batches'] });
    queryClient.invalidateQueries({ queryKey: ['batch-summary'] });
    refetch();
  };

  const today = new Date();
  const thirtyDaysFromNow = addDays(today, 30);

  const getExpiryStatus = (expiryDate?: string) => {
    if (!expiryDate) return null;
    const date = parseISO(expiryDate);
    if (isBefore(date, today)) return 'expired';
    if (isAfter(date, today) && isBefore(date, thirtyDaysFromNow)) return 'expiring_soon';
    return 'ok';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Layers className="h-8 w-8" />
            Batch Management
          </h1>
          <p className="text-muted-foreground">
            Manage and track item batches with FIFO issuing
          </p>
        </div>
        <Button variant="outline" onClick={handleRefresh}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Batches</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{summary?.total_active || 0}</div>
            )}
            <p className="text-xs text-muted-foreground">Currently in stock</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold text-orange-600">{summary?.expiring_soon || 0}</div>
            )}
            <p className="text-xs text-muted-foreground">Within 30 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expired</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold text-red-600">{summary?.expired || 0}</div>
            )}
            <p className="text-xs text-muted-foreground">Need attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock</CardTitle>
            <TrendingDown className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold text-yellow-600">{summary?.low_stock || 0}</div>
            )}
            <p className="text-xs text-muted-foreground">&lt; 10% remaining</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
          <CardDescription>Search and filter batches</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search batch number, item..."
                className="pl-10"
                value={filters.searchTerm}
                onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
              />
            </div>

            <Select
              value={filters.status || 'all'}
              onValueChange={(value) => setFilters({ ...filters, status: value as BatchStatus | 'all' })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="depleted">Depleted</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="quarantine">Quarantine</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.expiryFilter || 'all'}
              onValueChange={(value) => setFilters({ ...filters, expiryFilter: value as BatchFilters['expiryFilter'] })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Expiry Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Expiry</SelectItem>
                <SelectItem value="expiring_soon">Expiring Soon (30 days)</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="not_set">No Expiry Set</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.warehouseItemId || 'all'}
              onValueChange={(value) => setFilters({ ...filters, warehouseItemId: value === 'all' ? undefined : value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Filter by Item" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Items</SelectItem>
                {batchTrackedItems.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name} {item.item_code && `(${item.item_code})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Batches Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Batches</CardTitle>
          <CardDescription>
            {batches.length} batch{batches.length !== 1 ? 'es' : ''} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {batchesLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : batches.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No batches found matching your criteria</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Batch Number</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Mfg Date</TableHead>
                    <TableHead>Expiry Date</TableHead>
                    <TableHead className="text-right">Qty Received</TableHead>
                    <TableHead className="text-right">Qty Remaining</TableHead>
                    <TableHead className="text-right">Unit Cost</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batches.map((batch) => {
                    const config = statusConfig[batch.status];
                    const expiryStatus = getExpiryStatus(batch.expiry_date);
                    const remainingPercent = batch.quantity_received > 0 
                      ? (batch.quantity_remaining / batch.quantity_received) * 100 
                      : 0;

                    return (
                      <TableRow key={batch.id}>
                        <TableCell className="font-medium">{batch.batch_number}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{batch.warehouse_item?.name || 'N/A'}</p>
                            {batch.warehouse_item?.item_code && (
                              <p className="text-xs text-muted-foreground">{batch.warehouse_item.item_code}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {batch.manufacturing_date 
                            ? format(parseISO(batch.manufacturing_date), 'PP') 
                            : '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {batch.expiry_date ? (
                              <>
                                <span className={
                                  expiryStatus === 'expired' ? 'text-red-600 line-through' :
                                  expiryStatus === 'expiring_soon' ? 'text-orange-600' : ''
                                }>
                                  {format(parseISO(batch.expiry_date), 'PP')}
                                </span>
                                {expiryStatus === 'expired' && (
                                  <XCircle className="h-3 w-3 text-red-600" />
                                )}
                                {expiryStatus === 'expiring_soon' && (
                                  <AlertTriangle className="h-3 w-3 text-orange-500" />
                                )}
                              </>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{batch.quantity_received}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <span className={remainingPercent < 10 ? 'text-yellow-600 font-medium' : ''}>
                              {batch.quantity_remaining}
                            </span>
                            {remainingPercent < 10 && batch.quantity_remaining > 0 && (
                              <TrendingDown className="h-3 w-3 text-yellow-600" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          ${batch.unit_cost?.toFixed(2) || '0.00'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={config.color}>
                            {config.icon}
                            <span className="ml-1">{config.label}</span>
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDetails(batch)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <BatchDetailsDialog
        batch={selectedBatch}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
      />
    </div>
  );
}