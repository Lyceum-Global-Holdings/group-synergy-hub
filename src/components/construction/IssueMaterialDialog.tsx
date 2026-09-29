import { useEffect, useState } from 'react';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ArrowUpCircle, AlertCircle } from 'lucide-react';
import { FloorRoomMaterial } from '@/types/construction';
import { useIssueMaterial, useRoomWarehouseOptions } from '@/hooks/construction/useRoomMaterialTransactions';

interface IssueMaterialDialogProps {
  material: FloorRoomMaterial | null;
  roomId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Requests material for a room on a Material Issue Note from one of the
 * project's warehouses. Stock is reserved now and leaves the bins when the
 * approved note is issued; the room is updated then.
 */
export function IssueMaterialDialog({ material, roomId, open, onOpenChange }: IssueMaterialDialogProps) {
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [locationId, setLocationId] = useState<string>();
  const issueMaterial = useIssueMaterial();
  const { data: warehouses = [], isLoading: loadingWarehouses } = useRoomWarehouseOptions(open ? roomId : null);

  useEffect(() => {
    if (warehouses.length === 1) setLocationId(warehouses[0].id);
  }, [warehouses]);

  const currentAllocated = material?.quantity_allocated ?? 0;
  const quantityRequired = material?.quantity_required ?? 0;
  const remaining = Math.max(0, quantityRequired - currentAllocated);
  const quantityNum = parseFloat(quantity) || 0;
  const exceedsPlan = quantityRequired > 0 && quantityNum > remaining;

  const handleSubmit = () => {
    if (!material || !locationId || quantityNum <= 0 || exceedsPlan) return;
    issueMaterial.mutate(
      { room_id: roomId, location_id: locationId, lines: [{ room_material_id: material.id, quantity: quantityNum }], notes },
      {
        onSuccess: () => {
          setQuantity('');
          setNotes('');
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
            <ArrowUpCircle className="h-5 w-5 text-green-600" />
            Request material for the room
          </DialogTitle>
          <DialogDescription>
            Creates a Material Issue Note. An admin approves it and the store issues it from the bins; the room is updated when it is issued.
          </DialogDescription>
        </DialogHeader>

        {material && (
          <div className="space-y-4">
            <div className="p-3 bg-muted rounded-lg space-y-1 text-sm">
              <div className="font-medium">{material.warehouse_item?.item_code} - {material.warehouse_item?.name}</div>
              <div className="grid grid-cols-3 gap-2 text-muted-foreground">
                <span>Planned: <b className="text-foreground">{quantityRequired}</b></span>
                <span>Issued: <b className="text-foreground">{currentAllocated}</b></span>
                <span>Still needed: <b className="text-foreground">{remaining}</b></span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>From warehouse *</Label>
              {!loadingWarehouses && warehouses.length === 0 ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>This project has no warehouse. Allocate one to the project first.</AlertDescription>
                </Alert>
              ) : (
                <Select value={locationId} onValueChange={setLocationId}>
                  <SelectTrigger aria-label="Warehouse"><SelectValue placeholder="Choose the project's warehouse" /></SelectTrigger>
                  <SelectContent>
                    {warehouses.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="issue-quantity">Quantity *</Label>
              <Input id="issue-quantity" type="number" min="0" step="any" value={quantity}
                onChange={(e) => setQuantity(e.target.value)} placeholder="Enter quantity" />
              {exceedsPlan && <p className="text-xs text-destructive">Only {remaining} more is planned for this room.</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="issue-notes">Notes</Label>
              <Textarea id="issue-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={issueMaterial.isPending || !locationId || quantityNum <= 0 || exceedsPlan}>
            {issueMaterial.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Submit issue note
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
