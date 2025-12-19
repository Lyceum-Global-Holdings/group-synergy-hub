import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, ArrowUpCircle, AlertCircle } from 'lucide-react';
import { FloorRoomMaterial } from '@/types/construction';
import { useIssueMaterial } from '@/hooks/construction/useRoomMaterialTransactions';
import { useCompany } from '@/contexts/CompanyContext';

interface IssueMaterialDialogProps {
  material: FloorRoomMaterial | null;
  roomId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function IssueMaterialDialog({
  material,
  roomId,
  open,
  onOpenChange,
}: IssueMaterialDialogProps) {
  const { selectedCompany } = useCompany();
  const [quantity, setQuantity] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  
  const issueMaterial = useIssueMaterial();
  
  const warehouseStock = material?.warehouse_item?.current_stock ?? 0;
  const currentAllocated = material?.quantity_allocated ?? 0;
  const quantityRequired = material?.quantity_required ?? 0;
  const remainingToAllocate = Math.max(0, quantityRequired - currentAllocated);
  const quantityNum = parseFloat(quantity) || 0;
  
  const isInsufficientStock = quantityNum > warehouseStock;
  const isExceedsRequired = quantityNum > remainingToAllocate && remainingToAllocate > 0;

  const handleSubmit = () => {
    if (!material || !material.warehouse_item?.id || quantityNum <= 0) return;

    issueMaterial.mutate(
      {
        room_material_id: material.id,
        room_id: roomId,
        warehouse_item_id: material.warehouse_item.id,
        quantity: quantityNum,
        unit_cost: material.warehouse_item.unit_cost || undefined,
        company_id: selectedCompany?.id || undefined,
        notes: notes || undefined,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          setQuantity('');
          setNotes('');
        },
      }
    );
  };

  const handleClose = () => {
    onOpenChange(false);
    setQuantity('');
    setNotes('');
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowUpCircle className="h-5 w-5 text-green-600" />
            Issue Material to Room
          </DialogTitle>
        </DialogHeader>

        {material && (
          <div className="space-y-4">
            {/* Material Info */}
            <div className="p-3 bg-muted/30 rounded-lg space-y-2">
              <div className="font-medium">
                {material.warehouse_item?.item_code} - {material.warehouse_item?.name}
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Warehouse Stock:</span>{' '}
                  <span className="font-medium text-green-600">{warehouseStock}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Already Issued:</span>{' '}
                  <span className="font-medium">{currentAllocated}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Required:</span>{' '}
                  <span className="font-medium">{quantityRequired}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Remaining:</span>{' '}
                  <span className="font-medium text-primary">{remainingToAllocate}</span>
                </div>
              </div>
            </div>

            {/* Quantity Input */}
            <div className="space-y-2">
              <Label htmlFor="issue-quantity">Quantity to Issue</Label>
              <Input
                id="issue-quantity"
                type="number"
                min="0"
                step="0.001"
                max={warehouseStock}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder={`Max: ${warehouseStock}`}
              />
              {remainingToAllocate > 0 && (
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs"
                  onClick={() => setQuantity(String(Math.min(remainingToAllocate, warehouseStock)))}
                >
                  Fill remaining ({Math.min(remainingToAllocate, warehouseStock)})
                </Button>
              )}
            </div>

            {/* Validation Alerts */}
            {isInsufficientStock && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Insufficient warehouse stock. Available: {warehouseStock}
                </AlertDescription>
              </Alert>
            )}
            
            {isExceedsRequired && !isInsufficientStock && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  This exceeds the remaining requirement ({remainingToAllocate}). You can still proceed.
                </AlertDescription>
              </Alert>
            )}

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="issue-notes">Notes (Optional)</Label>
              <Textarea
                id="issue-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes about this issue..."
                rows={2}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={quantityNum <= 0 || isInsufficientStock || issueMaterial.isPending}
          >
            {issueMaterial.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Issue Material
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
