import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowRightLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useInvalidateWarehouseStock } from '@/hooks/useInvalidateWarehouseStock';
import { supabase } from '@/integrations/supabase/client';
import { useWarehouseBins } from '@/hooks/useWarehouseBins';
import { useWarehouseLocations } from '@/hooks/useWarehouseLocations';
import { useCurrentUserLocationPermissions } from '@/hooks/useCurrentUserLocationPermissions';
import {
  useCreateStockTransfer,
  useCreateStockTransferItem,
} from '@/hooks/useStockTransfer';
import type { BinAllocationWithDetails } from '@/types/warehouseReservation';

interface MoveBinAllocationDialogProps {
  allocation: BinAllocationWithDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MoveBinAllocationDialog({
  allocation,
  open,
  onOpenChange,
}: MoveBinAllocationDialogProps) {
  const queryClient = useQueryClient();
  const invalidateWarehouseStock = useInvalidateWarehouseStock();
  const { bins = [] } = useWarehouseBins({ skipLocationFilter: true });
  const { locations = [] } = useWarehouseLocations();
  const { data: permissions } = useCurrentUserLocationPermissions();
  const createTransfer = useCreateStockTransfer();
  const createItem = useCreateStockTransferItem();

  const [toBinId, setToBinId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setToBinId('');
      setQuantity('');
      setReason('');
      setNotes('');
      setIsSubmitting(false);
    } else if (allocation) {
      setQuantity(String(allocation.available_quantity || 0));
    }
  }, [open, allocation]);

  // Destination bins: exclude source bin; filter to user-editable locations
  const eligibleBins = useMemo(() => {
    if (!allocation) return [];
    const canEdit = (locId: string | null | undefined) => {
      if (!locId) return false;
      if (!permissions || permissions.viewAllLocations) return true;
      return permissions.editLocationIds?.includes(locId);
    };
    return bins.filter(
      (b) => b.id !== allocation.bin_id && canEdit(b.location_id),
    );
  }, [bins, allocation, permissions]);

  // Group bins by warehouse for clear cross-warehouse picking
  const binsByLocation = useMemo(() => {
    const map = new Map<
      string,
      { name: string; bins: typeof eligibleBins }
    >();
    for (const b of eligibleBins) {
      const loc = locations.find((l) => l.id === b.location_id);
      const key = b.location_id || 'unassigned';
      const name = loc?.name || 'Unassigned';
      if (!map.has(key)) map.set(key, { name, bins: [] });
      map.get(key)!.bins.push(b);
    }
    return Array.from(map.entries()).sort((a, b) =>
      a[1].name.localeCompare(b[1].name),
    );
  }, [eligibleBins, locations]);

  if (!allocation) return null;

  const available = Number(allocation.available_quantity) || 0;
  const sourceBinLabel = `${allocation.warehouse_bin?.bin_code ?? ''} - ${
    allocation.warehouse_bin?.name ?? ''
  }`;
  const sourceLocationName =
    allocation.warehouse_bin?.warehouse_location?.name ?? 'Unassigned';

  const handleSubmit = async () => {
    const qty = parseFloat(quantity);
    if (!toBinId) {
      toast.error('Select a destination bin');
      return;
    }
    if (toBinId === allocation.bin_id) {
      toast.error('Destination bin must differ from source');
      return;
    }
    if (!qty || qty <= 0) {
      toast.error('Enter a quantity greater than 0');
      return;
    }
    if (qty > available) {
      toast.error(`Quantity exceeds available (${available})`);
      return;
    }
    if (!allocation.company_id) {
      toast.error('Allocation is missing company context');
      return;
    }

    setIsSubmitting(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // 1. Create completed transfer header
      const transfer = await createTransfer.mutateAsync({
        transfer_date: new Date().toISOString().split('T')[0],
        transfer_type: 'location',
        priority: 'normal',
        from_bin_id: allocation.bin_id,
        to_bin_id: toBinId,
        reason: reason || undefined,
        notes: notes || undefined,
        status: 'approved',
        company_id: allocation.company_id,
      });

      // 2. Create transfer item line
      await createItem.mutateAsync({
        transfer_id: transfer.id,
        warehouse_item_id: allocation.warehouse_item_id,
        item_name: allocation.warehouse_item?.name ?? '',
        item_code: allocation.warehouse_item?.item_code,
        quantity_requested: qty,
        unit_of_measure: 'pcs',
        from_bin_id: allocation.bin_id,
        to_bin_id: toBinId,
        notes: notes || undefined,
      });

      // 3. Execute the FIFO physical move
      const { error: rpcError } = await supabase.rpc('transfer_stock_fifo', {
        p_item_id: allocation.warehouse_item_id,
        p_from_bin_id: allocation.bin_id,
        p_to_bin_id: toBinId,
        p_quantity: qty,
        p_company_id: allocation.company_id,
        p_user_id: user.id,
        p_transfer_number: transfer.transfer_number,
        p_transfer_id: transfer.id,
      });
      if (rpcError) throw rpcError;

      // 4. Mark transfer as completed
      await supabase
        .from('stock_transfer_requests')
        .update({
          status: 'completed',
          completed_by: user.id,
          completed_date: new Date().toISOString(),
        })
        .eq('id', transfer.id);

      await supabase
        .from('stock_transfer_items')
        .update({ status: 'completed', quantity_transferred: qty })
        .eq('transfer_id', transfer.id);

      toast.success(`Moved ${qty} units to destination bin`);
      invalidateWarehouseStock();
      onOpenChange(false);
    } catch (err: any) {
      console.error('Move stock failed:', err);
      toast.error(err?.message || 'Failed to move stock');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            Move Stock to Another Bin / Warehouse
          </DialogTitle>
          <DialogDescription>
            Posting change between bins. Updates source and destination
            allocations and writes a ledger entry atomically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Item</span>
              <span className="font-medium">
                {allocation.warehouse_item?.item_code} —{' '}
                {allocation.warehouse_item?.name}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Source bin</span>
              <span className="font-medium">{sourceBinLabel}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Source location</span>
              <span className="font-medium">{sourceLocationName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Available</span>
              <span className="font-medium text-success">{available}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="to-bin">Destination bin *</Label>
            <Select value={toBinId} onValueChange={setToBinId}>
              <SelectTrigger id="to-bin">
                <SelectValue placeholder="Select destination bin" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {binsByLocation.length === 0 && (
                  <div className="px-2 py-3 text-sm text-muted-foreground">
                    No eligible destination bins
                  </div>
                )}
                {binsByLocation.map(([key, group]) => (
                  <SelectGroup key={key}>
                    <SelectLabel>{group.name}</SelectLabel>
                    {group.bins.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.bin_code} — {b.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="qty">Quantity to move *</Label>
            <Input
              id="qty"
              type="number"
              min="0.01"
              step="0.01"
              max={available}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason</Label>
            <Input
              id="reason"
              placeholder="e.g. Rebalance stock, customer demand"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Move Stock
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
