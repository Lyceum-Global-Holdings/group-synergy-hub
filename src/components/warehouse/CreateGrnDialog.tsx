import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Plus, Trash2 } from 'lucide-react';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useCompany } from '@/contexts/CompanyContext';
import { usePurchaseOrders } from '@/hooks/usePurchaseOrders';
import { useCreateGoodsReceiptNote } from '@/hooks/useGoodsReceiptNotes';
import { CreateGrnItemData, QualityStatus } from '@/types/grn';
import { format } from 'date-fns';

const formSchema = z.object({
  grn_date: z.string(),
  po_id: z.string().optional(),
  supplier_name: z.string().optional(),
  supplier_address: z.string().optional(),
  invoice_number: z.string().optional(),
  invoice_date: z.string().optional(),
  remarks: z.string().optional(),
});

interface CreateGrnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  poId?: string;
}

export function CreateGrnDialog({ open, onOpenChange, poId }: CreateGrnDialogProps) {
  const { selectedCompany } = useCompany();
  const { data: pos = [] } = usePurchaseOrders();
  const createGrn = useCreateGoodsReceiptNote();

  const [items, setItems] = useState<CreateGrnItemData[]>([]);
  const [selectedPoId, setSelectedPoId] = useState<string>(poId || '');

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      grn_date: format(new Date(), 'yyyy-MM-dd'),
      po_id: poId || '',
    },
  });

  // Filter POs that are approved or sent and have pending quantities
  const availablePOs = pos.filter(
    (po) => (po.status === 'approved' || po.status === 'sent') && po.items?.length
  );

  // Load PO items when PO is selected
  useEffect(() => {
    if (selectedPoId) {
      const selectedPo = pos.find((po) => po.id === selectedPoId);
      if (selectedPo) {
        form.setValue('supplier_name', selectedPo.supplier?.name || '');
        form.setValue('supplier_address', 'Address not available');

        const poItems: CreateGrnItemData[] =
          selectedPo.items?.map((item: any) => ({
            po_item_id: item.id,
            warehouse_item_id: item.warehouse_item_id,
            item_code: item.item_code,
            item_name: item.item_name,
            description: item.description,
            unit_of_measure: item.unit_of_measure,
            quantity_ordered: item.quantity_ordered,
            quantity_received: 0,
            unit_price: item.unit_price,
            total_cost: 0,
            quality_status: 'good' as QualityStatus,
          })) || [];

        setItems(poItems);
      }
    }
  }, [selectedPoId, pos, form]);

  const handleAddManualItem = () => {
    setItems([
      ...items,
      {
        item_name: '',
        unit_of_measure: 'pcs',
        quantity_received: 0,
        unit_price: 0,
        total_cost: 0,
        quality_status: 'good',
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (
    index: number,
    field: keyof CreateGrnItemData,
    value: any
  ) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };

    // Auto-calculate total cost
    if (field === 'quantity_received' || field === 'unit_price') {
      const qty = field === 'quantity_received' ? value : newItems[index].quantity_received;
      const price = field === 'unit_price' ? value : newItems[index].unit_price;
      newItems[index].total_cost = qty * price;
    }

    setItems(newItems);
  };

  const handleSubmit = async (status: 'draft' | 'submitted') => {
    const values = form.getValues();

    // Filter items with quantity > 0
    const validItems = items.filter((item) => item.quantity_received > 0);

    if (validItems.length === 0) {
      alert('Please add at least one item with quantity received > 0');
      return;
    }

    await createGrn.mutateAsync({
      grn_date: values.grn_date || format(new Date(), 'yyyy-MM-dd'),
      po_id: selectedPoId || undefined,
      po_number: pos.find((po) => po.id === selectedPoId)?.po_number,
      supplier_name: values.supplier_name,
      supplier_address: values.supplier_address,
      invoice_number: values.invoice_number || undefined,
      invoice_date: values.invoice_date || undefined,
      remarks: values.remarks || undefined,
      status,
      company_id: selectedCompany?.id,
      items: validItems,
    });

    onOpenChange(false);
    form.reset();
    setItems([]);
    setSelectedPoId('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Goods Receipt Note</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Header Information */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>GRN Date</Label>
              <Input
                type="date"
                {...form.register('grn_date')}
              />
            </div>

            <div>
              <Label>Select Purchase Order (Optional)</Label>
              <Select value={selectedPoId} onValueChange={setSelectedPoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select PO or create manual GRN" />
                </SelectTrigger>
                <SelectContent>
                  {availablePOs.map((po) => (
                    <SelectItem key={po.id} value={po.id}>
                      {po.po_number} - {po.supplier?.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!selectedPoId && (
              <>
                <div>
                  <Label>Supplier Name</Label>
                  <Input {...form.register('supplier_name')} />
                </div>
                <div>
                  <Label>Supplier Address</Label>
                  <Input {...form.register('supplier_address')} />
                </div>
              </>
            )}

            <div>
              <Label>Invoice Number (Optional)</Label>
              <Input {...form.register('invoice_number')} />
            </div>

            <div>
              <Label>Invoice Date (Optional)</Label>
              <Input type="date" {...form.register('invoice_date')} />
            </div>
          </div>

          {/* Items Table */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <Label>Items</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddManualItem}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item Name</TableHead>
                  <TableHead>UOM</TableHead>
                  <TableHead>Qty Ordered</TableHead>
                  <TableHead>Qty Receiving</TableHead>
                  <TableHead>Unit Price</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Quality</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      {item.po_item_id ? (
                        item.item_name
                      ) : (
                        <Input
                          value={item.item_name}
                          onChange={(e) =>
                            handleItemChange(index, 'item_name', e.target.value)
                          }
                          placeholder="Item name"
                        />
                      )}
                    </TableCell>
                    <TableCell>{item.unit_of_measure}</TableCell>
                    <TableCell>{item.quantity_ordered || '-'}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={item.quantity_received}
                        onChange={(e) =>
                          handleItemChange(
                            index,
                            'quantity_received',
                            parseFloat(e.target.value) || 0
                          )
                        }
                        className="w-24"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={item.unit_price}
                        onChange={(e) =>
                          handleItemChange(
                            index,
                            'unit_price',
                            parseFloat(e.target.value) || 0
                          )
                        }
                        className="w-24"
                        disabled={!!item.po_item_id}
                      />
                    </TableCell>
                    <TableCell>{item.total_cost.toFixed(2)}</TableCell>
                    <TableCell>
                      <Select
                        value={item.quality_status}
                        onValueChange={(value) =>
                          handleItemChange(index, 'quality_status', value)
                        }
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="good">Good</SelectItem>
                          <SelectItem value="damaged">Damaged</SelectItem>
                          <SelectItem value="rejected">Rejected</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveItem(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Remarks */}
          <div>
            <Label>Remarks</Label>
            <Textarea {...form.register('remarks')} />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleSubmit('draft')}
              disabled={createGrn.isPending}
            >
              Save as Draft
            </Button>
            <Button
              type="button"
              onClick={() => handleSubmit('submitted')}
              disabled={createGrn.isPending}
            >
              Submit for Approval
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
