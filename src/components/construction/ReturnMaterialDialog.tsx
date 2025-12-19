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
import { Loader2, RotateCcw, AlertCircle } from 'lucide-react';
import { FloorRoomMaterial } from '@/types/construction';
import { useReturnMaterial } from '@/hooks/construction/useRoomMaterialTransactions';
import { useCompany } from '@/contexts/CompanyContext';

interface ReturnMaterialDialogProps {
  material: FloorRoomMaterial | null;
  roomId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReturnMaterialDialog({
  material,
  roomId,
  open,
  onOpenChange,
}: ReturnMaterialDialogProps) {
  const { selectedCompany } = useCompany();
  const [quantity, setQuantity] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  
  const returnMaterial = useReturnMaterial();
  
  const currentAllocated = material?.quantity_allocated ?? 0;
  const warehouseStock = material?.warehouse_item?.current_stock ?? 0;
  const quantityNum = parseFloat(quantity) || 0;
  
  const isExceedsAllocated = quantityNum > currentAllocated;

  const handleSubmit = () => {
    if (!material || !material.warehouse_item?.id || quantityNum <= 0) return;

    returnMaterial.mutate(
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
            <RotateCcw className="h-5 w-5 text-orange-600" />
            Return Material to Warehouse
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
                  <span className="text-muted-foreground">Issued to Room:</span>{' '}
                  <span className="font-medium text-orange-600">{currentAllocated}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Warehouse Stock:</span>{' '}
                  <span className="font-medium">{warehouseStock}</span>
                </div>
              </div>
            </div>

            {currentAllocated === 0 ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No materials have been issued to this room yet. Nothing to return.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                {/* Quantity Input */}
                <div className="space-y-2">
                  <Label htmlFor="return-quantity">Quantity to Return</Label>
                  <Input
                    id="return-quantity"
                    type="number"
                    min="0"
                    step="0.001"
                    max={currentAllocated}
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder={`Max: ${currentAllocated}`}
                  />
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs"
                    onClick={() => setQuantity(String(currentAllocated))}
                  >
                    Return all ({currentAllocated})
                  </Button>
                </div>

                {/* Validation Alerts */}
                {isExceedsAllocated && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Cannot return more than issued. Currently issued: {currentAllocated}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Notes */}
                <div className="space-y-2">
                  <Label htmlFor="return-notes">Notes (Optional)</Label>
                  <Textarea
                    id="return-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Reason for return..."
                    rows={2}
                  />
                </div>
              </>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={quantityNum <= 0 || isExceedsAllocated || currentAllocated === 0 || returnMaterial.isPending}
          >
            {returnMaterial.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Return Material
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
