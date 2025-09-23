import React, { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Calendar, Plus, Trash2, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { useCreateGoodsReceiptNote } from '@/hooks/useGoodsReceiptNotes';
import { useSuppliers } from '@/hooks/useSuppliers';
import { usePurchaseOrders } from '@/hooks/usePurchaseOrders';
import { useWarehouseItems } from '@/hooks/useWarehouseItems';
import { useCompany } from '@/contexts/CompanyContext';
import { CreateGrnData, QualityStatus } from '@/types/grn';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const createGrnSchema = z.object({
  grn_date: z.date(),
  invoice_number: z.string().optional(),
  invoice_date: z.date().optional(),
  po_id: z.string().optional(),
  po_number: z.string().optional(),
  pr_number: z.string().optional(),
  mr_number: z.string().optional(),
  supplier_id: z.string().optional(),
  supplier_name: z.string().min(1, 'Supplier name is required'),
  supplier_address: z.string().optional(),
  branch: z.string().optional(),
  remarks: z.string().optional(),
  items: z.array(z.object({
    item_code: z.string().optional(),
    item_name: z.string().min(1, 'Item name is required'),
    description: z.string().optional(),
    warehouse_item_id: z.string().optional(),
    po_item_id: z.string().optional(),
    quantity_ordered: z.number().min(0),
    quantity_received: z.number().min(0, 'Quantity received must be positive'),
    unit_of_measure: z.string().min(1, 'Unit of measure is required'),
    unit_price: z.number().min(0).optional(),
    total_cost: z.number().min(0).optional(),
    quality_status: z.enum(['good', 'damaged', 'rejected'] as const),
    remarks: z.string().optional(),
  })).min(1, 'At least one item is required'),
});

type CreateGrnFormData = z.infer<typeof createGrnSchema>;

interface CreateGrnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const qualityStatusOptions: { value: QualityStatus; label: string }[] = [
  { value: 'good', label: 'Good' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'rejected', label: 'Rejected' },
];

export function CreateGrnDialog({ open, onOpenChange }: CreateGrnDialogProps) {
  const [showSupplierSearch, setShowSupplierSearch] = useState(false);
  const [showPoSearch, setShowPoSearch] = useState(false);
  
  const { selectedCompany } = useCompany();
  const { data: suppliers = [] } = useSuppliers();
  const { data: purchaseOrders = [] } = usePurchaseOrders();
  const { items: warehouseItems } = useWarehouseItems();
  const createGrnMutation = useCreateGoodsReceiptNote();

  const form = useForm<CreateGrnFormData>({
    resolver: zodResolver(createGrnSchema),
    defaultValues: {
      grn_date: new Date(),
      supplier_name: '',
      items: [{
        item_name: '',
        quantity_ordered: 0,
        quantity_received: 0,
        unit_of_measure: 'pcs',
        quality_status: 'good',
      }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  const calculateItemTotal = (index: number) => {
    const item = form.getValues(`items.${index}`);
    const total = (item.unit_price || 0) * item.quantity_received;
    form.setValue(`items.${index}.total_cost`, total);
  };

  const onSubmit = async (data: CreateGrnFormData) => {
    try {
      const grnData: CreateGrnData = {
        ...data,
        supplier_name: data.supplier_name || '',
        grn_date: format(data.grn_date, 'yyyy-MM-dd'),
        invoice_date: data.invoice_date ? format(data.invoice_date, 'yyyy-MM-dd') : undefined,
        company_id: selectedCompany?.id,
        items: data.items.map(item => ({
          ...item,
          item_name: item.item_name || '',
          unit_of_measure: item.unit_of_measure || 'pcs',
          quantity_ordered: item.quantity_ordered || 0,
          quantity_received: item.quantity_received || 0,
          quality_status: item.quality_status || 'good',
          total_cost: item.total_cost || ((item.unit_price || 0) * item.quantity_received),
        })),
      };

      await createGrnMutation.mutateAsync(grnData);
      form.reset();
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating GRN:', error);
    }
  };

  const handleSelectSupplier = (supplier: any) => {
    form.setValue('supplier_id', supplier.id);
    form.setValue('supplier_name', supplier.name);
    form.setValue('supplier_address', supplier.address_line1 || '');
    setShowSupplierSearch(false);
  };

  const handleSelectPo = (po: any) => {
    form.setValue('po_id', po.id);
    form.setValue('po_number', po.po_number);
    form.setValue('supplier_id', po.supplier_id);
    form.setValue('supplier_name', po.supplier?.name || '');
    form.setValue('supplier_address', po.supplier?.address_line1 || '');
    
    // Auto-populate items from PO
    if (po.items && po.items.length > 0) {
      const poItems = po.items.map((item: any) => ({
        item_code: item.item_code || '',
        item_name: item.item_name || '',
        description: item.description || '',
        warehouse_item_id: item.warehouse_item_id,
        po_item_id: item.id,
        quantity_ordered: item.quantity_ordered || 0,
        quantity_received: 0,
        unit_of_measure: item.unit_of_measure || 'pcs',
        unit_price: item.unit_price || 0,
        total_cost: 0,
        quality_status: 'good' as QualityStatus,
        remarks: '',
      }));
      form.setValue('items', poItems);
    }
    
    setShowPoSearch(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Goods Receipt Note</DialogTitle>
          <DialogDescription>
            Record goods received from suppliers
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Header Information */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="grn_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>GRN Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <Calendar className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="branch"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Branch</FormLabel>
                    <FormControl>
                      <Input placeholder="Branch" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="invoice_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Invoice Number</FormLabel>
                    <FormControl>
                      <Input placeholder="Invoice number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="invoice_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Invoice Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <Calendar className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="po_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>P.O. Number</FormLabel>
                    <div className="flex gap-2">
                      <FormControl>
                        <Input placeholder="P.O. number" {...field} />
                      </FormControl>
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="icon"
                        onClick={() => setShowPoSearch(true)}
                      >
                        <Search className="w-4 h-4" />
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="pr_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>P.R. Number</FormLabel>
                    <FormControl>
                      <Input placeholder="P.R. number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Supplier Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Supplier Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="supplier_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Supplier Name</FormLabel>
                      <div className="flex gap-2">
                        <FormControl>
                          <Input placeholder="Supplier name" {...field} />
                        </FormControl>
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="icon"
                          onClick={() => setShowSupplierSearch(true)}
                        >
                          <Search className="w-4 h-4" />
                        </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="supplier_address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Supplier Address</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Supplier address" 
                          className="min-h-[80px]"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Items Table */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Items</h3>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => append({
                    item_name: '',
                    quantity_ordered: 0,
                    quantity_received: 0,
                    unit_of_measure: 'pcs',
                    quality_status: 'good',
                  })}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Item
                </Button>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item Code</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Qty Ordered</TableHead>
                      <TableHead>Qty Received</TableHead>
                      <TableHead>UOM</TableHead>
                      <TableHead>Unit Price</TableHead>
                      <TableHead>Total Cost</TableHead>
                      <TableHead>Remarks</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fields.map((field, index) => (
                      <TableRow key={field.id}>
                        <TableCell>
                          <FormField
                            control={form.control}
                            name={`items.${index}.item_code`}
                            render={({ field }) => (
                              <Input placeholder="Item code" {...field} />
                            )}
                          />
                        </TableCell>
                        <TableCell>
                          <FormField
                            control={form.control}
                            name={`items.${index}.item_name`}
                            render={({ field }) => (
                              <Input placeholder="Item name" {...field} />
                            )}
                          />
                        </TableCell>
                        <TableCell>
                          <FormField
                            control={form.control}
                            name={`items.${index}.quantity_ordered`}
                            render={({ field }) => (
                              <Input 
                                type="number" 
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                              />
                            )}
                          />
                        </TableCell>
                        <TableCell>
                          <FormField
                            control={form.control}
                            name={`items.${index}.quantity_received`}
                            render={({ field }) => (
                              <Input 
                                type="number" 
                                {...field}
                                onChange={(e) => {
                                  field.onChange(parseFloat(e.target.value) || 0);
                                  calculateItemTotal(index);
                                }}
                              />
                            )}
                          />
                        </TableCell>
                        <TableCell>
                          <FormField
                            control={form.control}
                            name={`items.${index}.unit_of_measure`}
                            render={({ field }) => (
                              <Input placeholder="UOM" {...field} />
                            )}
                          />
                        </TableCell>
                        <TableCell>
                          <FormField
                            control={form.control}
                            name={`items.${index}.unit_price`}
                            render={({ field }) => (
                              <Input 
                                type="number" 
                                step="0.01"
                                {...field}
                                onChange={(e) => {
                                  field.onChange(parseFloat(e.target.value) || 0);
                                  calculateItemTotal(index);
                                }}
                              />
                            )}
                          />
                        </TableCell>
                        <TableCell>
                          <FormField
                            control={form.control}
                            name={`items.${index}.total_cost`}
                            render={({ field }) => (
                              <Input 
                                type="number" 
                                step="0.01"
                                readOnly
                                {...field}
                              />
                            )}
                          />
                        </TableCell>
                        <TableCell>
                          <FormField
                            control={form.control}
                            name={`items.${index}.remarks`}
                            render={({ field }) => (
                              <Input placeholder="Remarks" {...field} />
                            )}
                          />
                        </TableCell>
                        <TableCell>
                          {fields.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => remove(index)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Remarks */}
            <FormField
              control={form.control}
              name="remarks"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Remarks</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Additional remarks" 
                      className="min-h-[80px]"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createGrnMutation.isPending}
              >
                {createGrnMutation.isPending ? 'Creating...' : 'Create GRN'}
              </Button>
            </DialogFooter>
          </form>
        </Form>

        {/* Search Dialogs */}
        {showSupplierSearch && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold mb-4">Select Supplier</h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {suppliers.map((supplier) => (
                  <div
                    key={supplier.id}
                    className="p-2 hover:bg-gray-100 cursor-pointer rounded"
                    onClick={() => handleSelectSupplier(supplier)}
                  >
                    <div className="font-medium">{supplier.name}</div>
                    <div className="text-sm text-gray-500">{supplier.supplier_code}</div>
                  </div>
                ))}
              </div>
              <div className="flex justify-end mt-4">
                <Button 
                  variant="outline" 
                  onClick={() => setShowSupplierSearch(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        {showPoSearch && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold mb-4">Select Purchase Order</h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {purchaseOrders.filter(po => po.status === 'sent').map((po) => (
                  <div
                    key={po.id}
                    className="p-2 hover:bg-gray-100 cursor-pointer rounded"
                    onClick={() => handleSelectPo(po)}
                  >
                    <div className="font-medium">{po.po_number}</div>
                    <div className="text-sm text-gray-500">
                      {po.supplier?.name} - LKR {po.final_amount?.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-end mt-4">
                <Button 
                  variant="outline" 
                  onClick={() => setShowPoSearch(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}