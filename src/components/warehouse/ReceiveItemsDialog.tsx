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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { MaterialIssueItem } from '@/types/materialIssueReturn';
import { useMaterialReturnItems } from '@/hooks/useMaterialReturnItems';
import { useQueryClient } from '@tanstack/react-query';

interface ReceiveItemsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issueId: string;
  onSuccess: () => void;
}

interface ItemReceiveData {
  itemId: string;
  receivedQty: number;
  condition: 'good' | 'damaged' | 'expired';
  varianceReason?: 'shortage' | 'damaged' | 'expired' | 'other';
  varianceNotes?: string;
  createReturn: boolean;
}

export function ReceiveItemsDialog({ open, onOpenChange, issueId, onSuccess }: ReceiveItemsDialogProps) {
  const [items, setItems] = useState<MaterialIssueItem[]>([]);
  const [receiveData, setReceiveData] = useState<Record<string, ItemReceiveData>>({});
  const [receiving, setReceiving] = useState(false);
  const { toast } = useToast();
  const { createItems: createReturnItems } = useMaterialReturnItems();
  const queryClient = useQueryClient();

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
    
    // Initialize receive data
    const initialData: Record<string, ItemReceiveData> = {};
    data?.forEach(item => {
      initialData[item.id] = {
        itemId: item.id,
        receivedQty: item.quantity_received ?? 0,
        condition: 'good',
        createReturn: false
      };
    });
    setReceiveData(initialData);
  };

  const updateReceiveData = (itemId: string, field: keyof ItemReceiveData, value: any) => {
    setReceiveData(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: value
      }
    }));
  };

  const calculateVariance = (itemId: string): number => {
    const item = items.find(i => i.id === itemId);
    const data = receiveData[itemId];
    if (!item || !data) return 0;
    const issued = item.quantity_issued || 0;
    return issued - data.receivedQty;
  };

  const handleReceive = async () => {
    setReceiving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get user profile for name
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, company_id')
        .eq('user_id', user.id)
        .single();

      const currentTimestamp = new Date().toISOString();

      // Collect items with variance that need returns
      const varianceItemsForReturn: any[] = [];

      // Update each item with received quantity and variance data
      const updatePromises = items.map(item => {
        const data = receiveData[item.id];
        const variance = calculateVariance(item.id);
        
        // If create return is checked and there's variance, collect for return
        if (data.createReturn && variance > 0) {
          varianceItemsForReturn.push({
            item,
            variance,
            condition: data.condition,
            reason: data.varianceReason,
            notes: data.varianceNotes
          });
        }

        return supabase
          .from('material_issue_items')
          .update({
            quantity_received: data.receivedQty,
            received_at: currentTimestamp
          })
          .eq('id', item.id);
      });

      await Promise.all(updatePromises);

      // Check if all items are fully received
      const allReceived = items.every((item) => {
        const data = receiveData[item.id];
        const issued = item.quantity_issued || 0;
        return data.receivedQty >= issued;
      });

      // Check if any items are received
      const anyReceived = items.some(item => {
        const data = receiveData[item.id];
        return data.receivedQty > 0;
      });

      // Determine new status
      let newStatus = 'issued';
      if (allReceived) {
        newStatus = 'completed';
      } else if (anyReceived) {
        newStatus = 'partially_received';
      }

      // Update the material issue note
      const { error: updateError } = await supabase
        .from('material_issue_notes')
        .update({
          status: newStatus,
          received_by: user.id,
          received_by_name: profile?.full_name || user.email,
          received_date: new Date().toISOString(),
          order_completed: allReceived,
        })
        .eq('id', issueId);

      if (updateError) throw updateError;

      // Auto-create Material Return Note for variance items if requested
      let returnReference = '';
      if (varianceItemsForReturn.length > 0) {
        try {
          // Generate MRN number
          const { data: mrnNumber } = await supabase.rpc('generate_mrn_number');
          
          // Create return note
          const { data: returnNote, error: returnError } = await supabase
            .from('material_return_notes')
            .insert({
              mrn_number: mrnNumber,
              return_date: new Date().toISOString().split('T')[0],
              returned_by: user.email,
              return_type: 'internal',
              reason: 'Variance from receiving',
              reference_type: 'material_issue',
              reference_id: issueId,
              status: 'draft',
              company_id: profile?.company_id,
              created_by: user.id
            })
            .select()
            .single();

          if (returnError) throw returnError;

          // Create return items
          const returnItems = varianceItemsForReturn.map(v => ({
            mrn_id: returnNote.id,
            item_id: v.item.item_id,
            quantity_returned: v.variance,
            condition: v.condition || 'good',
            unit_cost: v.item.unit_cost || 0,
            total_cost: (v.item.unit_cost || 0) * v.variance,
            notes: v.notes || `Variance from ${v.reason || 'receiving'}: ${v.item.item_code} - ${v.item.description}`
          }));

          await createReturnItems(returnItems);
          await queryClient.invalidateQueries({ queryKey: ['material-returns'] });
          returnReference = returnNote.mrn_number;
        } catch (returnErr: any) {
          console.error('Error creating return:', returnErr);
          console.error('Return error details:', JSON.stringify(returnErr, null, 2));
          toast({
            title: 'Warning',
            description: `Items received but failed to create return note: ${returnErr.message || 'Unknown error'}`,
            variant: 'destructive'
          });
        }
      }

      toast({
        title: 'Success',
        description: returnReference 
          ? `Items received successfully. Return ${returnReference} created for variance items.`
          : 'Items received successfully',
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
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
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
                <TableHead>Item</TableHead>
                <TableHead>UOM</TableHead>
                <TableHead>Issued</TableHead>
                <TableHead>Received</TableHead>
                <TableHead>Variance</TableHead>
                <TableHead>Condition</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="text-center">Create Return</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, index) => {
                const variance = calculateVariance(item.id);
                const data = receiveData[item.id] || {
                  itemId: item.id,
                  receivedQty: 0,
                  condition: 'good' as const,
                  createReturn: false
                };
                const hasVariance = variance > 0;

                return (
                  <TableRow key={item.id}>
                    <TableCell>{item.line_number || index + 1}</TableCell>
                    <TableCell>
                      <div className="font-medium">{item.item_code}</div>
                      <div className="text-sm text-muted-foreground">{item.description}</div>
                    </TableCell>
                    <TableCell>{item.unit_of_measure}</TableCell>
                    <TableCell>{item.quantity_issued || 0}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        step="0.001"
                        inputMode="decimal"
                        max={item.quantity_issued || 0}
                        value={data.receivedQty || ''}
                        onChange={(e) => updateReceiveData(item.id, 'receivedQty', parseFloat(e.target.value) || 0)}
                        className="w-24"
                      />
                    </TableCell>
                    <TableCell>
                      <span className={hasVariance ? 'text-destructive font-medium' : ''}>
                        {variance.toFixed(2)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={data.condition || 'good'}
                        onValueChange={(value: 'good' | 'damaged' | 'expired') => 
                          updateReceiveData(item.id, 'condition', value)
                        }
                      >
                        <SelectTrigger className="w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="good">Good</SelectItem>
                          <SelectItem value="damaged">Damaged</SelectItem>
                          <SelectItem value="expired">Expired</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {hasVariance && (
                        <Select
                          value={data.varianceReason || ''}
                          onValueChange={(value: 'shortage' | 'damaged' | 'expired' | 'other') => 
                            updateReceiveData(item.id, 'varianceReason', value)
                          }
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue placeholder="Select reason" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="shortage">Shortage</SelectItem>
                            <SelectItem value="damaged">Damaged</SelectItem>
                            <SelectItem value="expired">Expired</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell>
                      {hasVariance && (
                        <Textarea
                          value={data.varianceNotes || ''}
                          onChange={(e) => updateReceiveData(item.id, 'varianceNotes', e.target.value)}
                          placeholder="Variance notes..."
                          className="min-w-32"
                          rows={2}
                        />
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {hasVariance && (
                        <Checkbox
                          checked={data.createReturn || false}
                          onCheckedChange={(checked) => 
                            updateReceiveData(item.id, 'createReturn', checked)
                          }
                        />
                      )}
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
          <Button onClick={handleReceive} disabled={receiving}>
            {receiving ? 'Receiving...' : 'Confirm Receipt'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
