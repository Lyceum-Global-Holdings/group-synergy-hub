import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCustomers } from "@/hooks/useCustomers";
import { useCustomerPurchaseOrders } from "@/hooks/useCustomerPurchaseOrders";
import { useCompany } from "@/contexts/CompanyContext";
import { CreateCustomerPoData } from "@/types/customer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const createCpoSchema = z.object({
  customer_id: z.string().min(1, "Customer is required"),
  company_id: z.string().optional(),
  po_date: z.string().optional(),
  delivery_date: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(z.object({
    item_name: z.string().min(1, "Item name is required"),
    description: z.string().optional(),
    quantity_ordered: z.number().min(1, "Quantity must be at least 1"),
    unit_price: z.number().min(0, "Unit price must be positive"),
    total_price: z.number().min(0, "Total price must be positive"),
    delivery_date: z.string().optional(),
  })).min(1, "At least one item is required"),
});

type CreateCpoFormData = z.infer<typeof createCpoSchema>;

interface CreateCustomerPoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CreateCustomerPoDialog({
  open,
  onOpenChange,
}: CreateCustomerPoDialogProps) {
  const { selectedCompany, isViewingAllCompanies, companies } = useCompany();
  const { customers } = useCustomers();
  const { createCustomerPO } = useCustomerPurchaseOrders();

  const form = useForm<CreateCpoFormData>({
    resolver: zodResolver(createCpoSchema),
    defaultValues: {
      customer_id: "",
      company_id: selectedCompany?.id || "",
      po_date: new Date().toISOString().split('T')[0],
      items: [
        {
          item_name: "",
          quantity_ordered: 1,
          unit_price: 0,
          total_price: 0,
        }
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const watchedItems = form.watch("items");

  const calculateTotalPrice = (index: number) => {
    const quantity = form.getValues(`items.${index}.quantity_ordered`);
    const unitPrice = form.getValues(`items.${index}.unit_price`);
    const total = quantity * unitPrice;
    form.setValue(`items.${index}.total_price`, total);
  };

  const addItem = () => {
    append({
      item_name: "",
      quantity_ordered: 1,
      unit_price: 0,
      total_price: 0,
    });
  };

  const onSubmit = async (data: CreateCpoFormData) => {
    try {
      const cleanedData: CreateCustomerPoData = {
        customer_id: data.customer_id,
        company_id: data.company_id || null,
        po_date: data.po_date,
        delivery_date: data.delivery_date,
        notes: data.notes,
        items: data.items.map(item => ({
          finished_good_id: null, // TODO: Add finished goods selector
          item_name: item.item_name,
          description: item.description,
          quantity_ordered: item.quantity_ordered,
          unit_price: item.unit_price,
          total_price: item.total_price,
          delivery_date: item.delivery_date,
        }))
      };
      
      await createCustomerPO.mutateAsync(cleanedData);
      form.reset();
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to create customer PO:', error);
    }
  };

  const totalAmount = watchedItems.reduce((sum, item) => sum + (item.total_price || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Customer Purchase Order</DialogTitle>
          <DialogDescription>
            Create a new customer purchase order with items and delivery details.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="customer_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select customer" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {customers.map((customer) => (
                          <SelectItem key={customer.id} value={customer.id}>
                            {customer.customer_name} ({customer.customer_code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {isViewingAllCompanies && (
                <FormField
                  control={form.control}
                  name="company_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select company" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {companies.map((company) => (
                            <SelectItem key={company.id} value={company.id}>
                              {company.name} ({company.code})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="po_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>PO Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="delivery_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Delivery Date</FormLabel>
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
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Additional notes..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Card>
              <CardHeader>
                <CardTitle className="flex justify-between items-center">
                  Items
                  <Button type="button" onClick={addItem} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Item
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {fields.map((field, index) => (
                  <div key={field.id} className="border rounded-lg p-4 space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="font-medium">Item {index + 1}</h4>
                      {fields.length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => remove(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                        name={`items.${index}.description`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                              <Input placeholder="Item description" {...field} />
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
                                min="1"
                                {...field}
                                onChange={(e) => {
                                  field.onChange(parseInt(e.target.value) || 0);
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
                        name={`items.${index}.unit_price`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Unit Price *</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
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
                        name={`items.${index}.total_price`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Total Price</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                readOnly
                                {...field}
                                className="bg-muted"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`items.${index}.delivery_date`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Delivery Date</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                ))}

                <div className="flex justify-between items-center pt-4 border-t">
                  <span className="text-lg font-semibold">
                    Total Amount: LKR {totalAmount.toFixed(2)}
                  </span>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createCustomerPO.isPending}
              >
                {createCustomerPO.isPending ? "Creating..." : "Create Customer PO"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}