import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { MaterialIssueItem } from '@/types/materialIssueReturn';

interface IssueItemsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issueId: string;
  onSuccess: () => void;
}

export function IssueItemsDialog({ open, onOpenChange, issueId, onSuccess }: IssueItemsDialogProps) {
  const [items, setItems] = useState<MaterialIssueItem[]>([]);
  const [issuing, setIssuing] = useState(false);
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
  };

  const handleIssue = async () => {
    setIssuing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get user profile for name
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', user.id)
        .single();

      // Fetch company_id from material issue note
      const { data: issueNote, error: issueNoteError } = await supabase
        .from('material_issue_notes')
        .select('company_id')
        .eq('id', issueId)
        .single();

      if (issueNoteError) throw issueNoteError;

      // Fetch current stock for all items and validate
      const itemIds = items.map(item => item.item_id);
      const { data: warehouseItems, error: stockFetchError } = await supabase
        .from('warehouse_items')
        .select('id, current_stock')
        .in('id', itemIds);

      if (stockFetchError) throw stockFetchError;

      // Validate stock availability
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

      // Create stock transactions with correct before/after values and company_id
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
          created_by: user.id
        };
      });

      // Insert stock transactions
      const { error: stockError } = await supabase
        .from('stock_transactions')
        .insert(stockTransactions);

      if (stockError) throw stockError;

      // Update warehouse items stock levels, bin allocations, and material_issue_items with issued_at
      for (const item of items) {
        const currentStock = stockMap.get(item.item_id) || 0;
        
        // Update warehouse stock
        const { error: updateStockError } = await supabase
          .from('warehouse_items')
          .update({ 
            current_stock: currentStock - item.quantity_issued
          })
          .eq('id', item.item_id);

        if (updateStockError) throw updateStockError;

        // Update bin allocations - reduce the allocated quantity
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
            const newAllocQty = alloc.allocated_quantity - reduceAmount;
            
            await supabase
              .from('warehouse_bin_allocations')
              .update({ allocated_quantity: newAllocQty })
              .eq('id', alloc.id);
            
            remainingToReduce -= reduceAmount;
          }
        }

        // Update material_issue_items with issued_at
        const { error: updateItemError } = await supabase
          .from('material_issue_items')
          .update({ 
            issued_at: currentTimestamp,
            quantity_received: 0
          })
          .eq('id', item.id);

        if (updateItemError) throw updateItemError;
      }

      // Update material issue note status
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
        description: 'Items issued successfully and stock updated',
      });

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error issuing items:', error);
      toast({
        title: 'Error',
        description: 'Failed to issue items',
        variant: 'destructive',
      });
    } finally {
      setIssuing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Issue Items</DialogTitle>
          <DialogDescription>
            Review and confirm the items to be issued from warehouse
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
                <TableHead>Quantity to Issue</TableHead>
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

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleIssue} disabled={issuing}>
            {issuing ? 'Issuing...' : 'Confirm Issue'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
