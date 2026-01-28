import { useState } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useStockAdjustments } from '@/hooks/useStockAdjustments';
import { useStockTransactions } from '@/hooks/useStockTransactions';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2 } from 'lucide-react';
import { ItemSelector } from '@/components/common/ItemSelector';
import { useWarehouseItems } from '@/hooks/useWarehouseItems';

interface BulkAdjustmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface BulkItem {
  itemId: string;
  itemName: string;
  currentStock: number;
  adjustedQuantity: number;
  quantityChange: number;
  unitCost: number;
  valueImpact: number;
  notes: string;
}

export function BulkAdjustmentDialog({ open, onOpenChange }: BulkAdjustmentDialogProps) {
  const [step, setStep] = useState(1);
  const [adjustmentType, setAdjustmentType] = useState('physical_count');
  const [reasonCategory, setReasonCategory] = useState('other');
  const [adjustmentDate, setAdjustmentDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<BulkItem[]>([]);
  const [selectedItem, setSelectedItem] = useState('');

  const { createBatch, isCreating } = useStockAdjustments();
  const { createTransaction } = useStockTransactions();
  const { items: warehouseItems } = useWarehouseItems();

  const addItem = (itemId: string) => {
    if (!itemId || items.some(i => i.itemId === itemId)) return;
    
    const warehouseItem = warehouseItems?.find(i => i.id === itemId);
    
    setItems([...items, {
      itemId,
      itemName: warehouseItem?.name || 'Item Name',
      currentStock: warehouseItem?.current_stock || 0,
      adjustedQuantity: warehouseItem?.current_stock || 0,
      quantityChange: 0,
      unitCost: 0,
      valueImpact: 0,
      notes: '',
    }]);
    setSelectedItem('');
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof BulkItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    // Recalculate derived fields
    if (field === 'adjustedQuantity' || field === 'currentStock') {
      newItems[index].quantityChange = newItems[index].adjustedQuantity - newItems[index].currentStock;
      newItems[index].valueImpact = newItems[index].quantityChange * newItems[index].unitCost;
    }
    
    setItems(newItems);
  };

  const handleSubmit = async () => {
    if (items.length === 0) return;

    // Create batch
    createBatch({
      adjustment_date: adjustmentDate,
      adjustment_type: adjustmentType,
      reason_category: reasonCategory,
      notes,
    });

    // Note: In a real implementation, you'd create transactions linked to the batch
    // after the batch is created and get its ID
    
    onOpenChange(false);
    resetForm();
  };

  const resetForm = () => {
    setStep(1);
    setItems([]);
    setNotes('');
    setAdjustmentType('physical_count');
    setReasonCategory('other');
  };

  const totalItems = items.length;
  const totalValueImpact = items.reduce((sum, item) => sum + item.valueImpact, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-screen h-screen max-w-none max-h-none rounded-none p-6 overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Stock Adjustment - Step {step} of 3</DialogTitle>
          <DialogDescription>
            Create multiple stock adjustments in one batch
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="date">Adjustment Date</Label>
              <Input
                id="date"
                type="date"
                value={adjustmentDate}
                onChange={(e) => setAdjustmentDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Adjustment Type</Label>
              <Select value={adjustmentType} onValueChange={setAdjustmentType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="physical_count">Physical Count</SelectItem>
                  <SelectItem value="damage">Damage</SelectItem>
                  <SelectItem value="expiry">Expiry</SelectItem>
                  <SelectItem value="loss">Loss</SelectItem>
                  <SelectItem value="found">Found</SelectItem>
                  <SelectItem value="system_correction">System Correction</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Reason Category</Label>
              <Select value={reasonCategory} onValueChange={setReasonCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="shrinkage">Shrinkage</SelectItem>
                  <SelectItem value="obsolescence">Obsolescence</SelectItem>
                  <SelectItem value="quality_issue">Quality Issue</SelectItem>
                  <SelectItem value="system_error">System Error</SelectItem>
                  <SelectItem value="theft">Theft</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Overall Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="General notes for this batch adjustment"
                rows={3}
              />
            </div>

            <div className="flex justify-end">
              <Button onClick={() => setStep(2)}>Next: Add Items</Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Add Items</Label>
              <ItemSelector
                value={selectedItem}
                onSelect={(item) => {
                  if (typeof item === 'string') {
                    addItem(item);
                  } else {
                    addItem(item.id);
                  }
                }}
                placeholder="Search and add items..."
              />
            </div>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Current</TableHead>
                    <TableHead>Adjusted</TableHead>
                    <TableHead>Change</TableHead>
                    <TableHead>Unit Cost</TableHead>
                    <TableHead>Impact</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{item.itemName}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={item.currentStock}
                          onChange={(e) => updateItem(index, 'currentStock', parseFloat(e.target.value))}
                          className="w-20"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={item.adjustedQuantity}
                          onChange={(e) => updateItem(index, 'adjustedQuantity', parseFloat(e.target.value))}
                          className="w-20"
                        />
                      </TableCell>
                      <TableCell>
                        <span className={item.quantityChange >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {item.quantityChange >= 0 ? '+' : ''}{item.quantityChange}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={item.unitCost}
                          onChange={(e) => updateItem(index, 'unitCost', parseFloat(e.target.value))}
                          className="w-24"
                        />
                      </TableCell>
                      <TableCell>
                        <span className={item.valueImpact >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {item.valueImpact.toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={item.notes}
                          onChange={(e) => updateItem(index, 'notes', e.target.value)}
                          placeholder="Item notes"
                          className="w-32"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeItem(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {items.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                No items added yet. Use the search above to add items.
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={() => setStep(3)} disabled={items.length === 0}>
                Next: Review & Submit
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="font-medium">Total Items:</span>
                <span>{totalItems}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Total Value Impact:</span>
                <span className={totalValueImpact >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {totalValueImpact >= 0 ? '+' : ''}{totalValueImpact.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Adjustment Type:</span>
                <span>{adjustmentType.replace('_', ' ')}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Reason Category:</span>
                <span>{reasonCategory.replace('_', ' ')}</span>
              </div>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Current</TableHead>
                    <TableHead>New</TableHead>
                    <TableHead>Change</TableHead>
                    <TableHead>Value Impact</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{item.itemName}</TableCell>
                      <TableCell>{item.currentStock}</TableCell>
                      <TableCell>{item.adjustedQuantity}</TableCell>
                      <TableCell>
                        <span className={item.quantityChange >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {item.quantityChange >= 0 ? '+' : ''}{item.quantityChange}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={item.valueImpact >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {item.valueImpact.toFixed(2)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleSubmit} disabled={isCreating}>
                  Save as Draft
                </Button>
                <Button onClick={handleSubmit} disabled={isCreating}>
                  Submit for Approval
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
