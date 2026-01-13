import React, { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { CalendarIcon, Plus, Trash2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table';
import { useCreatePurchaseRequisition } from '@/hooks/usePurchaseRequisitions';
import { useBillOfMaterials } from '@/hooks/useBillOfMaterials';
import { useCompany } from '@/contexts/CompanyContext';
import { cn } from '@/lib/utils';
import type { CreatePrData, PrPriority } from '@/types/procurement';
import { ItemSelector } from '@/components/common/ItemSelector';
import { FinishedGoodsItemSelector } from '@/components/common/FinishedGoodsItemSelector';
import { WarehouseItem } from '@/types/itemBin';
import { FinishedGood } from '@/hooks/useFinishedGoods';

const createPrSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  company: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  required_date: z.date({
    required_error: 'Required date is required',
  }).refine((date) => date >= new Date(new Date().setHours(0, 0, 0, 0)), {
    message: 'Required date cannot be in the past',
  }),
  justification: z.string().optional(),
  bom_id: z.string().optional(),
  items: z.array(z.object({
    warehouse_item_id: z.string().nullable().optional(),
    finished_good_id: z.string().nullable().optional(),
    item_code: z.string().optional(),
    item_name: z.string().min(1, 'Item name is required'),
    description: z.string().optional(),
    quantity: z.number().min(0.01, 'Quantity must be greater than 0'),
    unit_of_measure: z.string().min(1, 'Unit of measure is required'),
    estimated_unit_price: z.number().min(0, 'Unit price must be non-negative'),
    estimated_total_price: z.number().min(0, 'Total price must be non-negative'),
    specifications: z.string().optional(),
    notes: z.string().optional(),
  })).min(1, 'At least one item is required'),
});

type CreatePrFormData = z.infer<typeof createPrSchema>;

interface CreatePrDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}


const unitsOfMeasure = [
  // Quantity
  'pcs', 'boxes', 'sets', 'dozen', 'pack', 'roll', 'sheet', 'bundle', 'case', 'pallet',
  
  // Weight
  'kg', 'lbs', 'tons', 'g', 'oz',
  
  // Length
  'meters', 'feet', 'yards', 'inches', 'cm', 'mm', 'km', 'miles',
  
  // Volume
  'liters', 'gallons', 'ml', 'cubic meters', 'cubic feet',
  
  // Area
  'sq meters', 'sq feet', 'sq yards', 'sq inches',
  
  // Time
  'hours', 'days', 'weeks', 'months'
];

export function CreatePrDialog({ open, onOpenChange }: CreatePrDialogProps) {
  const createPrMutation = useCreatePurchaseRequisition();
  const { selectedCompany } = useCompany();
  const { boms } = useBillOfMaterials(selectedCompany?.id);
  
  const form = useForm<CreatePrFormData>({
    resolver: zodResolver(createPrSchema),
    defaultValues: {
      title: '',
      description: '',
      company: selectedCompany?.name || '',
      priority: 'medium',
      justification: '',
      bom_id: '',
      items: [
        {
          warehouse_item_id: null,
          finished_good_id: null,
          item_name: '',
          description: '',
          quantity: 1,
          unit_of_measure: 'pcs',
          estimated_unit_price: 0,
          estimated_total_price: 0,
          specifications: '',
          notes: '',
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  const calculateTotalPrice = (index: number) => {
    const quantity = form.watch(`items.${index}.quantity`);
    const unitPrice = form.watch(`items.${index}.estimated_unit_price`);
    const total = quantity * unitPrice;
    form.setValue(`items.${index}.estimated_total_price`, total);
  };

  const onSubmit = async (data: CreatePrFormData) => {
    const createData: CreatePrData = {
      title: data.title,
      description: data.description,
      department: data.company,
      priority: data.priority,
      required_date: format(data.required_date, 'yyyy-MM-dd'),
      justification: data.justification,
      bom_id: data.bom_id || undefined,
      company_id: selectedCompany?.id, // Auto-capture company ID
      items: data.items.map(item => ({
        warehouse_item_id: item.warehouse_item_id || null,
        finished_good_id: item.finished_good_id || null,
        item_code: item.item_code,
        item_name: item.item_name,
        description: item.description,
        quantity: item.quantity,
        unit_of_measure: item.unit_of_measure,
        estimated_unit_price: item.estimated_unit_price,
        estimated_total_price: item.estimated_total_price,
        specifications: item.specifications,
        notes: item.notes,
      })),
    };

    try {
      await createPrMutation.mutateAsync(createData);
      form.reset();
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating PR:', error);
    }
  };

  const addItem = () => {
    append({
      warehouse_item_id: null,
      finished_good_id: null,
      item_code: '',
      item_name: '',
      description: '',
      quantity: 1,
      unit_of_measure: 'pcs',
      estimated_unit_price: 0,
      estimated_total_price: 0,
      specifications: '',
      notes: '',
    });
  };

  const handleItemSelect = (index: number, item: WarehouseItem | null) => {
    if (item) {
      form.setValue(`items.${index}.warehouse_item_id`, item.id);
      form.setValue(`items.${index}.finished_good_id`, null);
      form.setValue(`items.${index}.item_code`, item.item_code);
      form.setValue(`items.${index}.item_name`, item.name);
      form.setValue(`items.${index}.description`, item.description || '');
      form.setValue(`items.${index}.unit_of_measure`, 'pcs'); // Default, user can change
      form.setValue(`items.${index}.estimated_unit_price`, item.unit_cost || 0);
      setTimeout(() => calculateTotalPrice(index), 0);
    } else {
      form.setValue(`items.${index}.warehouse_item_id`, null);
      form.setValue(`items.${index}.finished_good_id`, null);
      form.setValue(`items.${index}.item_code`, '');
      form.setValue(`items.${index}.item_name`, '');
      form.setValue(`items.${index}.description`, '');
    }
  };

  const handleFinishedGoodSelect = (index: number, product: FinishedGood | null) => {
    if (product) {
      form.setValue(`items.${index}.warehouse_item_id`, null);
      form.setValue(`items.${index}.finished_good_id`, product.id);
      form.setValue(`items.${index}.item_code`, product.product_code);
      form.setValue(`items.${index}.item_name`, product.product_name);
      form.setValue(`items.${index}.description`, product.description || '');
      form.setValue(`items.${index}.unit_of_measure`, product.unit_of_measure);
      form.setValue(`items.${index}.estimated_unit_price`, product.selling_price || product.standard_cost || 0);
      setTimeout(() => calculateTotalPrice(index), 0);
    } else {
      form.setValue(`items.${index}.warehouse_item_id`, null);
      form.setValue(`items.${index}.finished_good_id`, null);
      form.setValue(`items.${index}.item_code`, '');
      form.setValue(`items.${index}.item_name`, '');
      form.setValue(`items.${index}.description`, '');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-full max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Purchase Requisition</DialogTitle>
          <DialogDescription>
            Create a new purchase requisition for approval.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Title *</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter PR title" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="company"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            value={selectedCompany?.name || ''} 
                            readOnly 
                            className="bg-muted"
                            placeholder="No company selected"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Priority *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select priority" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="urgent">Urgent</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="required_date"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Required Date *</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={'outline'}
                                className={cn(
                                  'pl-3 text-left font-normal',
                                  !field.value && 'text-muted-foreground'
                                )}
                              >
                                {field.value ? (
                                  format(field.value, 'PPP')
                                ) : (
                                  <span>Pick a date</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              disabled={(date) =>
                                date < new Date(new Date().setHours(0, 0, 0, 0))
                              }
                              initialFocus
                              className={cn("p-3 pointer-events-auto")}
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Enter PR description"
                          className="resize-none"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="justification"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Justification</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Provide justification for this purchase"
                          className="resize-none"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Explain why this purchase is necessary for business operations.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Items */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <CardTitle className="text-lg">Items</CardTitle>
                <Button type="button" onClick={addItem} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">#</TableHead>
                        <TableHead className="min-w-[180px]">Item</TableHead>
                        <TableHead className="w-[100px]">Code</TableHead>
                        <TableHead className="min-w-[140px]">Name *</TableHead>
                        <TableHead className="w-[80px]">Qty *</TableHead>
                        <TableHead className="w-[100px]">UoM *</TableHead>
                        <TableHead className="w-[100px]">Unit Price</TableHead>
                        <TableHead className="w-[100px]">Total</TableHead>
                        <TableHead className="w-[80px]">Notes</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fields.map((field, index) => (
                        <TableRow key={field.id}>
                          {/* Row number */}
                          <TableCell className="font-medium text-muted-foreground">
                            {index + 1}
                          </TableCell>

                          {/* Item Selector */}
                          <TableCell>
                            {selectedCompany?.code === 'TUH' ? (
                              <div className="space-y-1">
                                <ItemSelector
                                  value={form.watch(`items.${index}.warehouse_item_id`)}
                                  onSelect={(item) => handleItemSelect(index, item)}
                                  placeholder="Warehouse..."
                                  className="h-8"
                                />
                                <FinishedGoodsItemSelector
                                  value={form.watch(`items.${index}.finished_good_id`)}
                                  onSelect={(product) => handleFinishedGoodSelect(index, product)}
                                  placeholder="Product..."
                                  className="h-8"
                                />
                              </div>
                            ) : (
                              <ItemSelector
                                value={form.watch(`items.${index}.warehouse_item_id`)}
                                onSelect={(item) => handleItemSelect(index, item)}
                                placeholder="Select item..."
                                className="h-8"
                              />
                            )}
                          </TableCell>

                          {/* Item Code */}
                          <TableCell>
                            <FormField
                              control={form.control}
                              name={`items.${index}.item_code`}
                              render={({ field }) => (
                                <FormItem className="space-y-0">
                                  <FormControl>
                                    <Input 
                                      placeholder="Code" 
                                      {...field} 
                                      className="h-8 text-sm"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </TableCell>

                          {/* Item Name */}
                          <TableCell>
                            <FormField
                              control={form.control}
                              name={`items.${index}.item_name`}
                              render={({ field }) => (
                                <FormItem className="space-y-0">
                                  <FormControl>
                                    <Input 
                                      placeholder="Item name" 
                                      {...field} 
                                      className="h-8 text-sm"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </TableCell>

                          {/* Quantity */}
                          <TableCell>
                            <FormField
                              control={form.control}
                              name={`items.${index}.quantity`}
                              render={({ field }) => (
                                <FormItem className="space-y-0">
                                  <FormControl>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      {...field}
                                      onChange={(e) => {
                                        field.onChange(parseFloat(e.target.value) || 0);
                                        setTimeout(() => calculateTotalPrice(index), 0);
                                      }}
                                      className="h-8 text-sm"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </TableCell>

                          {/* Unit of Measure */}
                          <TableCell>
                            <FormField
                              control={form.control}
                              name={`items.${index}.unit_of_measure`}
                              render={({ field }) => (
                                <FormItem className="space-y-0">
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                      <SelectTrigger className="h-8 text-sm">
                                        <SelectValue />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {unitsOfMeasure.map((unit) => (
                                        <SelectItem key={unit} value={unit}>
                                          {unit}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </FormItem>
                              )}
                            />
                          </TableCell>

                          {/* Unit Price */}
                          <TableCell>
                            <FormField
                              control={form.control}
                              name={`items.${index}.estimated_unit_price`}
                              render={({ field }) => (
                                <FormItem className="space-y-0">
                                  <FormControl>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      placeholder="0.00"
                                      {...field}
                                      onChange={(e) => {
                                        field.onChange(parseFloat(e.target.value) || 0);
                                        setTimeout(() => calculateTotalPrice(index), 0);
                                      }}
                                      className="h-8 text-sm"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </TableCell>

                          {/* Total Price */}
                          <TableCell>
                            <FormField
                              control={form.control}
                              name={`items.${index}.estimated_total_price`}
                              render={({ field }) => (
                                <FormItem className="space-y-0">
                                  <FormControl>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      placeholder="0.00"
                                      {...field}
                                      readOnly
                                      className="h-8 text-sm bg-muted"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </TableCell>

                          {/* Notes with Popover */}
                          <TableCell>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className={cn(
                                    "h-8 w-8 p-0",
                                    (form.watch(`items.${index}.notes`) || form.watch(`items.${index}.specifications`)) && "text-primary"
                                  )}
                                >
                                  <FileText className="h-4 w-4" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-80" align="end">
                                <div className="space-y-4">
                                  <div className="space-y-2">
                                    <Label>Specifications</Label>
                                    <Textarea
                                      placeholder="Enter specifications..."
                                      rows={2}
                                      value={form.watch(`items.${index}.specifications`) || ''}
                                      onChange={(e) => form.setValue(`items.${index}.specifications`, e.target.value)}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Notes</Label>
                                    <Textarea
                                      placeholder="Enter notes..."
                                      rows={2}
                                      value={form.watch(`items.${index}.notes`) || ''}
                                      onChange={(e) => form.setValue(`items.${index}.notes`, e.target.value)}
                                    />
                                  </div>
                                </div>
                              </PopoverContent>
                            </Popover>
                          </TableCell>

                          {/* Delete */}
                          <TableCell>
                            {fields.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => remove(index)}
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow>
                        <TableCell colSpan={7} className="text-right font-medium">
                          Total Estimated Amount:
                        </TableCell>
                        <TableCell className="font-bold">
                          {fields.reduce((sum, _, index) => 
                            sum + (form.watch(`items.${index}.estimated_total_price`) || 0), 0
                          ).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell colSpan={2}></TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createPrMutation.isPending}>
                {createPrMutation.isPending ? 'Creating...' : 'Create PR'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}