import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Calendar, Plus, Trash2, Search, FileText } from 'lucide-react';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
    quantity_ordered: z.coerce.number().min(0),
    quantity_received: z.coerce.number().min(0, 'Quantity received cannot be negative'),
    unit_of_measure: z.string().min(1, 'Unit of measure is required'),
    unit_price: z.coerce.number().min(0).optional(),
    total_cost: z.coerce.number().min(0).optional(),
    quality_status: z.enum(['good', 'damaged', 'rejected'] as const),
    remarks: z.string().optional(),
  })).min(1, 'At least one item is required'),
});

type CreateGrnFormData = z.infer<typeof createGrnSchema>;

interface CreateGrnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedPo?: PurchaseOrder;
}

interface PurchaseOrder {
  id: string;
  po_number: string;
  status: string;
  po_date: string;
  expected_delivery_date?: string;
  supplier_id: string;
  supplier?: {
    name: string;
    address_line1?: string;
  };
  items?: Array<{
    id?: string;
    item_code?: string;
    item_name: string;
    description?: string;
    warehouse_item_id?: string;
    quantity_ordered: number;
    quantity_received: number;
    quantity_pending: number;
    unit_of_measure: string;
    unit_price: number;
  }>;
}

const qualityStatusOptions: { value: QualityStatus; label: string }[] = [
  { value: 'good', label: 'Good' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'rejected', label: 'Rejected' },
];

export function CreateGrnDialog({ open, onOpenChange, preselectedPo }: CreateGrnDialogProps) {
  const [showSupplierSearch, setShowSupplierSearch] = useState(false);
  const [selectedPoData, setSelectedPoData] = useState<PurchaseOrder | null>(null);
  const [submitError, setSubmitError] = useState<string>('');
  
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
        total_cost: 0,
      }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  const watchedItems = form.watch('items');
  const hasReceivingNow = (watchedItems || []).some((it) => (it?.quantity_received || 0) > 0);

  // Handle preselected PO
  useEffect(() => {
    if (preselectedPo && open) {
      handleSelectPo(preselectedPo);
    }
  }, [preselectedPo, open]);

  const calculateItemTotal = (index: number) => {
    const item = form.getValues(`items.${index}`);
    const total = (item.unit_price || 0) * item.quantity_received;
    form.setValue(`items.${index}.total_cost`, total);
  };

  const onSubmit = async (data: CreateGrnFormData) => {
    try {
      setSubmitError('');
      console.info('[CreateGRN] Submit started');

      // Filter items to only include those with quantity_received > 0
      const filteredItems = data.items
        .map(item => ({
          ...item,
          total_cost: item.total_cost ?? ((item.unit_price || 0) * (item.quantity_received || 0)),
        }))
        .filter(item => (item.quantity_received || 0) > 0);

      if (filteredItems.length === 0) {
        form.setError('items', {
          type: 'manual',
          message: 'Enter a "Receiving Now" quantity greater than 0 for at least one item.'
        });
        return;
      }

      const grnData: CreateGrnData = {
        ...data,
        po_id: data.po_id || undefined,
        po_number: data.po_number || undefined,
        pr_number: data.pr_number || undefined,
        mr_number: data.mr_number || undefined,
        supplier_id: data.supplier_id || undefined,
        supplier_name: data.supplier_name || '',
        grn_date: format(data.grn_date, 'yyyy-MM-dd'),
        invoice_date: data.invoice_date ? format(data.invoice_date, 'yyyy-MM-dd') : undefined,
        company_id: selectedCompany?.id,
        items: filteredItems.map(item => ({
          ...item,
          item_name: item.item_name || '',
          unit_of_measure: item.unit_of_measure || 'pcs',
          quantity_ordered: item.quantity_ordered || 0,
          quantity_received: item.quantity_received || 0,
          quality_status: item.quality_status || 'good',
          total_cost: item.total_cost,
        })),
      };

      console.info('[CreateGRN] Submitting GRN payload:', grnData);
      await createGrnMutation.mutateAsync(grnData);
      console.info('[CreateGRN] Submit successful');
      form.reset();
      onOpenChange(false);
    } catch (error) {
      console.error('[CreateGRN] Submit failed:', error);
      const errorMsg = (error as any)?.message || 'Failed to create GRN. Please try again.';
      setSubmitError(errorMsg);
    }
  };

  const handleSelectSupplier = (supplier: any) => {
    form.setValue('supplier_id', supplier.id);
    form.setValue('supplier_name', supplier.name);
    form.setValue('supplier_address', supplier.address_line1 || '');
    setShowSupplierSearch(false);
  };

  const handleSelectPo = (po: any) => {
    setSelectedPoData(po);
    form.setValue('po_id', po.id);
    form.setValue('po_number', po.po_number);
    form.setValue('supplier_id', po.supplier_id);
    form.setValue('supplier_name', po.supplier?.name || '');
    form.setValue('supplier_address', po.supplier?.address_line1 || '');
    
    // Auto-populate items from PO
    if (po.items && po.items.length > 0) {
      const poItems = po.items.map((item: any) => {
        const quantityPending = item.quantity_pending || ((item.quantity_ordered || 0) - (item.quantity_received || 0));
        const receivingQty = quantityPending > 0 ? quantityPending : 0;
        
        return {
          item_code: item.item_code || '',
          item_name: item.item_name || '',
          description: item.description || '',
          warehouse_item_id: item.warehouse_item_id,
          po_item_id: item.id,
          quantity_ordered: item.quantity_ordered || 0,
          quantity_received: receivingQty, // Default to pending quantity
          unit_of_measure: item.unit_of_measure || 'pcs',
          unit_price: item.unit_price || 0,
          total_cost: (item.unit_price || 0) * receivingQty,
          quality_status: 'good' as QualityStatus,
          remarks: '',
        };
      });
      form.setValue('items', poItems);
    }
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
                          className="p-3 pointer-events-auto"
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
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="po_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Purchase Order</FormLabel>
                    <Select 
                      onValueChange={(value) => {
                        field.onChange(value);
                        const selectedPo = purchaseOrders?.find(po => po.id === value);
                        if (selectedPo) {
                          handleSelectPo(selectedPo);
                        }
                      }} 
                      value={field.value || ""}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a purchase order" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {purchaseOrders
                          ?.filter(po => 
                            ['approved', 'sent', 'acknowledged', 'partially_received'].includes(po.status)
                          )
                          .filter(po => {
                            // Only show POs with pending items
                            const hasPendingItems = po.items?.some(item => {
                              const pending = (item.quantity_ordered || 0) - (item.quantity_received || 0);
                              return pending > 0;
                            });
                            return hasPendingItems;
                          })
                          .map((po) => {
                            // Calculate pending items count
                            const pendingItemsCount = po.items?.filter(item => {
                              const pending = (item.quantity_ordered || 0) - (item.quantity_received || 0);
                              return pending > 0;
                            }).length || 0;
                            
                            return (
                              <SelectItem key={po.id} value={po.id}>
                                <div className="flex flex-col gap-1">
                                  <div className="font-medium">{po.po_number}</div>
                                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                                    <span>{po.supplier?.name}</span>
                                    <span>•</span>
                                    <Badge variant="secondary" className="text-xs h-4 px-1">
                                      {pendingItemsCount} pending
                                    </Badge>
                                  </div>
                                </div>
                              </SelectItem>
                            );
                          })}
                      </SelectContent>
                    </Select>
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

            {/* PO Details Section - Show when PO is selected */}
            {form.watch('po_id') && selectedPoData && (
              <Card className="bg-blue-50 border-blue-200">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Purchase Order Details
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">PO Number</p>
                      <p className="font-semibold">{form.watch('po_number')}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Status</p>
                      <Badge>{selectedPoData.status}</Badge>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">PO Date</p>
                      <p>{format(new Date(selectedPoData.po_date), 'MMM dd, yyyy')}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Expected Delivery</p>
                      <p>{selectedPoData.expected_delivery_date ? format(new Date(selectedPoData.expected_delivery_date), 'MMM dd, yyyy') : '-'}</p>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-blue-300">
                    <p className="text-sm text-blue-800">✓ Supplier locked from PO</p>
                  </div>
                </CardContent>
              </Card>
            )}

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
                          <Input 
                            placeholder="Supplier name" 
                            {...field} 
                            disabled={!!form.watch('po_id')}
                          />
                        </FormControl>
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="icon"
                          onClick={() => setShowSupplierSearch(true)}
                          disabled={!!form.watch('po_id')}
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
              
              {!form.watch('po_id') && (
                <p className="text-xs text-muted-foreground">
                  Manual entry: you can enter "Receiving Now" directly — Quantity Ordered will auto-adjust if it's lower.
                </p>
              )}

              {form.formState.isSubmitted && !hasReceivingNow && (
                <p className="text-sm text-destructive">
                  Enter a 'Receiving Now' quantity greater than 0 for at least one item.
                </p>
              )}

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item Code</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-center">
                        <div className="flex flex-col items-center">
                          <span>Qty Ordered</span>
                          <span className="text-xs font-normal text-muted-foreground">(From PO)</span>
                        </div>
                      </TableHead>
                      <TableHead className="text-center">
                        <div className="flex flex-col items-center">
                          <span>Already Received</span>
                          <span className="text-xs font-normal text-muted-foreground">(Previous GRNs)</span>
                        </div>
                      </TableHead>
                      <TableHead className="text-center">
                        <div className="flex flex-col items-center">
                          <span className="text-orange-600">Pending</span>
                          <span className="text-xs font-normal text-muted-foreground">(To Receive)</span>
                        </div>
                      </TableHead>
                      <TableHead className="text-center">
                        <div className="flex flex-col items-center">
                          <span>Receiving Now *</span>
                          <span className="text-xs font-normal text-muted-foreground">(This GRN)</span>
                        </div>
                      </TableHead>
                      <TableHead>Quality Status</TableHead>
                      <TableHead>UOM</TableHead>
                      <TableHead>Unit Price</TableHead>
                      <TableHead>Total Cost</TableHead>
                      <TableHead>Remarks</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fields.map((field, index) => {
                      const item = form.watch(`items.${index}`);
                      const quantityOrdered = item?.quantity_ordered || 0;
                      const alreadyReceived = selectedPoData?.items?.[index]?.quantity_received || 0;
                      const pending = quantityOrdered - alreadyReceived;
                      
                      return (
                        <TableRow key={field.id}>
                          <TableCell>
                            <FormField
                              control={form.control}
                              name={`items.${index}.item_code`}
                              render={({ field }) => (
                                <Input placeholder="Item code" className="w-28" {...field} />
                              )}
                            />
                          </TableCell>
                          <TableCell>
                            <FormField
                              control={form.control}
                              name={`items.${index}.item_name`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Input placeholder="Item name" className="w-40" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
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
                                  className="w-24"
                                  disabled={!!selectedPoData}
                                  {...field}
                                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                />
                              )}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="w-24 text-center text-muted-foreground">
                              {alreadyReceived}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="w-24 text-center font-semibold text-orange-600">
                              {pending}
                            </div>
                          </TableCell>
                          <TableCell>
                            <FormField
                              control={form.control}
                              name={`items.${index}.quantity_received`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Input 
                                      type="number" 
                                      className="w-24"
                                      max={selectedPoData ? pending : undefined}
                                      {...field}
                                      onChange={(e) => {
                                        const raw = parseFloat(e.target.value);
                                        const parsed = Number.isFinite(raw) ? raw : 0;
                                        let nextQty = Math.max(0, parsed);

                                        if (selectedPoData) {
                                          // Only clamp to pending when a PO is selected
                                          nextQty = Math.max(0, Math.min(pending, parsed));
                                        } else {
                                          // Manual mode: auto-sync Quantity Ordered if too low
                                          const ordered = form.getValues(`items.${index}.quantity_ordered`) || 0;
                                          if (nextQty > ordered) {
                                            form.setValue(`items.${index}.quantity_ordered`, nextQty);
                                          }
                                        }

                                        field.onChange(nextQty);

                                        // Recalculate total_cost
                                        const unitPrice = form.getValues(`items.${index}.unit_price`) || 0;
                                        form.setValue(`items.${index}.total_cost`, unitPrice * nextQty);
                                      }}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </TableCell>
                          <TableCell>
                            <FormField
                              control={form.control}
                              name={`items.${index}.quality_status`}
                              render={({ field }) => (
                                <Select value={field.value} onValueChange={field.onChange}>
                                  <SelectTrigger className="w-28">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {qualityStatusOptions.map((option) => (
                                      <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            />
                          </TableCell>
                          <TableCell>
                            <FormField
                              control={form.control}
                              name={`items.${index}.unit_of_measure`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Input placeholder="UOM" className="w-20" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </TableCell>
                          <TableCell>
                            <FormField
                              control={form.control}
                              name={`items.${index}.unit_price`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Input 
                                      type="number" 
                                      step="0.01"
                                      className="w-28"
                                      {...field}
                                      onChange={(e) => {
                                        field.onChange(parseFloat(e.target.value) || 0);
                                        calculateItemTotal(index);
                                      }}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
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
                                  className="w-28"
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
                                <Input placeholder="Remarks" className="w-32" {...field} />
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
                      );
                    })}
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

            <DialogFooter className="flex-col gap-2">
              {submitError && (
                <p className="text-sm text-destructive text-left w-full">{submitError}</p>
              )}
              <div className="flex gap-2 w-full justify-end">
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
              </div>
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

      </DialogContent>
    </Dialog>
  );
}