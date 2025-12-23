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
import { Plus, AlertCircle, Trash2, Search } from 'lucide-react';
import { useWarehouseBinAllocations } from '@/hooks/useWarehouseBinAllocations';
import { useCompany } from '@/contexts/CompanyContext';
import { useIsAdminOrHigher } from '@/hooks/useIsAdminOrHigher';
import { CreateBinAllocationDialog } from './CreateBinAllocationDialog';
import type { ColumnDef } from '@tanstack/react-table';
import type { BinAllocationWithDetails } from '@/types/warehouseReservation';

export function BinAllocationsTab() {
  const { isViewingAllCompanies } = useCompany();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [allocationToDelete, setAllocationToDelete] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { binAllocations, isLoading, deleteAllocation, isDeleting } = useWarehouseBinAllocations();

  const filteredAllocations = useMemo(() => {
    if (!searchTerm.trim()) return binAllocations || [];
    
    const term = searchTerm.toLowerCase();
    return (binAllocations || []).filter((allocation) => 
      allocation.warehouse_item?.item_code?.toLowerCase().includes(term) ||
      allocation.warehouse_item?.name?.toLowerCase().includes(term) ||
      allocation.warehouse_bin?.bin_code?.toLowerCase().includes(term) ||
      allocation.warehouse_bin?.name?.toLowerCase().includes(term)
    );
  }, [binAllocations, searchTerm]);
  const { canDelete } = useIsAdminOrHigher();

  const handleDelete = () => {
    if (allocationToDelete) {
      deleteAllocation(allocationToDelete);
      setAllocationToDelete(null);
    }
  };

  const columns: ColumnDef<BinAllocationWithDetails>[] = [
    {
      accessorKey: 'warehouse_item.item_code',
      header: 'Item Code',
    },
    {
      accessorKey: 'warehouse_item.name',
      header: 'Item Name',
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
    ...(canDelete ? [{
      id: 'actions',
      header: 'Actions',
      cell: ({ row }: { row: { original: BinAllocationWithDetails } }) => (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setAllocationToDelete(row.original.id)}
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
          title="Delete allocation"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      ),
    }] as ColumnDef<BinAllocationWithDetails>[] : []),
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle>Bin Allocations</CardTitle>
          <CardDescription>
            Manage item-to-bin allocations and track reserved quantities
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
