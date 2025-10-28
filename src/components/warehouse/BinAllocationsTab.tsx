import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { Plus } from 'lucide-react';
import { useWarehouseBinAllocations } from '@/hooks/useWarehouseBinAllocations';
import { CreateBinAllocationDialog } from './CreateBinAllocationDialog';
import type { ColumnDef } from '@tanstack/react-table';
import type { BinAllocationWithDetails } from '@/types/warehouseReservation';

export function BinAllocationsTab() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { binAllocations, isLoading } = useWarehouseBinAllocations();

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
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Bin Allocations</CardTitle>
          <CardDescription>
            Manage item-to-bin allocations and track reserved quantities
          </CardDescription>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Allocate Item to Bin
        </Button>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={columns}
          data={binAllocations || []}
          isLoading={isLoading}
        />
      </CardContent>

      <CreateBinAllocationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </Card>
  );
}
