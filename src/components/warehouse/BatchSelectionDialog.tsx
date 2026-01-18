import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, Package, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAvailableBatches, allocateFIFO } from '@/hooks/useBatches';
import { BatchAllocation, ItemBatch } from '@/types/batch';
import { format, differenceInDays, parseISO } from 'date-fns';

interface BatchSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warehouseItemId: string;
  itemName: string;
  quantityNeeded: number;
  onConfirm: (allocations: BatchAllocation[]) => void;
}

export function BatchSelectionDialog({
  open,
  onOpenChange,
  warehouseItemId,
  itemName,
  quantityNeeded,
  onConfirm,
}: BatchSelectionDialogProps) {
  const { data: batches = [], isLoading } = useAvailableBatches(warehouseItemId, open);
  const [allocations, setAllocations] = useState<Map<string, number>>(new Map());
  const [mode, setMode] = useState<'auto' | 'manual'>('auto');

  // Auto-allocate using FIFO when batches load or quantity changes
  useEffect(() => {
    if (mode === 'auto' && batches.length > 0) {
      const { allocations: fifoAllocations } = allocateFIFO(batches, quantityNeeded);
      const allocationMap = new Map<string, number>();
      fifoAllocations.forEach((a) => allocationMap.set(a.batch_id, a.quantity));
      setAllocations(allocationMap);
    }
  }, [batches, quantityNeeded, mode]);

  const handleQuantityChange = (batchId: string, value: number, maxAvailable: number) => {
    const newAllocations = new Map(allocations);
    if (value <= 0) {
      newAllocations.delete(batchId);
    } else {
      newAllocations.set(batchId, Math.min(value, maxAvailable));
    }
    setAllocations(newAllocations);
    setMode('manual');
  };

  const totalAllocated = Array.from(allocations.values()).reduce((sum, qty) => sum + qty, 0);
  const isComplete = totalAllocated >= quantityNeeded;
  const isOverAllocated = totalAllocated > quantityNeeded;

  const handleConfirm = () => {
    const batchAllocations: BatchAllocation[] = [];
    allocations.forEach((quantity, batchId) => {
      const batch = batches.find((b) => b.id === batchId);
      if (batch && quantity > 0) {
        batchAllocations.push({
          batch_id: batchId,
          batch_number: batch.batch_number,
          quantity,
          expiry_date: batch.expiry_date,
          manufacturing_date: batch.manufacturing_date,
        });
      }
    });
    onConfirm(batchAllocations);
    onOpenChange(false);
  };

  const getExpiryBadge = (batch: ItemBatch) => {
    if (!batch.expiry_date) return null;
    const daysUntilExpiry = differenceInDays(parseISO(batch.expiry_date), new Date());

    if (daysUntilExpiry < 0) {
      return <Badge variant="destructive">Expired</Badge>;
    }
    if (daysUntilExpiry <= 30) {
      return <Badge variant="secondary" className="bg-amber-100 text-amber-800">Expires in {daysUntilExpiry}d</Badge>;
    }
    if (daysUntilExpiry <= 90) {
      return <Badge variant="secondary">Expires in {daysUntilExpiry}d</Badge>;
    }
    return null;
  };

  const handleAutoAllocate = () => {
    setMode('auto');
    const { allocations: fifoAllocations } = allocateFIFO(batches, quantityNeeded);
    const allocationMap = new Map<string, number>();
    fifoAllocations.forEach((a) => allocationMap.set(a.batch_id, a.quantity));
    setAllocations(allocationMap);
  };

  const totalAvailable = batches.reduce((sum, b) => sum + b.quantity_remaining, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Select Batches for Issue
          </DialogTitle>
          <DialogDescription>
            Select batches to fulfill the quantity of <strong>{quantityNeeded}</strong> for <strong>{itemName}</strong>
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : batches.length === 0 ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No active batches available for this item. Please receive stock via GRN first.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            {/* Summary */}
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">
                  Total Available: <span className="font-medium text-foreground">{totalAvailable}</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  Needed: <span className="font-medium text-foreground">{quantityNeeded}</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={isComplete ? 'default' : 'secondary'} className={isComplete ? 'bg-green-600' : ''}>
                  {totalAllocated} / {quantityNeeded} allocated
                </Badge>
                <Button variant="outline" size="sm" onClick={handleAutoAllocate}>
                  Auto FIFO
                </Button>
              </div>
            </div>

            {totalAvailable < quantityNeeded && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Insufficient batch stock. Available: {totalAvailable}, Needed: {quantityNeeded}
                </AlertDescription>
              </Alert>
            )}

            {isOverAllocated && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Over-allocated by {totalAllocated - quantityNeeded} units
                </AlertDescription>
              </Alert>
            )}

            {/* Batch Table */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Batch Number</TableHead>
                  <TableHead>Mfg Date</TableHead>
                  <TableHead>Expiry Date</TableHead>
                  <TableHead className="text-right">Available</TableHead>
                  <TableHead className="text-right">Allocate</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((batch) => {
                  const allocated = allocations.get(batch.id) || 0;
                  return (
                    <TableRow key={batch.id} className={allocated > 0 ? 'bg-green-50 dark:bg-green-950/20' : ''}>
                      <TableCell className="font-medium">{batch.batch_number}</TableCell>
                      <TableCell>
                        {batch.manufacturing_date
                          ? format(parseISO(batch.manufacturing_date), 'dd MMM yyyy')
                          : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {batch.expiry_date
                            ? format(parseISO(batch.expiry_date), 'dd MMM yyyy')
                            : '-'}
                          {getExpiryBadge(batch)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {batch.quantity_remaining}
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min={0}
                          max={batch.quantity_remaining}
                          value={allocated || ''}
                          onChange={(e) =>
                            handleQuantityChange(batch.id, parseFloat(e.target.value) || 0, batch.quantity_remaining)
                          }
                          className="w-24 text-right"
                          placeholder="0"
                        />
                      </TableCell>
                      <TableCell>
                        {allocated > 0 && (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {/* Allocation Summary */}
            {allocations.size > 0 && (
              <div className="p-3 bg-muted/30 rounded-lg">
                <Label className="text-sm font-medium">Allocation Summary ({mode === 'auto' ? 'FIFO' : 'Manual'})</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {Array.from(allocations.entries()).map(([batchId, qty]) => {
                    const batch = batches.find((b) => b.id === batchId);
                    if (!batch || qty <= 0) return null;
                    return (
                      <Badge key={batchId} variant="outline" className="text-sm">
                        {batch.batch_number}: {qty}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={totalAllocated <= 0 || batches.length === 0}
          >
            Confirm Allocation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
