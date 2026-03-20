import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useCompany } from '@/contexts/CompanyContext';
import { toast } from 'sonner';
import { WarehouseItem } from '@/types/itemBin';

interface BulkInventoryDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedItems: WarehouseItem[];
  onComplete: () => void;
}

export function BulkInventoryDeleteDialog({ open, onOpenChange, selectedItems, onComplete }: BulkInventoryDeleteDialogProps) {
  const queryClient = useQueryClient();
  const { selectedCompany } = useCompany();
  const [isProcessing, setIsProcessing] = useState(false);

  const withStock = selectedItems.filter(i => (i.current_stock || 0) > 0);
  const zeroStock = selectedItems.filter(i => (i.current_stock || 0) === 0);

  const handleConfirm = async () => {
    setIsProcessing(true);
    let successCount = 0;
    let errorCount = 0;

    // Zero stock items → remove from inventory via RPC
    for (const item of zeroStock) {
      try {
        const { error } = await supabase.rpc('remove_item_from_inventory' as any, { p_item_id: item.id });
        if (error) throw error;
        successCount++;
      } catch (e: any) {
        console.error('Bulk delete error:', e);
        errorCount++;
      }
    }

    // Items with stock → mark inactive
    for (const item of withStock) {
      const { error } = await supabase.from('warehouse_items').update({ status: 'inactive' }).eq('id', item.id);
      if (error) {
        console.error('Bulk inactivate error:', error);
        errorCount++;
      } else {
        successCount++;
      }
    }

    queryClient.invalidateQueries({ queryKey: ['warehouse-items-inventory'] });
    queryClient.invalidateQueries({ queryKey: ['warehouse-items'] });
    queryClient.invalidateQueries({ queryKey: ['warehouse-items-catalog-ids', selectedCompany?.id] });
    queryClient.invalidateQueries({ queryKey: ['warehouse-bin-allocations'] });

    if (errorCount === 0) {
      toast.success(`Processed ${successCount} items successfully`);
    } else {
      toast.warning(`Processed ${successCount} items, ${errorCount} failed`);
    }

    setIsProcessing(false);
    onOpenChange(false);
    onComplete();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Bulk Remove {selectedItems.length} Items
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2 text-sm">
          {zeroStock.length > 0 && (
            <p><strong>{zeroStock.length}</strong> item(s) with zero stock will be <span className="text-destructive font-medium">removed from inventory</span> (catalog entry preserved).</p>
          )}
          {withStock.length > 0 && (
            <p><strong>{withStock.length}</strong> item(s) with existing stock will be <span className="text-yellow-600 font-medium">marked as inactive</span> to preserve history.</p>
          )}
          <p className="text-muted-foreground">This action cannot be easily undone.</p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>Cancel</Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={isProcessing}>
            {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
