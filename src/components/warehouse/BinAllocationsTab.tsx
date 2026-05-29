import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable } from '@/components/ui/data-table';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { Plus, AlertCircle, Trash2, Search, Undo2, QrCode, FileDown, Loader2, MapPin, ArrowRightLeft, X, Boxes } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useWarehouseBinAllocations } from '@/hooks/useWarehouseBinAllocations';
import { useWarehouseLocations } from '@/hooks/useWarehouseLocations';
import { useLocationFilter } from '@/contexts/LocationFilterContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useIsAdminOrHigher } from '@/hooks/useIsAdminOrHigher';
import { CreateBinAllocationDialog } from './CreateBinAllocationDialog';
import { ReturnStockFromSublocationDialog } from './ReturnStockFromSublocationDialog';
import { MoveBinAllocationDialog } from './MoveBinAllocationDialog';
import { BinAllocationQRDialog } from './BinAllocationQRDialog';
import { BinFilterPopover, type BinFilterOption } from './bin-allocations/BinFilterPopover';
import { generateBulkBinQRCodePdf, downloadBulkBinQRCodePdf } from '@/utils/bulkBinQRCodePdf';
import { toast } from 'sonner';
import { useEffect } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import type { BinAllocationWithDetails } from '@/types/warehouseReservation';

export function BinAllocationsTab() {
  const { isViewingAllCompanies } = useCompany();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [allocationToDelete, setAllocationToDelete] = useState<string | null>(null);
  const [qrAllocation, setQrAllocation] = useState<BinAllocationWithDetails | null>(null);
  const [moveAllocation, setMoveAllocation] = useState<BinAllocationWithDetails | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBinIds, setSelectedBinIds] = useState<Set<string>>(new Set());
  const [bulkPrinting, setBulkPrinting] = useState(false);
  const { binAllocations, isLoading, deleteAllocation, isDeleting } = useWarehouseBinAllocations();
  const { globalLocationId } = useLocationFilter();
  const { locations } = useWarehouseLocations();

  // Build descendant set for the selected location (root + every sub-location).
  // Selecting a parent warehouse includes its full subtree, matching standard
  // WMS hierarchy filter semantics.
  const scope = useMemo(() => {
    if (!globalLocationId) return null;
    const childrenByParent = new Map<string, string[]>();
    for (const l of locations || []) {
      if (l.parent_id) {
        const arr = childrenByParent.get(l.parent_id) ?? [];
        arr.push(l.id);
        childrenByParent.set(l.parent_id, arr);
      }
    }
    const ids = new Set<string>([globalLocationId]);
    const stack = [globalLocationId];
    while (stack.length) {
      const id = stack.pop()!;
      for (const child of childrenByParent.get(id) ?? []) {
        if (!ids.has(child)) {
          ids.add(child);
          stack.push(child);
        }
      }
    }
    const root = (locations || []).find((l) => l.id === globalLocationId);
    return {
      ids,
      label: root
        ? root.location_code
          ? `${root.name} (${root.location_code})`
          : root.name
        : 'Selected location',
    };
  }, [globalLocationId, locations]);

  // Normalize parent (PostgREST self-FK can return array or object) into a flat
  // hierarchical "Parent › Child" path. Follows WMS standard of showing the
  // full storage hierarchy (Site/Warehouse › Zone/Sub-location › Bin).
  const getLocationPath = (allocation: BinAllocationWithDetails) => {
    const loc = allocation.warehouse_bin?.warehouse_location;
    if (!loc) return { parent: null, child: null, path: '' };
    const parentRaw = loc.parent;
    const parent = Array.isArray(parentRaw) ? parentRaw[0] ?? null : parentRaw ?? null;
    const fmt = (n?: string | null, c?: string | null) =>
      c ? `${n} (${c})` : n ?? '';
    const child = fmt(loc.name, loc.location_code);
    if (parent) {
      return {
        parent: fmt(parent.name, parent.location_code),
        child,
        path: `${fmt(parent.name, parent.location_code)} › ${child}`,
      };
    }
    return { parent: null, child, path: child };
  };

  // Bin options: distinct bins from already-loaded allocations, restricted to
  // the active location scope so the bin picker matches the table's universe.
  const binOptions = useMemo<BinFilterOption[]>(() => {
    const byId = new Map<string, BinFilterOption>();
    for (const a of binAllocations || []) {
      const bin = a.warehouse_bin as any;
      if (!bin?.id || !bin.bin_code) continue;
      if (scope) {
        const locId = bin.warehouse_location?.id;
        if (!locId || !scope.ids.has(locId)) continue;
      }
      if (byId.has(bin.id)) continue;
      byId.set(bin.id, {
        id: bin.id,
        bin_code: bin.bin_code,
        name: bin.name,
        location_path: getLocationPath(a).path || null,
      });
    }
    return Array.from(byId.values());
  }, [binAllocations, scope]);

  // Prune stale selections when the scope changes (selected bin no longer visible).
  useEffect(() => {
    if (selectedBinIds.size === 0) return;
    const visible = new Set(binOptions.map((o) => o.id));
    let changed = false;
    const next = new Set<string>();
    selectedBinIds.forEach((id) => {
      if (visible.has(id)) next.add(id);
      else changed = true;
    });
    if (changed) setSelectedBinIds(next);
  }, [binOptions, selectedBinIds]);

  const selectedBinChips = useMemo(
    () => binOptions.filter((o) => selectedBinIds.has(o.id)),
    [binOptions, selectedBinIds],
  );

  const filteredAllocations = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const base = (binAllocations || []).filter((allocation) => {
      // Warehouse / sub-location scope
      if (scope) {
        const locId = allocation.warehouse_bin?.warehouse_location?.id;
        if (!locId || !scope.ids.has(locId)) return false;
      }
      // Bin filter
      if (selectedBinIds.size > 0) {
        const binId = allocation.warehouse_bin?.id;
        if (!binId || !selectedBinIds.has(binId)) return false;
      }
      // Free-text search
      const wi = allocation.warehouse_item as any;
      const itemCode = (wi?.catalog?.item_code ?? wi?.item_code ?? '') as string;
      const itemName = (wi?.catalog?.name ?? wi?.name ?? '') as string;
      if (!term) return true;
      return (
        itemCode.toLowerCase().includes(term) ||
        itemName.toLowerCase().includes(term) ||
        allocation.warehouse_bin?.bin_code?.toLowerCase().includes(term) ||
        allocation.warehouse_bin?.name?.toLowerCase().includes(term) ||
        getLocationPath(allocation).path.toLowerCase().includes(term)
      );
    });
    return [...base].sort((a, b) => {
      const pa = getLocationPath(a).path;
      const pb = getLocationPath(b).path;
      if (pa !== pb) return pa.localeCompare(pb);
      const ba = a.warehouse_bin?.bin_code ?? '';
      const bb = b.warehouse_bin?.bin_code ?? '';
      if (ba !== bb) return ba.localeCompare(bb, undefined, { numeric: true });
      const ai = ((a.warehouse_item as any)?.catalog?.item_code ?? (a.warehouse_item as any)?.item_code ?? '') as string;
      const bi = ((b.warehouse_item as any)?.catalog?.item_code ?? (b.warehouse_item as any)?.item_code ?? '') as string;
      return ai.localeCompare(bi);
    });
  }, [binAllocations, searchTerm, scope, selectedBinIds]);
  const { canDelete } = useIsAdminOrHigher();

  const handleDelete = () => {
    if (allocationToDelete) {
      deleteAllocation(allocationToDelete);
      setAllocationToDelete(null);
    }
  };

  const columns: ColumnDef<BinAllocationWithDetails>[] = [
    {
      id: 'type',
      header: 'Type',
      cell: ({ row }) => {
        const itemType = (row.original.warehouse_item as any)?.catalog?.item_type;
        const isTool = itemType === 'tool';
        return (
          <Badge variant={isTool ? 'outline' : 'secondary'} className="font-normal">
            {isTool ? 'Tool' : 'Item'}
          </Badge>
        );
      },
    },
    {
      id: 'item_code',
      header: 'Item Code',
      accessorFn: (row) =>
        (row.warehouse_item as any)?.catalog?.item_code ??
        (row.warehouse_item as any)?.item_code ??
        '',
      cell: ({ getValue }) => <span className="font-mono text-sm">{(getValue() as string) || '—'}</span>,
    },
    {
      id: 'item_name',
      header: 'Item Name',
      accessorFn: (row) =>
        (row.warehouse_item as any)?.catalog?.name ??
        (row.warehouse_item as any)?.name ??
        '',
      cell: ({ getValue }) => <span>{(getValue() as string) || '—'}</span>,
    },
    {
      id: 'location',
      header: 'Location › Sub-location',
      cell: ({ row }) => {
        const { parent, child } = getLocationPath(row.original);
        if (!child) {
          return <span className="text-muted-foreground italic">Unassigned</span>;
        }
        return (
          <div className="flex flex-col leading-tight">
            {parent && (
              <span className="text-xs text-muted-foreground">{parent}</span>
            )}
            <span className="font-medium">{child}</span>
          </div>
        );
      },
    },
    {
      accessorKey: 'warehouse_bin.bin_code',
      header: 'Bin Code',
    },
    {
      accessorKey: 'warehouse_bin.name',
      header: 'Bin Name',
    },
    {
      accessorKey: 'allocated_quantity',
      header: 'Allocated',
      cell: ({ row }) => row.original.allocated_quantity.toFixed(2),
    },
    {
      accessorKey: 'reserved_quantity',
      header: 'Reserved',
      cell: ({ row }) => (
        <span className="text-warning">
          {row.original.reserved_quantity.toFixed(2)}
        </span>
      ),
    },
    {
      accessorKey: 'available_quantity',
      header: 'Available',
      cell: ({ row }) => (
        <span className="text-success font-medium">
          {row.original.available_quantity.toFixed(2)}
        </span>
      ),
    },
    {
      accessorKey: 'notes',
      header: 'Notes',
      cell: ({ row }) => row.original.notes || '-',
    },
    {
      id: 'qr',
      header: 'QR',
      cell: ({ row }: { row: { original: BinAllocationWithDetails } }) => (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setQrAllocation(row.original)}
          title="Generate QR code"
        >
          <QrCode className="h-4 w-4" />
        </Button>
      ),
    },
    ...(canDelete ? [{
      id: 'actions',
      header: 'Actions',
      cell: ({ row }: { row: { original: BinAllocationWithDetails } }) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMoveAllocation(row.original)}
            title="Move stock to another bin/warehouse"
            disabled={(row.original.available_quantity || 0) <= 0}
          >
            <ArrowRightLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setAllocationToDelete(row.original.id)}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            title="Delete allocation"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    }] as ColumnDef<BinAllocationWithDetails>[] : []),
  ];

  const handleBulkPrint = async () => {
    if (!filteredAllocations.length) {
      toast.error('No allocations to print');
      return;
    }
    setBulkPrinting(true);
    try {
      const blob = await generateBulkBinQRCodePdf(
        filteredAllocations.map((a) => ({
          id: a.id,
          item_code:
            (a.warehouse_item as any)?.catalog?.item_code ??
            (a.warehouse_item as any)?.item_code ??
            null,
          item_name:
            (a.warehouse_item as any)?.catalog?.name ??
            (a.warehouse_item as any)?.name ??
            null,
          bin_code: a.warehouse_bin?.bin_code,
          location_name: a.warehouse_bin?.warehouse_location?.name,
          location_code: a.warehouse_bin?.warehouse_location?.location_code,
          allocated_quantity: a.allocated_quantity,
        }))
      );
      downloadBulkBinQRCodePdf(blob);
      toast.success(`Generated ${filteredAllocations.length} QR labels`);
    } catch (e) {
      console.error(e);
      toast.error('Failed to generate QR labels');
    } finally {
      setBulkPrinting(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <CardTitle>Bin Allocations</CardTitle>
            {scope && (
              <Badge variant="secondary" className="gap-1 font-normal">
                <MapPin className="h-3 w-3" />
                {scope.label}
              </Badge>
            )}
          </div>
          <CardDescription>
            {scope
              ? 'Showing allocations for the selected warehouse and its sub-locations (set via the header location filter).'
              : 'Manage item-to-bin allocations and track reserved quantities'}
          </CardDescription>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search items, bins..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
          <Button
            variant="outline"
            onClick={handleBulkPrint}
            disabled={bulkPrinting || !filteredAllocations.length}
            title="Generate QR labels (PDF) for the filtered allocations"
          >
            {bulkPrinting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="mr-2 h-4 w-4" />
            )}
            Bulk QR ({filteredAllocations.length})
          </Button>
          <Button 
            variant="outline"
            onClick={() => setReturnDialogOpen(true)}
            disabled={isViewingAllCompanies}
            title={isViewingAllCompanies ? "Select a specific company" : "Return stock from sub-location"}
          >
            <Undo2 className="mr-2 h-4 w-4" />
            Return Stock
          </Button>
          <Button 
            onClick={() => setDialogOpen(true)}
            disabled={isViewingAllCompanies}
            title={isViewingAllCompanies ? "Select a specific company to allocate items" : ""}
          >
            <Plus className="mr-2 h-4 w-4" />
            Allocate Item to Bin
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isViewingAllCompanies && (
          <Alert className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Viewing allocations from all companies. Select a specific company to create or manage allocations.
            </AlertDescription>
          </Alert>
        )}
        <DataTable
          columns={columns}
          data={filteredAllocations}
          isLoading={isLoading}
        />
      </CardContent>

      <CreateBinAllocationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />

      <ReturnStockFromSublocationDialog
        open={returnDialogOpen}
        onOpenChange={setReturnDialogOpen}
      />

      <BinAllocationQRDialog
        allocation={qrAllocation}
        open={!!qrAllocation}
        onOpenChange={(o) => !o && setQrAllocation(null)}
      />

      <MoveBinAllocationDialog
        allocation={moveAllocation}
        open={!!moveAllocation}
        onOpenChange={(o) => !o && setMoveAllocation(null)}
      />

      <AlertDialog open={!!allocationToDelete} onOpenChange={() => setAllocationToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Bin Allocation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this bin allocation? This action cannot be undone and may affect stock tracking.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
