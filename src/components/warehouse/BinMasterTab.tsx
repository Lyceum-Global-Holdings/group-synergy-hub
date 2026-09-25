import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Edit, Trash2, Layers, MoveRight, Boxes, CheckCircle2, AlertTriangle, Gauge, Info, MapPin, X, MoreHorizontal, Globe } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { useWarehouseBins } from '@/hooks/useWarehouseBins';
import { useWarehouseLocations } from '@/hooks/useWarehouseLocations';
import { CreateBinDialog } from '@/components/warehouse/CreateBinDialog';
import { BulkBinScopeDialog } from '@/components/warehouse/BulkBinScopeDialog';
import { RelocateBinDialog } from '@/components/warehouse/RelocateBinDialog';
import { WarehouseBin } from '@/types/itemBin';
import { useIsAdminOrHigher } from '@/hooks/useIsAdminOrHigher';
import { cn } from '@/lib/utils';
import {
  CodeChip, DataCard, EmptyState, ROW_HOVER, ROW_SELECTED, STICKY_TD, STICKY_TH, SearchField, Segmented,
  StatTile, StatusPill, Toolbar, iconBtn, pillTrigger, thClass,
} from '@/components/warehouse/master/masterUi';

// 'attention' = maintenance or full (set from the summary tile).
type StatusFilter = 'all' | 'attention' | WarehouseBin['status'];

export function BinMasterTab() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [warehouseFilter, setWarehouseFilter] = useState('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingBin, setEditingBin] = useState<WarehouseBin | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkScopeOpen, setIsBulkScopeOpen] = useState(false);
  const [relocatingBin, setRelocatingBin] = useState<WarehouseBin | null>(null);
  const [deletingBin, setDeletingBin] = useState<WarehouseBin | null>(null);

  const { bins, isLoading, deleteBin, isDeleting } = useWarehouseBins();
  const { locations } = useWarehouseLocations();
  const locationById = useMemo(() => new Map(locations.map((l) => [l.id, l.name])), [locations]);
  const warehouseOf = (bin: WarehouseBin) => bin.root_location_id ?? bin.location_id ?? null;
  const locationName = (id: string | null | undefined) => (id && locationById.get(id)) || '—';
  const { canDelete } = useIsAdminOrHigher();
  const isAdminOrHigher = canDelete;

  // Warehouses that actually have bins, for the filter.
  const warehouses = useMemo(() => {
    const ids = new Set(bins.map(warehouseOf).filter(Boolean) as string[]);
    return [...ids].map((id) => ({ id, name: locationName(id) })).sort((a, b) => a.name.localeCompare(b.name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bins, locationById]);

  const statusCounts = useMemo(() => {
    const c: Record<string, number> = {};
    bins.forEach((b) => (c[b.status] = (c[b.status] ?? 0) + 1));
    return c;
  }, [bins]);

  // Overall utilisation across bins that declare a capacity.
  const utilisation = useMemo(() => {
    const withCap = bins.filter((b) => (b.capacity ?? 0) > 0);
    const cap = withCap.reduce((s, b) => s + Number(b.capacity), 0);
    const used = withCap.reduce((s, b) => s + Number(b.current_quantity || 0), 0);
    return cap > 0 ? used / cap : null;
  }, [bins]);

  const needsAttention = (statusCounts.maintenance ?? 0) + (statusCounts.full ?? 0);

  const filteredBins = bins.filter((bin) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch = !q || bin.name.toLowerCase().includes(q) || bin.bin_code.toLowerCase().includes(q);
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'attention' ? bin.status === 'maintenance' || bin.status === 'full' : bin.status === statusFilter);
    const matchesWarehouse = warehouseFilter === 'all' || warehouseOf(bin) === warehouseFilter;
    return matchesSearch && matchesStatus && matchesWarehouse;
  });

  const allFilteredSelected = filteredBins.length > 0 && filteredBins.every((b) => selectedIds.includes(b.id));
  const toggleAll = (checked: boolean) => {
    if (checked) setSelectedIds(Array.from(new Set([...selectedIds, ...filteredBins.map((b) => b.id)])));
    else setSelectedIds(selectedIds.filter((id) => !filteredBins.some((b) => b.id === id)));
  };
  const toggleOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)));
  };
  const selectedBins = bins.filter((b) => selectedIds.includes(b.id));
  const hasFilters = statusFilter !== 'all' || warehouseFilter !== 'all' || !!searchTerm;
  const colSpan = isAdminOrHigher ? 7 : 6;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={Boxes} label="Bins" value={bins.length.toLocaleString('en-US')} loading={isLoading} hint="All bins you can see" />
        <StatTile icon={CheckCircle2} label="Active" value={(statusCounts.active ?? 0).toLocaleString('en-US')} tone="good" loading={isLoading} />
        <StatTile
          icon={AlertTriangle}
          label="Needs attention"
          value={needsAttention.toLocaleString('en-US')}
          tone={needsAttention > 0 ? 'alert' : 'default'}
          loading={isLoading}
          hint="In maintenance or full — click to filter"
          onClick={needsAttention > 0 ? () => setStatusFilter(statusFilter === 'attention' ? 'all' : 'attention') : undefined}
          active={statusFilter === 'attention'}
        />
        <StatTile
          icon={Gauge}
          label="Capacity used"
          value={utilisation === null ? '—' : `${Math.round(utilisation * 100)}%`}
          loading={isLoading}
          hint="Current quantity ÷ capacity, across bins with a capacity set"
        />
      </div>

      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <SearchField value={searchTerm} onChange={setSearchTerm} placeholder="Search bin code or name…" />
          <div className="ml-auto">
            <Button size="sm" className="h-9 rounded-full px-4" onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add bin
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented<StatusFilter>
            label="Bin status"
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: 'all', label: 'All', count: bins.length },
              { value: 'active', label: 'Active', count: statusCounts.active ?? 0 },
              { value: 'inactive', label: 'Inactive', count: statusCounts.inactive ?? 0 },
              { value: 'maintenance', label: 'Maintenance', count: statusCounts.maintenance ?? 0 },
              { value: 'full', label: 'Full', count: statusCounts.full ?? 0 },
            ]}
          />
          {warehouses.length > 1 && (
            <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
              <SelectTrigger className={pillTrigger(warehouseFilter !== 'all')} aria-label="Warehouse">
                <SelectValue placeholder="Warehouse" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All warehouses</SelectItem>
                {warehouses.map((w) => (
                  <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 rounded-full px-3 text-muted-foreground"
              onClick={() => { setSearchTerm(''); setStatusFilter('all'); setWarehouseFilter('all'); }}
            >
              <X className="mr-1 h-4 w-4" /> Clear filters
            </Button>
          )}
          <span className="ml-auto text-xs text-muted-foreground">
            {filteredBins.length.toLocaleString('en-US')} of {bins.length.toLocaleString('en-US')} bins
          </span>
        </div>
      </Toolbar>

      <div className="flex items-start gap-3 rounded-2xl border border-primary/15 bg-primary/[0.04] px-4 py-3 text-sm text-foreground/80">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p>
          Bin codes are unique per warehouse and per company. Every sub-location and department under a warehouse can
          use that warehouse&apos;s bins automatically — no need to duplicate a bin per floor or department.
        </p>
      </div>

      <DataCard>
        <div className="overflow-auto" style={{ maxHeight: 'max(420px, calc(100svh - 420px))' }}>
          <Table className="min-w-full">
            <TableHeader className="sticky top-0 z-10 bg-[hsl(var(--surface-2))] shadow-[inset_0_-1px_0_hsl(var(--border))]">
              <TableRow className="border-0 hover:bg-transparent">
                {isAdminOrHigher && (
                  <TableHead className="w-12 pl-4">
                    <Checkbox checked={allFilteredSelected} onCheckedChange={(v) => toggleAll(!!v)} aria-label="Select all bins" />
                  </TableHead>
                )}
                <TableHead className={cn(thClass, !isAdminOrHigher && 'pl-4')}>Bin</TableHead>
                <TableHead className={thClass}>Warehouse</TableHead>
                <TableHead className={cn(thClass, 'min-w-[220px]')}>Capacity</TableHead>
                <TableHead className={cn(thClass, 'text-right')}>Current qty</TableHead>
                <TableHead className={thClass}>Status</TableHead>
                <TableHead className={cn(thClass, STICKY_TH, 'w-28 pr-4 text-right')}>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={`sk-${i}`} className="h-14 border-border/50 hover:bg-transparent">
                    <TableCell colSpan={colSpan} className="pl-4">
                      <div className="flex items-center gap-4">
                        <div className="h-5 w-20 animate-pulse rounded bg-muted" />
                        <div className="h-3.5 w-48 animate-pulse rounded bg-muted" />
                        <div className="h-2 w-40 animate-pulse rounded-full bg-muted" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : filteredBins.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={colSpan} className="p-0">
                    <EmptyState
                      icon={MapPin}
                      title={hasFilters ? 'No bins match' : 'No bins yet'}
                      description={hasFilters ? 'Try a different search or status.' : 'Create your first storage bin to start allocating stock.'}
                      action={
                        hasFilters ? (
                          <Button variant="outline" size="sm" className="rounded-full" onClick={() => { setSearchTerm(''); setStatusFilter('all'); setWarehouseFilter('all'); }}>
                            Clear filters
                          </Button>
                        ) : (
                          <Button size="sm" className="rounded-full" onClick={() => setIsCreateDialogOpen(true)}>
                            <Plus className="mr-1.5 h-4 w-4" /> Add bin
                          </Button>
                        )
                      }
                    />
                  </TableCell>
                </TableRow>
              ) : (
                filteredBins.map((bin) => {
                  const cap = Number(bin.capacity || 0);
                  const qty = Number(bin.current_quantity || 0);
                  const ratio = cap > 0 ? qty / cap : null;
                  return (
                    <TableRow
                      key={bin.id}
                      data-state={selectedIds.includes(bin.id) ? 'selected' : undefined}
                      className={cn('group h-14 border-border/50', ROW_HOVER, ROW_SELECTED)}
                    >
                      {isAdminOrHigher && (
                        <TableCell className="pl-4">
                          <Checkbox
                            checked={selectedIds.includes(bin.id)}
                            onCheckedChange={(v) => toggleOne(bin.id, !!v)}
                            aria-label={`Select ${bin.bin_code}`}
                          />
                        </TableCell>
                      )}
                      <TableCell className={cn(!isAdminOrHigher && 'pl-4')}>
                        <div className="flex min-w-[200px] items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                            <MapPin className="h-4 w-4" />
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <CodeChip className="font-semibold">{bin.bin_code}</CodeChip>
                              {bin.is_global_template && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700" title="Global template bin">
                                  <Globe className="h-3 w-3" /> Global
                                </span>
                              )}
                            </div>
                            <div className="mt-0.5 truncate text-sm text-foreground/80">{bin.name}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5" />
                          {locationName(warehouseOf(bin))}
                        </span>
                      </TableCell>
                      <TableCell>
                        {ratio === null ? (
                          <span className="whitespace-nowrap text-xs text-muted-foreground">No capacity set</span>
                        ) : (
                          <div className="flex items-center gap-2.5">
                            <div className="h-2 w-32 overflow-hidden rounded-full bg-muted" role="meter" aria-valuemin={0} aria-valuemax={cap} aria-valuenow={qty} aria-label={`${bin.bin_code} capacity used`}>
                              <div
                                className={cn('h-full rounded-full', ratio >= 1 ? 'bg-red-500' : ratio >= 0.85 ? 'bg-amber-500' : 'bg-primary')}
                                style={{ width: `${Math.min(ratio, 1) * 100}%` }}
                              />
                            </div>
                            <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
                              {Math.round(ratio * 100)}% of {cap.toLocaleString('en-US')}
                            </span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{qty.toLocaleString('en-US')}</TableCell>
                      <TableCell><StatusPill status={bin.status} /></TableCell>
                      <TableCell className={cn('pr-3', STICKY_TD)}>
                        <div className="flex items-center justify-end gap-0.5">
                          <button type="button" className={iconBtn} onClick={() => setEditingBin(bin)} title="Edit bin" aria-label={`Edit ${bin.bin_code}`}>
                            <Edit className="h-4 w-4" />
                          </button>
                          <button type="button" className={iconBtn} onClick={() => setRelocatingBin(bin)} title="Relocate bin" aria-label={`Relocate ${bin.bin_code}`}>
                            <MoveRight className="h-4 w-4" />
                          </button>
                          {canDelete && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button type="button" className={iconBtn} aria-label={`More actions for ${bin.bin_code}`}>
                                  <MoreHorizontal className="h-4 w-4" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44 rounded-xl">
                                <DropdownMenuItem onClick={() => setSelectedIds((prev) => (prev.includes(bin.id) ? prev : [...prev, bin.id]))}>
                                  <Layers className="mr-2 h-4 w-4" /> Select for scope change
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => setDeletingBin(bin)}
                                  disabled={isDeleting}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" /> Delete bin
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </DataCard>

      {/* Floating bulk bar */}
      {isAdminOrHigher && selectedBins.length > 0 && (
        <div
          role="toolbar"
          aria-label="Bulk actions for selected bins"
          className="fixed bottom-6 left-1/2 z-50 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-1.5 rounded-2xl bg-slate-900 px-2.5 py-2 text-white shadow-2xl shadow-slate-900/30"
        >
          <span className="mr-1 inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-1.5 text-sm font-medium">
            <span className="flex h-5 min-w-5 items-center justify-center rounded-md bg-white px-1 text-xs font-bold tabular-nums text-slate-900">
              {selectedBins.length}
            </span>
            selected
          </span>
          <Button size="sm" className="h-8 rounded-xl bg-white text-slate-900 hover:bg-white/90" onClick={() => setIsBulkScopeOpen(true)}>
            <Layers className="mr-1.5 h-4 w-4" /> Change scope
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8 rounded-xl text-white/70 hover:bg-white/10 hover:text-white" onClick={() => setSelectedIds([])} aria-label="Clear selection">
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <AlertDialog open={deletingBin !== null} onOpenChange={(o) => { if (!o) setDeletingBin(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete bin {deletingBin?.bin_code}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>“{deletingBin?.name}” will be permanently removed. This can&apos;t be undone.</p>
                {Number(deletingBin?.current_quantity || 0) > 0 && (
                  // warehouse_bin_allocations cascade on bin delete — say so plainly.
                  <p className="rounded-lg bg-destructive/10 px-3 py-2 font-medium text-destructive">
                    This bin holds {Number(deletingBin?.current_quantity).toLocaleString('en-US')} units. Deleting it also
                    deletes those stock allocations. Move the stock out first (Relocate or Stock Transfer) unless that
                    is what you intend.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (deletingBin) deleteBin(deletingBin.id); setDeletingBin(null); }}
            >
              {Number(deletingBin?.current_quantity || 0) > 0 ? 'Delete bin and its allocations' : 'Delete bin'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CreateBinDialog
        open={isCreateDialogOpen || editingBin !== null}
        onOpenChange={(open) => {
          setIsCreateDialogOpen(open);
          if (!open) setEditingBin(null);
        }}
        editingBin={editingBin}
      />

      <BulkBinScopeDialog
        open={isBulkScopeOpen}
        onOpenChange={setIsBulkScopeOpen}
        bins={selectedBins}
      />

      <RelocateBinDialog
        open={relocatingBin !== null}
        onOpenChange={(o) => { if (!o) setRelocatingBin(null); }}
        bin={relocatingBin}
      />
    </div>
  );
}
