import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { CalendarIcon, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCreatePurchaseOrder } from "@/hooks/usePurchaseOrders";
import { usePurchaseRequisitions } from "@/hooks/usePurchaseRequisitions";
import { useSuppliers } from "@/hooks/useSuppliers";
import { useCompanyContext } from "@/contexts/CompanyContext";
import { CreatePoData } from "@/types/purchaseOrder";
import { cn } from "@/lib/utils";

const createPoSchema = z.object({
  pr_id: z.string().optional(),
  supplier_id: z.string().min(1, "Supplier is required"),
  expected_delivery_date: z.string().optional(),
  payment_terms: z.string().optional(),
  delivery_terms: z.string().optional(),
  currency: z.string().default("USD"),
  buyer_id: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(z.object({
    pr_item_id: z.string().optional(),
    item_name: z.string().min(1, "Item name is required"),
    description: z.string().optional(),
    specifications: z.string().optional(),
    quantity_ordered: z.number().min(0.01, "Quantity must be greater than 0"),
    unit_price: z.number().min(0.01, "Unit price must be greater than 0"),
    total_price: z.number().min(0.01, "Total price must be greater than 0"),
    unit_of_measure: z.string().min(1, "Unit of measure is required"),
    delivery_date: z.string().optional(),
    notes: z.string().optional(),
  })).min(1, "At least one item is required"),
});

type CreatePoFormData = z.infer<typeof createPoSchema>;

interface CreatePoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prId?: string;
}

const currencies = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD'];

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

export function CreatePoDialog({ open, onOpenChange, prId }: CreatePoDialogProps) {
  const [selectedPrId, setSelectedPrId] = useState(prId);
  
  const { data: suppliers = [] } = useSuppliers();
  const { data: purchaseRequisitions = [] } = usePurchaseRequisitions();
  const createPoMutation = useCreatePurchaseOrder();
  const { selectedCompany } = useCompanyContext();

  // Filter approved PRs
  const approvedPRs = purchaseRequisitions.filter(pr => pr.status === 'approved');
  const selectedPR = approvedPRs.find(pr => pr.id === selectedPrId);

  const form = useForm<CreatePoFormData>({
    resolver: zodResolver(createPoSchema),
    defaultValues: {
      pr_id: prId,
      supplier_id: "",
      currency: "USD",
      items: [
        {
          item_name: "",
          quantity_ordered: 1,
          unit_price: 0,
          total_price: 0,
          unit_of_measure: "pcs",
        }
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  // Load PR items when PR is selected
  const handlePrChange = (prId: string) => {
    setSelectedPrId(prId);
    const pr = approvedPRs.find(p => p.id === prId);
    if (pr && pr.items) {
      form.setValue("pr_id", prId);
      form.setValue("items", pr.items.map(item => ({
        pr_item_id: item.id,
        item_name: item.item_name,
        description: item.description,
        specifications: item.specifications,
        quantity_ordered: item.quantity,
        unit_price: item.estimated_unit_price,
        total_price: item.estimated_total_price,
        unit_of_measure: item.unit_of_measure,
        notes: item.notes,
      })));
    }
  };

  const calculateTotalPrice = (index: number) => {
    const quantity = form.watch(`items.${index}.quantity_ordered`);
    const unitPrice = form.watch(`items.${index}.unit_price`);
    const totalPrice = quantity * unitPrice;
    form.setValue(`items.${index}.total_price`, totalPrice);
  };

  const addItem = () => {
    append({
      item_name: "",
      quantity_ordered: 1,
      unit_price: 0,
      total_price: 0,
      unit_of_measure: "pcs",
    });
  };

  const onSubmit = async (data: CreatePoFormData) => {
    try {
      const poData = {
        ...data,
        company_id: selectedCompany?.id
      };
      await createPoMutation.mutateAsync(poData as CreatePoData);
      form.reset();
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating PO:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Purchase Order</DialogTitle>
          <DialogDescription>
            Create a new purchase order from scratch or convert an approved purchase requisition.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* PO Header Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Purchase Order Details</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* PR Selection */}
                <FormField
                  control={form.control}
                  name="pr_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Purchase Requisition (Optional)</FormLabel>
                      <Select onValueChange={handlePrChange} value={selectedPrId}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select approved PR" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {approvedPRs.map((pr) => (
                            <SelectItem key={pr.id} value={pr.id}>
                              {pr.pr_number} - {pr.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Supplier Selection */}
                <FormField
                  control={form.control}
                  name="supplier_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Supplier *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select supplier" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {suppliers.map((supplier) => (
                            <SelectItem key={supplier.id} value={supplier.id}>
                              {supplier.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Expected Delivery Date */}
                <FormField
                  control={form.control}
                  name="expected_delivery_date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Expected Delivery Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(new Date(field.value), "PPP")
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
                            selected={field.value ? new Date(field.value) : undefined}
                            onSelect={(date) => field.onChange(date?.toISOString().split('T')[0])}
                            disabled={(date) => date < new Date()}
                            initialFocus
                            className="pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Currency */}
                <FormField
                  control={form.control}
                  name="currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Currency</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {currencies.map((currency) => (
                            <SelectItem key={currency} value={currency}>
                              {currency}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Payment Terms */}
                <FormField
                  control={form.control}
                  name="payment_terms"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Terms</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Net 30" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Delivery Terms */}
                <FormField
                  control={form.control}
                  name="delivery_terms"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Delivery Terms</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., FOB Destination" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* PO Items */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Items</CardTitle>
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {fields.map((field, index) => (
                    <Card key={field.id}>
                      <CardContent className="pt-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <FormField
                            control={form.control}
                            name={`items.${index}.item_name`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Item Name *</FormLabel>
                                <FormControl>
                                  <Input {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name={`items.${index}.quantity_ordered`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Quantity *</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    {...field}
                                    onChange={(e) => {
                                      field.onChange(Number(e.target.value));
                                      calculateTotalPrice(index);
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
                                <FormLabel>Unit *</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
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

                          <FormField
                            control={form.control}
                            name={`items.${index}.unit_price`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Unit Price *</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    {...field}
                                    onChange={(e) => {
                                      field.onChange(Number(e.target.value));
                                      calculateTotalPrice(index);
                                    }}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name={`items.${index}.total_price`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Total Price</FormLabel>
                                <FormControl>
                                  <Input {...field} readOnly className="bg-muted" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <div className="flex items-end">
                            {fields.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => remove(index)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>

                          <div className="md:col-span-3">
                            <FormField
                              control={form.control}
                              name={`items.${index}.specifications`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Specifications</FormLabel>
                                  <FormControl>
                                    <Textarea {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Additional notes or instructions..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createPoMutation.isPending}>
                {createPoMutation.isPending ? "Creating..." : "Create Purchase Order"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}