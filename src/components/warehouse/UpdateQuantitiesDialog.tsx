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

interface UpdateQuantitiesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issueId: string;
  onSuccess: () => void;
}

export function UpdateQuantitiesDialog({ 
  open, 
  onOpenChange, 
  issueId, 
  onSuccess 
}: UpdateQuantitiesDialogProps) {
  const [items, setItems] = useState<MaterialIssueItem[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [updating, setUpdating] = useState(false);
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
    
    // Initialize quantities map
    const initialQuantities: Record<string, number> = {};
    data?.forEach(item => {
      initialQuantities[item.id] = item.quantity_received || 0;
    });
    setQuantities(initialQuantities);
  };

  const handleQuantityChange = (itemId: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setQuantities(prev => ({ ...prev, [itemId]: numValue }));
  };

  const handleUpdate = async () => {
    setUpdating(true);
    try {
      // Update each item's quantity_received
      for (const [itemId, quantity] of Object.entries(quantities)) {
        const { error } = await supabase
          .from('material_issue_items')
          .update({ quantity_received: quantity })
          .eq('id', itemId);

        if (error) throw error;
      }

      toast({
        title: 'Success',
        description: 'Quantities updated successfully',
      });

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating quantities:', error);
      toast({
        title: 'Error',
        description: 'Failed to update quantities',
        variant: 'destructive',
      });
    } finally {
      setUpdating(false);
    }
  };

  const getStatusColor = (item: MaterialIssueItem) => {
    const qtyReceived = quantities[item.id] || 0;
    const qtyRequired = item.quantity_required || item.quantity_issued;
    
    if (qtyReceived >= qtyRequired) return 'text-green-600';
    if (qtyReceived > 0) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Update Received Quantities</DialogTitle>
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
                <TableHead>Required</TableHead>
                <TableHead>Received</TableHead>
                <TableHead>Variance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, index) => {
                const qtyReceived = quantities[item.id] || 0;
                const qtyRequired = item.quantity_required || item.quantity_issued;
                const variance = qtyReceived - qtyRequired;
                
                return (
                  <TableRow key={item.id}>
                    <TableCell>{item.line_number || index + 1}</TableCell>
                    <TableCell>{item.item_code}</TableCell>
                    <TableCell>{item.description}</TableCell>
                    <TableCell>{item.unit_of_measure}</TableCell>
                    <TableCell>{qtyRequired}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={quantities[item.id] || 0}
                        onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                        className="w-24"
                      />
                    </TableCell>
                    <TableCell className={getStatusColor(item)}>
                      {variance !== 0 && (variance > 0 ? '+' : '')}{variance.toFixed(2)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleUpdate} disabled={updating}>
            {updating ? 'Updating...' : 'Update Quantities'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
