import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, RotateCcw } from 'lucide-react';
import { FloorRoomMaterial } from '@/types/construction';
import { useReturnMaterial } from '@/hooks/construction/useRoomMaterialTransactions';

interface ReturnMaterialDialogProps {
  material: FloorRoomMaterial | null;
  roomId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Returns material from a room on a Material Return Note against the issue note
 * it came on, back to the bin it left. Damaged or expired stock is held for a
 * warehouse manager. The room is updated when an admin approves the return.
 */
export function ReturnMaterialDialog({ material, roomId, open, onOpenChange }: ReturnMaterialDialogProps) {
  const [quantity, setQuantity] = useState('');
  const [condition, setCondition] = useState<'good' | 'damaged' | 'expired'>('good');
  const [reason, setReason] = useState('');
  const returnMaterial = useReturnMaterial();

  const currentAllocated = material?.quantity_allocated ?? 0;
  const quantityNum = parseFloat(quantity) || 0;
  const tooMuch = quantityNum > currentAllocated;

  const handleSubmit = () => {
    if (!material || quantityNum <= 0 || tooMuch || !reason.trim()) return;
    returnMaterial.mutate(
      { room_id: roomId, room_material_id: material.id, quantity: quantityNum, condition, reason: reason.trim() },
      {
        onSuccess: () => {
          setQuantity('');
          setReason('');
          setCondition('good');
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-orange-600" />
            Return material from the room
          </DialogTitle>
          <DialogDescription>
            Creates a Material Return Note back to the bin the material came from. The room is updated once an admin approves it.
          </DialogDescription>
        </DialogHeader>

        {material && (
          <div className="space-y-4">
            <div className="p-3 bg-muted rounded-lg text-sm">
              <div className="font-medium">{material.warehouse_item?.item_code} - {material.warehouse_item?.name}</div>
              <div className="text-muted-foreground">Issued to the room: <b className="text-foreground">{currentAllocated}</b></div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="return-quantity">Quantity *</Label>
                <Input id="return-quantity" type="number" min="0" step="any" value={quantity}
                  onChange={(e) => setQuantity(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Condition</Label>
                <Select value={condition} onValueChange={(v) => setCondition(v as typeof condition)}>
                  <SelectTrigger aria-label="Condition"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="good">Good</SelectItem>
                    <SelectItem value="damaged">Damaged</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {tooMuch && <p className="text-xs text-destructive">Only {currentAllocated} was issued to this room.</p>}

            <div className="space-y-2">
              <Label htmlFor="return-reason">Reason *</Label>
              <Textarea id="return-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={returnMaterial.isPending || quantityNum <= 0 || tooMuch || !reason.trim()}>
            {returnMaterial.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create return note
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
