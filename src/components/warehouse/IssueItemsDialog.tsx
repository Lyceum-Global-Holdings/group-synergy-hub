import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { MaterialIssueItem } from '@/types/materialIssueReturn';
import { Loader2, Package } from 'lucide-react';

interface BatchPreview {
  batch_id: string;
  batch_number: string;
  quantity_from_batch: number;
  expiry_date?: string;
  quantity_remaining: number;
}

interface ItemBatchPreview {
  item_id: string;
  item_code: string;
  quantity_issued: number;
  batches: BatchPreview[];
  insufficient: boolean;
}

interface IssueItemsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issueId: string;
  onSuccess: () => void;
}

export function IssueItemsDialog({ open, onOpenChange, issueId, onSuccess }: IssueItemsDialogProps) {
  const [items, setItems] = useState<MaterialIssueItem[]>([]);
  const [issuing, setIssuing] = useState(false);
  const [batchPreviews, setBatchPreviews] = useState<ItemBatchPreview[]>([]);
  const [loadingPreviews, setLoadingPreviews] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open && issueId) {
      fetchItems();
    }
  }, [open, issueId]);

  const fetchItems = async () => {
    const { data, error } = await supabase
      .from('material_issue_items')
      .select('*')
      .eq('min_id', issueId)
      .order('line_number', { ascending: true });

    if (error) {
      console.error('Error fetching items:', error);
      return;
    }

    setItems(data || []);
    if (data && data.length > 0) {
      fetchBatchPreviews(data);
    }
  };

  const fetchBatchPreviews = async (issueItems: MaterialIssueItem[]) => {
    setLoadingPreviews(true);
    try {
      const { data: issueNote } = await supabase
        .from('material_issue_notes')
        .select('company_id')
        .eq('id', issueId)
        .single();

      const companyId = issueNote?.company_id;
      const previews: ItemBatchPreview[] = [];

      for (const item of issueItems) {
        const qtyToIssue = item.quantity_issued || item.quantity_required;
        const { data: batches } = await supabase
          .from('item_batches')
          .select('id, batch_number, quantity_remaining, expiry_date')
          .eq('warehouse_item_id', item.item_id)
          .eq('company_id', companyId)
          .eq('status', 'active')
          .gt('quantity_remaining', 0)
          .order('created_at', { ascending: true });

        const allocated: BatchPreview[] = [];
        let remaining = qtyToIssue;

        for (const batch of (batches || [])) {
          if (remaining <= 0) break;
          const take = Math.min(batch.quantity_remaining, remaining);
          allocated.push({
            batch_id: batch.id,
            batch_number: batch.batch_number,
            quantity_from_batch: take,
            expiry_date: batch.expiry_date || undefined,
            quantity_remaining: batch.quantity_remaining,
          });
          remaining -= take;
        }

        previews.push({
          item_id: item.item_id,
          item_code: item.item_code || '',
          quantity_issued: qtyToIssue,
          batches: allocated,
          insufficient: remaining > 0,
        });
      }

      setBatchPreviews(previews);
    } catch (err) {
      console.error('Error fetching batch previews:', err);
    } finally {
      setLoadingPreviews(false);
    }
  };

  const handleIssue = async () => {
    setIssuing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', user.id)
        .single();

      const { data: issueNote, error: issueNoteError } = await supabase
        .from('material_issue_notes')
        .select('company_id')
        .eq('id', issueId)
        .single();

      if (issueNoteError) throw issueNoteError;

      // Check batch insufficiency
      const hasInsufficient = batchPreviews.some(p => p.insufficient);
      if (hasInsufficient) {
        toast({
          title: 'Insufficient Batch Stock',
          description: 'Some items do not have enough batch stock for FIFO allocation',
          variant: 'destructive',
        });
        setIssuing(false);
        return;
      }

      const itemIds = items.map(item => item.item_id);
      const { data: warehouseItems, error: stockFetchError } = await supabase
        .from('warehouse_items')
        .select('id, current_stock')
        .in('id', itemIds);

      if (stockFetchError) throw stockFetchError;

      const stockMap = new Map(warehouseItems?.map(wi => [wi.id, wi.current_stock]) || []);
      const insufficientStock = items.filter(item => {
        const currentStock = stockMap.get(item.item_id) || 0;
        return currentStock < item.quantity_issued;
      });

      if (insufficientStock.length > 0) {
        toast({
          title: 'Insufficient Stock',
          description: `${insufficientStock.length} item(s) have insufficient stock`,
          variant: 'destructive',
        });
        setIssuing(false);
        return;
      }

      const currentTimestamp = new Date().toISOString();

      // Create stock transactions
      const stockTransactions = items.map(item => {
        const currentStock = stockMap.get(item.item_id) || 0;
        return {
          item_id: item.item_id,
          transaction_type: 'material_issue' as const,
          reference_type: 'manual' as const,
          reference_id: issueId,
          quantity_change: -item.quantity_issued,
          quantity_before: currentStock,
          quantity_after: currentStock - item.quantity_issued,
          unit_cost: item.unit_cost || 0,
          total_value: item.total_cost || 0,
          notes: `Material Issue: ${issueId}`,
          company_id: issueNote.company_id,
          created_by: user.id,
        };
      });

      const { error: stockError } = await supabase
        .from('stock_transactions')
        .insert(stockTransactions);

      if (stockError) throw stockError;

      // FIFO batch consumption via RPC
      for (const item of items) {
        const { error: fifoError } = await supabase.rpc('process_fifo_batch_issue', {
          p_issue_item_id: item.id,
          p_item_id: item.item_id,
          p_quantity_issued: item.quantity_issued,
          p_company_id: issueNote.company_id,
        });

        if (fifoError) {
          console.error('FIFO batch issue error:', fifoError);
          throw new Error(`Batch allocation failed for ${item.item_code || item.item_id}: ${fifoError.message}`);
        }
      }

      // Update warehouse items stock levels and bin allocations
      for (const item of items) {
        const currentStock = stockMap.get(item.item_id) || 0;

        const { error: updateStockError } = await supabase
          .from('warehouse_items')
          .update({ current_stock: currentStock - item.quantity_issued })
          .eq('id', item.item_id);

        if (updateStockError) throw updateStockError;

        const { data: allocations } = await supabase
          .from('warehouse_bin_allocations')
          .select('id, allocated_quantity')
          .eq('warehouse_item_id', item.item_id)
          .gt('allocated_quantity', 0)
          .order('allocated_quantity', { ascending: false });

        if (allocations && allocations.length > 0) {
          let remainingToReduce = item.quantity_issued;

          for (const alloc of allocations) {
            if (remainingToReduce <= 0) break;
            const reduceAmount = Math.min(remainingToReduce, alloc.allocated_quantity);
            await supabase
              .from('warehouse_bin_allocations')
              .update({ allocated_quantity: alloc.allocated_quantity - reduceAmount })
              .eq('id', alloc.id);
            remainingToReduce -= reduceAmount;
          }
        }

        const { error: updateItemError } = await supabase
          .from('material_issue_items')
          .update({ issued_at: currentTimestamp, quantity_received: 0 })
          .eq('id', item.id);

        if (updateItemError) throw updateItemError;
      }

      const { error: updateError } = await supabase
        .from('material_issue_notes')
        .update({
          status: 'issued',
          issued_by: user.id,
          issued_by_name: profile?.full_name || user.email,
        })
        .eq('id', issueId);

      if (updateError) throw updateError;

      toast({
        title: 'Success',
        description: 'Items issued successfully with FIFO batch allocation',
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error issuing items:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to issue items',
        variant: 'destructive',
      });
    } finally {
      setIssuing(false);
    }
  };

  const hasInsufficientBatch = batchPreviews.some(p => p.insufficient);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Issue Items</DialogTitle>
          <DialogDescription>
            Review items and FIFO batch allocation before confirming
          </DialogDescription>
        </DialogHeader>

        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Line</TableHead>
                <TableHead>Item Code</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>UOM</TableHead>
                <TableHead>Qty to Issue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, index) => (
                <TableRow key={item.id}>
                  <TableCell>{item.line_number || index + 1}</TableCell>
                  <TableCell>{item.item_code}</TableCell>
                  <TableCell>{item.description}</TableCell>
                  <TableCell>{item.unit_of_measure}</TableCell>
                  <TableCell>{item.quantity_issued || item.quantity_required}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* FIFO Batch Allocation Preview */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            <h4 className="font-medium text-sm">FIFO Batch Allocation Preview</h4>
          </div>

          {loadingPreviews ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground p-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading batch allocations...
            </div>
          ) : batchPreviews.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4">No items to preview.</p>
          ) : (
            <div className="space-y-2">
              {batchPreviews.map((preview) => (
                <div key={preview.item_id} className="border rounded-md p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {preview.item_code} — Issue {preview.quantity_issued}
                    </span>
                    {preview.insufficient ? (
                      <Badge variant="destructive">Insufficient Batch Stock</Badge>
                    ) : (
                      <Badge variant="secondary">
                        {preview.batches.length} batch{preview.batches.length !== 1 ? 'es' : ''}
                      </Badge>
                    )}
                  </div>
                  {preview.batches.length > 0 && (
                    <div className="text-xs text-muted-foreground space-y-1 pl-2">
                      {preview.batches.map((b) => (
                        <div key={b.batch_id} className="flex gap-4">
                          <span className="font-mono">{b.batch_number}</span>
                          <span>Take: {b.quantity_from_batch}</span>
                          <span>(Available: {b.quantity_remaining})</span>
                          {b.expiry_date && <span>Exp: {b.expiry_date}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleIssue} disabled={issuing || hasInsufficientBatch}>
            {issuing ? 'Issuing...' : 'Confirm Issue'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
