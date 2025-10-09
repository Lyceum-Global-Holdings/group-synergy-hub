import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, X } from "lucide-react";
import { useSuppliers } from "@/hooks/useSuppliers";
import { useCreateBlanketPurchaseOrder } from "@/hooks/useBlanketPurchaseOrders";
import { useWarehouseItems } from "@/hooks/useWarehouseItems";
import { ItemSelector } from "@/components/common/ItemSelector";

const createBpoSchema = z.object({
  contract_type: z.enum(["blanket_po", "contract_po", "framework_agreement"]),
  supplier_id: z.string().min(1, "Supplier is required"),
  contract_start_date: z.string().min(1, "Start date is required"),
  contract_end_date: z.string().min(1, "End date is required"),
  total_contract_value: z.number().min(0, "Total value must be positive"),
  payment_terms: z.string().optional(),
  delivery_terms: z.string().optional(),
  currency: z.string().default("LKR"),
  auto_renew: z.boolean().default(false),
  notes: z.string().optional(),
  items: z.array(z.object({
    warehouse_item_id: z.string().optional(),
    item_name: z.string().min(1, "Item name is required"),
    item_code: z.string().optional(),
    description: z.string().optional(),
    unit_price: z.number().min(0, "Unit price must be positive"),
    min_order_quantity: z.number().optional(),
    max_order_quantity: z.number().optional(),
    total_quantity_limit: z.number().optional(),
    unit_of_measure: z.string().default("pcs"),
    lead_time_days: z.number().default(0),
  })).min(1, "At least one item is required"),
});

type CreateBpoFormData = z.infer<typeof createBpoSchema>;

interface CreateBlanketPoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateBlanketPoDialog({ open, onOpenChange }: CreateBlanketPoDialogProps) {
  const [activeTab, setActiveTab] = useState("header");
  const { data: suppliers = [] } = useSuppliers();
  const { items: warehouseItems = [] } = useWarehouseItems();
  const createBpo = useCreateBlanketPurchaseOrder();

  const form = useForm<CreateBpoFormData>({
    resolver: zodResolver(createBpoSchema),
    defaultValues: {
      contract_type: "blanket_po",
      currency: "LKR",
      auto_renew: false,
      items: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const onSubmit = (data: CreateBpoFormData) => {
    createBpo.mutate(data as any, {
      onSuccess: () => {
        form.reset();
        onOpenChange(false);
      },
    });
  };

  const addItem = () => {
    append({
      item_name: "",
      unit_price: 0,
      unit_of_measure: "pcs",
      lead_time_days: 0,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Blanket Purchase Order</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="header">Contract Details</TabsTrigger>
                <TabsTrigger value="items">Items & Pricing</TabsTrigger>
                <TabsTrigger value="terms">Terms & Conditions</TabsTrigger>
              </TabsList>

              <TabsContent value="header" className="space-y-4">
                <FormField
                  control={form.control}
                  name="contract_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contract Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="blanket_po">Blanket PO</SelectItem>
                          <SelectItem value="contract_po">Contract PO</SelectItem>
                          <SelectItem value="framework_agreement">Framework Agreement</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="supplier_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Supplier</FormLabel>
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

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="contract_start_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="contract_end_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="total_contract_value"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Total Contract Value</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value="items" className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Contract Items</h3>
                  <Button type="button" onClick={addItem} variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Item
                  </Button>
                </div>

                {fields.map((field, index) => (
                  <Card key={field.id} className="p-4">
                    <div className="space-y-4">
                      <div className="flex justify-between items-start">
                        <h4 className="font-medium">Item {index + 1}</h4>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => remove(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>

                      <FormField
                        control={form.control}
                        name={`items.${index}.item_name`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Item Name</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name={`items.${index}.unit_price`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Unit Price</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  step="0.01"
                                  {...field}
                                  onChange={(e) => field.onChange(parseFloat(e.target.value))}
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
                              <FormLabel>Unit</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <FormField
                          control={form.control}
                          name={`items.${index}.min_order_quantity`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Min Qty</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  {...field}
                                  onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`items.${index}.max_order_quantity`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Max Qty</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  {...field}
                                  onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`items.${index}.total_quantity_limit`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Total Limit</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  {...field}
                                  onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  </Card>
                ))}

                {fields.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No items added. Click "Add Item" to start.
                  </div>
                )}
              </TabsContent>

              <TabsContent value="terms" className="space-y-4">
                <FormField
                  control={form.control}
                  name="payment_terms"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Terms</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Net 30 days" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="delivery_terms"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Delivery Terms</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="FOB, delivery within 7 days" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createBpo.isPending}>
                {createBpo.isPending ? "Creating..." : "Create Blanket PO"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
