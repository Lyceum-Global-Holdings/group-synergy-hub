import { useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  Dialog,
  DialogContent,
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreatePutaway, useCreatePutawayItem } from '@/hooks/usePutaway';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Trash2 } from 'lucide-react';
import { useWarehouseBins } from '@/hooks/useWarehouseBins';
import { useWarehouseItems } from '@/hooks/useWarehouseItems';

interface CreatePutawayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface PutawayItemInput {
  warehouse_item_id: string;
  item_name: string;
  quantity: number;
  to_bin_id: string;
  notes?: string;
}

export function CreatePutawayDialog({ open, onOpenChange }: CreatePutawayDialogProps) {
  const [items, setItems] = useState<PutawayItemInput[]>([]);
  const [selectedGrnId, setSelectedGrnId] = useState<string>('');
  
  const { register, handleSubmit, reset, setValue } = useForm();
  const createPutaway = useCreatePutaway();
  const createPutawayItem = useCreatePutawayItem();
  const { bins = [] } = useWarehouseBins();
  const { items: warehouseItems = [] } = useWarehouseItems();

  // Fetch GRNs
  const { data: grns = [] } = useQuery({
    queryKey: ['grns-for-putaway'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('goods_receipt_notes')
        .select('id, grn_number, grn_date')
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    }
  });

  const addItem = () => {
    setItems([...items, {
      warehouse_item_id: '',
      item_name: '',
      quantity: 1,
      to_bin_id: '',
      notes: ''
    }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof PutawayItemInput, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    // Auto-fill item name when item is selected
    if (field === 'warehouse_item_id') {
      const selectedItem = warehouseItems.find(item => item.id === value);
      if (selectedItem) {
        newItems[index].item_name = selectedItem.name;
      }
    }
    
    setItems(newItems);
  };

  const onSubmit = async (data: any) => {
    try {
      const selectedGrn = grns.find(g => g.id === selectedGrnId);
      
      const putaway = await createPutaway.mutateAsync({
        grn_id: selectedGrnId || undefined,
        grn_number: selectedGrn?.grn_number,
        putaway_date: data.putaway_date || new Date().toISOString().split('T')[0],
        notes: data.notes
      });

      // Create putaway items
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.warehouse_item_id && item.to_bin_id) {
          await createPutawayItem.mutateAsync({
            putaway_id: putaway.id,
            warehouse_item_id: item.warehouse_item_id,
            item_name: item.item_name,
            quantity: item.quantity,
            to_bin_id: item.to_bin_id,
            putaway_sequence: i + 1,
            notes: item.notes
          });
        }
      }

      reset();
      setItems([]);
      setSelectedGrnId('');
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating putaway:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Putaway</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-4">
            <div>
              <Label>GRN Reference (Optional)</Label>
              <Select value={selectedGrnId} onValueChange={setSelectedGrnId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select GRN" />
                </SelectTrigger>
                <SelectContent>
                  {grns.map((grn) => (
                    <SelectItem key={grn.id} value={grn.id}>
                      {grn.grn_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="putaway_date">Putaway Date</Label>
              <Input
                id="putaway_date"
                type="date"
                defaultValue={new Date().toISOString().split('T')[0]}
                {...register('putaway_date')}
              />
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Enter any notes about this putaway"
                {...register('notes')}
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-lg">Items to Putaway</Label>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </div>

            {items.map((item, index) => (
              <div key={index} className="border rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Item {index + 1}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeItem(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Warehouse Item</Label>
                    <Select
                      value={item.warehouse_item_id}
                      onValueChange={(value) => updateItem(index, 'warehouse_item_id', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select item" />
                      </SelectTrigger>
                      <SelectContent>
                        {warehouseItems.map((wItem) => (
                          <SelectItem key={wItem.id} value={wItem.id}>
                            {wItem.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Destination Bin</Label>
                    <Select
                      value={item.to_bin_id}
                      onValueChange={(value) => updateItem(index, 'to_bin_id', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select bin" />
                      </SelectTrigger>
                      <SelectContent>
                        {bins
                          .filter(bin => bin.status === 'active')
                          .map((bin) => (
                            <SelectItem key={bin.id} value={bin.id}>
                              {bin.bin_code} - {bin.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Quantity</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                    />
                  </div>

                  <div>
                    <Label>Notes</Label>
                    <Input
                      placeholder="Item notes"
                      value={item.notes || ''}
                      onChange={(e) => updateItem(index, 'notes', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            ))}

            {items.length === 0 && (
              <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                No items added yet. Click "Add Item" to get started.
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={items.length === 0}>
              Create Putaway
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
