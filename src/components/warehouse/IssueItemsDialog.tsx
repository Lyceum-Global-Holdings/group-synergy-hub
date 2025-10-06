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

      // Create stock transactions for each item
      const stockTransactions = items.map(item => ({
        item_id: item.item_id,
        transaction_type: 'material_issue' as const,
        reference_type: 'manual' as const,
        reference_id: issueId,
        quantity_change: -item.quantity_issued,
        quantity_before: 0,
        quantity_after: 0,
        unit_cost: item.unit_cost || 0,
        total_value: item.total_cost || 0,
        notes: `Material Issue: ${issueId}`,
      }));

      // Insert stock transactions
      const { error: stockError } = await supabase
        .from('stock_transactions')
        .insert(stockTransactions);

      if (stockError) throw stockError;

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
        description: 'Items issued successfully',
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
                  <TableCell>{item.quantity_required || item.quantity_issued}</TableCell>
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
