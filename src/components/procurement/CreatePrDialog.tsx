import React, { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { CalendarIcon, Plus, Trash2 } from 'lucide-react';
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
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
              <CardContent className="space-y-4">
                {fields.map((field, index) => (
                  <Card key={field.id} className="p-4">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="font-medium">Item {index + 1}</h4>
                      {fields.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => remove(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      {/* Show different selectors based on company */}
                      {selectedCompany?.code === 'TUH' ? (
                        <>
                          <FormField
                            control={form.control}
                            name={`items.${index}.warehouse_item_id`}
                            render={({ field }) => (
                              <FormItem className="md:col-span-1">
                                <FormLabel>Select from Warehouse Items</FormLabel>
                                <FormControl>
                                  <ItemSelector
                                    value={field.value}
                                    onSelect={(item) => handleItemSelect(index, item)}
                                    placeholder="Search warehouse items..."
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <div className="md:col-span-1 flex items-center justify-center">
                            <span className="text-sm text-muted-foreground">OR</span>
                          </div>
                          
                          <FormField
                            control={form.control}
                            name={`items.${index}.finished_good_id`}
                            render={({ field }) => (
                              <FormItem className="md:col-span-1">
                                <FormLabel>Select from Product Master</FormLabel>
                                <FormControl>
                                  <FinishedGoodsItemSelector
                                    value={field.value}
                                    onSelect={(product) => handleFinishedGoodSelect(index, product)}
                                    placeholder="Search finished goods..."
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </>
                      ) : (
                        <FormField
                          control={form.control}
                          name={`items.${index}.warehouse_item_id`}
                          render={({ field }) => (
                            <FormItem className="md:col-span-3">
                              <FormLabel>Select Item *</FormLabel>
                              <FormControl>
                                <ItemSelector
                                  value={field.value}
                                  onSelect={(item) => handleItemSelect(index, item)}
                                  placeholder="Search and select item..."
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                      
                      {(form.watch(`items.${index}.warehouse_item_id`) || form.watch(`items.${index}.finished_good_id`)) && (
                        <div className="md:col-span-3 text-sm text-muted-foreground bg-muted/50 p-2 rounded">
                          <strong>Selected:</strong> {form.watch(`items.${index}.item_code`)} - {form.watch(`items.${index}.item_name`)}
                          {form.watch(`items.${index}.finished_good_id`) && (
                            <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                              From Product Master
                            </span>
                          )}
                        </div>
                      )}

                      <FormField
                        control={form.control}
                        name={`items.${index}.item_code`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Item Code</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter item code" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`items.${index}.item_name`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Item Name *</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter item name" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`items.${index}.quantity`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Quantity *</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                {...field}
                                onChange={(e) => {
                                  field.onChange(parseFloat(e.target.value) || 0);
                                  setTimeout(() => calculateTotalPrice(index), 0);
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`items.${index}.unit_of_measure`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Unit of Measure *</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
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
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <FormField
                        control={form.control}
                        name={`items.${index}.estimated_unit_price`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Unit Price *</FormLabel>
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
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`items.${index}.estimated_total_price`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Total Price</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                {...field}
                                readOnly
                                className="bg-muted"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div /> {/* Spacer */}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name={`items.${index}.specifications`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Specifications</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Enter specifications"
                                className="resize-none"
                                rows={2}
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`items.${index}.notes`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Notes</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Enter additional notes"
                                className="resize-none"
                                rows={2}
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </Card>
                ))}
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