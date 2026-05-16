import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useWarehouseBins } from '@/hooks/useWarehouseBins';
import { Package } from 'lucide-react';
import { useLocationFilter } from '@/contexts/LocationFilterContext';
import { useWarehouseLocations } from '@/hooks/useWarehouseLocations';
import { getRootLocationId } from '@/lib/warehouse/locationHierarchy';

interface GrnItem {
  id: string;
  item_name: string;
  item_code?: string;
  quantity_received: number;
  warehouse_item_id?: string;
  unit_of_measure?: string;
}

export interface BinAllocation {
  grn_item_id: string;
  warehouse_item_id: string;
  bin_id: string;
  location_id: string | null;
  quantity: number;
}

interface GrnBinAllocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: GrnItem[];
  onConfirm: (allocations: BinAllocation[]) => void;
  isLoading?: boolean;
}

export function GrnBinAllocationDialog({
  open,
  onOpenChange,
  items,
  onConfirm,
  isLoading,
}: GrnBinAllocationDialogProps) {
  const { bins } = useWarehouseBins();
  const { globalLocationId } = useLocationFilter();
  const { locations } = useWarehouseLocations();
  const selectedRootLocationId = getRootLocationId(locations, globalLocationId);
  const activeBins = bins.filter((b) => {
    if (b.status !== 'active') return false;
    if (!selectedRootLocationId) return true;
    return (b.root_location_id ?? b.location_id) === selectedRootLocationId;
  });

  const [binSelections, setBinSelections] = useState<Record<string, string>>({});

  // Reset selections when dialog opens
  useEffect(() => {
    if (open) {
      setBinSelections({});
    }
  }, [open]);

  const allocatableItems = items.filter((item) => item.warehouse_item_id && item.quantity_received > 0);
  const allSelected = allocatableItems.length > 0 && allocatableItems.every((item) => binSelections[item.id]);

  const handleConfirm = () => {
    const allocations: BinAllocation[] = allocatableItems
      .filter((item) => binSelections[item.id])
      .map((item) => ({
        grn_item_id: item.id,
        warehouse_item_id: item.warehouse_item_id!,
        bin_id: binSelections[item.id],
        location_id: globalLocationId ?? activeBins.find((bin) => bin.id === binSelections[item.id])?.location_id ?? null,
        quantity: item.quantity_received,
      }));

    onConfirm(allocations);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Allocate Stock to Bins
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Select a destination bin for each item before approving the GRN.
        </p>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Code</TableHead>
              <TableHead className="text-right">Qty Received</TableHead>
              <TableHead>UOM</TableHead>
              <TableHead>Destination Bin</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allocatableItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No items with linked warehouse items to allocate
                </TableCell>
              </TableRow>
            ) : (
              allocatableItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.item_name}</TableCell>
                  <TableCell>{item.item_code || '-'}</TableCell>
                  <TableCell className="text-right">{item.quantity_received}</TableCell>
                  <TableCell>{item.unit_of_measure || '-'}</TableCell>
                  <TableCell>
                    <Select
                      value={binSelections[item.id] || ''}
                      onValueChange={(value) =>
                        setBinSelections((prev) => ({ ...prev, [item.id]: value }))
                      }
                    >
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Select bin..." />
                      </SelectTrigger>
                      <SelectContent>
                        {activeBins.map((bin) => (
                          <SelectItem key={bin.id} value={bin.id}>
                            {bin.bin_code} — {bin.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!allSelected || isLoading}>
            {isLoading ? 'Approving...' : 'Confirm & Approve'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
