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

interface ReceiveItemsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issueId: string;
  onSuccess: () => void;
}

export function ReceiveItemsDialog({ open, onOpenChange, issueId, onSuccess }: ReceiveItemsDialogProps) {
  const [items, setItems] = useState<MaterialIssueItem[]>([]);
  const [receivedQuantities, setReceivedQuantities] = useState<Record<string, number>>({});
  const [receiving, setReceiving] = useState(false);
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
    
    // Initialize received quantities
    const quantities: Record<string, number> = {};
    data?.forEach(item => {
      quantities[item.id] = item.quantity_required || item.quantity_issued || 0;
    });
    setReceivedQuantities(quantities);
  };

  const handleQuantityChange = (itemId: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setReceivedQuantities(prev => ({ ...prev, [itemId]: numValue }));
  };

  const handleReceive = async () => {
    setReceiving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get user profile for name
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', user.id)
        .single();

      // Update each item with received quantity
      const updatePromises = items.map(item => 
        supabase
          .from('material_issue_items')
          .update({
            quantity_received: receivedQuantities[item.id] || 0,
          })
          .eq('id', item.id)
      );

      await Promise.all(updatePromises);

      // Check if all items are fully received
      const allFullyReceived = items.every(item => {
        const received = receivedQuantities[item.id] || 0;
        const required = item.quantity_required || item.quantity_issued || 0;
        return received >= required;
      });

      // Update material issue note status
      const { error: updateError } = await supabase
        .from('material_issue_notes')
        .update({
          received_by: user.id,
          received_by_name: profile?.full_name || user.email,
          received_date: new Date().toISOString(),
          order_completed: allFullyReceived,
        })
        .eq('id', issueId);

      if (updateError) throw updateError;

      toast({
        title: 'Success',
        description: 'Items received successfully',
      });

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error receiving items:', error);
      toast({
        title: 'Error',
        description: 'Failed to receive items',
        variant: 'destructive',
      });
    } finally {
      setReceiving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Receive Items</DialogTitle>
          <DialogDescription>
            Enter the actual quantities received for each item
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
                <TableHead>Qty Issued</TableHead>
                <TableHead>Qty Received</TableHead>
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
                  <TableCell>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={receivedQuantities[item.id] || ''}
                      onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                      className="w-24"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleReceive} disabled={receiving}>
            {receiving ? 'Receiving...' : 'Confirm Receipt'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
