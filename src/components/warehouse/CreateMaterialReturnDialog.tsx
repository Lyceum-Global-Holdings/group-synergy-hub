import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { useMaterialReturns } from "@/hooks/useMaterialReturns";
import { useMaterialReturnItems } from "@/hooks/useMaterialReturnItems";
import { ItemSelector } from "@/components/common/ItemSelector";
import { DualQuantityInput } from "@/components/warehouse/DualQuantityInput";
import { SrnNumberField } from "@/components/warehouse/SrnNumberField";
import { SrnDocumentUploadField } from "@/components/warehouse/SrnDocumentUploadField";
import { useCompany } from "@/contexts/CompanyContext";
import { useWarehouseItems } from "@/hooks/useWarehouseItems";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface ReturnItem {
  warehouse_item_id: string;
  item_code: string;
  item_name: string;
  quantity_returned: number;
  condition: 'good' | 'damaged' | 'expired';
  unit_cost: number;
  notes?: string;
  track_secondary_quantity?: boolean;
  secondary_uom?: string | null;
  secondary_quantity_returned?: number;
}

interface CreateMaterialReturnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  referenceId?: string;
  referenceType?: 'material_issue' | 'purchase_order' | 'other';
}

export function CreateMaterialReturnDialog({ 
  open, 
  onOpenChange,
  referenceId,
  referenceType = 'other'
}: CreateMaterialReturnDialogProps) {
  const { selectedCompany } = useCompany();
  const { createMaterialReturnAsync, isCreating } = useMaterialReturns();
  const { createItems } = useMaterialReturnItems();
  const { items: warehouseItemsList } = useWarehouseItems();

  const [returnDate, setReturnDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [returnedBy, setReturnedBy] = useState('');
  const [returnType, setReturnType] = useState<'internal' | 'supplier'>('internal');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [srnNumber, setSrnNumber] = useState('');
  const [srnDocumentTempPath, setSrnDocumentTempPath] = useState<string>('');
  const [items, setItems] = useState<ReturnItem[]>([]);


  const handleAddItem = () => {
    setItems([...items, {
      warehouse_item_id: '',
      item_code: '',
      item_name: '',
      quantity_returned: 0,
      condition: 'good',
      unit_cost: 0,
      notes: ''
    }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof ReturnItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleItemSelect = (index: number, itemId: string, itemCode: string, itemName: string, unitCost: number) => {
    const wi: any = warehouseItemsList.find((w: any) => w.id === itemId) || {};
    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      warehouse_item_id: itemId,
      item_code: itemCode,
      item_name: itemName,
      unit_cost: unitCost,
      track_secondary_quantity: !!wi.track_secondary_quantity,
      secondary_uom: wi.secondary_uom || null,
    };
    setItems(newItems);
  };

  const handleSubmit = async () => {
    if (!selectedCompany?.id || !returnedBy || !reason || items.length === 0) return;

    try {
      const newReturn = await createMaterialReturnAsync({
        return_date: returnDate,
        returned_by: returnedBy,
        return_type: returnType,
        reason,
        reference_type: referenceType,
        reference_id: referenceId || undefined,
        notes,
        company_id: selectedCompany.id,
        srn_number: srnNumber || undefined,
      });

      // Move SRN document from temp/ into the new MRN folder, then persist column.
      if (srnDocumentTempPath && newReturn?.id && selectedCompany?.id) {
        try {
          const ext = srnDocumentTempPath.split('.').pop() ?? 'bin';
          const finalPath = `${selectedCompany.id}/${newReturn.id}/srn_${Date.now()}.${ext}`;
          const { error: moveErr } = await supabase.storage
            .from('min-srn-documents')
            .move(srnDocumentTempPath, finalPath);
          const persistedPath = moveErr ? srnDocumentTempPath : finalPath;
          await supabase
            .from('material_return_notes')
            .update({ srn_document_url: persistedPath })
            .eq('id', newReturn.id);
        } catch (e) {
          console.error('Failed to attach SRN document to MRN', e);
        }
      }

      const returnItems = items.map((item) => ({
        mrn_id: newReturn.id,
        item_id: item.warehouse_item_id,
        quantity_returned: item.quantity_returned,
        condition: item.condition,
        unit_cost: item.unit_cost,
        total_cost: item.quantity_returned * item.unit_cost,
        notes: item.notes,
        secondary_quantity_returned: item.track_secondary_quantity
          ? (item.secondary_quantity_returned ?? null)
          : null,
        secondary_uom: item.track_secondary_quantity ? (item.secondary_uom ?? null) : null,
      }));

      await createItems(returnItems);

      setReturnDate(format(new Date(), 'yyyy-MM-dd'));
      setReturnedBy('');
      setReturnType('internal');
      setReason('');
      setNotes('');
      setSrnNumber('');
      setSrnDocumentTempPath('');
      setItems([]);
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating material return:', error);
    }
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Material Return Note</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="returnDate">Return Date</Label>
              <Input
                id="returnDate"
                type="date"
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="returnedBy">Returned By</Label>
              <Input
                id="returnedBy"
                value={returnedBy}
                onChange={(e) => setReturnedBy(e.target.value)}
                placeholder="Name of person returning"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="returnType">Return Type</Label>
              <Select value={returnType} onValueChange={(val: any) => setReturnType(val)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="internal">Internal</SelectItem>
                  <SelectItem value="supplier">Supplier</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <SrnNumberField value={srnNumber} onChange={setSrnNumber} />

          <div>
            <Label htmlFor="reason">Reason for Return *</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why are these items being returned?"
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes"
              rows={2}
            />
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label>Return Items</Label>
              <Button onClick={handleAddItem} size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </div>

            {items.map((item, index) => (
              <div key={index} className="border rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1 space-y-3">
                    <ItemSelector
                      value={item.warehouse_item_id}
                      onSelect={(selectedItem) => {
                        handleItemSelect(
                          index, 
                          selectedItem.id, 
                          selectedItem.item_code, 
                          selectedItem.name,
                          selectedItem.unit_cost || 0
                        );
                      }}
                    />
                    
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label>Quantity</Label>
                        <Input
                          type="number"
                          value={item.quantity_returned}
                          onChange={(e) => handleItemChange(index, 'quantity_returned', parseFloat(e.target.value) || 0)}
                          min="0"
                          step="0.01"
                        />
                      </div>
                      <div>
                        <Label>Condition</Label>
                        <Select 
                          value={item.condition} 
                          onValueChange={(val: any) => handleItemChange(index, 'condition', val)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="good">Good</SelectItem>
                            <SelectItem value="damaged">Damaged</SelectItem>
                            <SelectItem value="expired">Expired</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Unit Cost</Label>
                        <Input
                          type="number"
                          value={item.unit_cost}
                          onChange={(e) => handleItemChange(index, 'unit_cost', parseFloat(e.target.value) || 0)}
                          min="0"
                          step="0.01"
                        />
                      </div>
                    </div>

                    {item.track_secondary_quantity && (
                      <div className="rounded-md border bg-muted/30 p-3">
                        <DualQuantityInput
                          baseValue={String(item.quantity_returned ?? '')}
                          secondaryValue={String(item.secondary_quantity_returned ?? '')}
                          onBaseChange={(v) => handleItemChange(index, 'quantity_returned', parseFloat(v) || 0)}
                          onSecondaryChange={(v) => handleItemChange(index, 'secondary_quantity_returned', parseFloat(v) || 0)}
                          baseLabel="Qty returned"
                          secondaryLabel="Pieces returned"
                          secondaryUom={item.secondary_uom || 'pcs'}
                          required
                        />
                      </div>
                    )}

                    <div>
                      <Label>Notes</Label>
                      <Input
                        value={item.notes || ''}
                        onChange={(e) => handleItemChange(index, 'notes', e.target.value)}
                        placeholder="Item-specific notes"
                      />
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveItem(index)}
                    className="ml-2"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={isCreating || !returnedBy || !reason || items.length === 0}
            >
              Create Return
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
