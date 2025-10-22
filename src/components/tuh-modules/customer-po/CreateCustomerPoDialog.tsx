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
import { ProductMasterSelector } from "@/components/common/ProductMasterSelector";
import { ProductMaster } from "@/hooks/useProductMaster";
import { useFinishedGoods } from "@/hooks/useFinishedGoods";

const createCpoSchema = z.object({
  customer_id: z.string().min(1, "Customer is required"),
  company_id: z.string().optional(),
  cpo_number: z.string().optional(),
  po_date: z.string().optional(),
  delivery_date: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(z.object({
    product_master_id: z.string().optional(),
    finished_good_id: z.string().optional(),
    item_name: z.string().min(1, "Item name is required"),
    description: z.string().optional(),
    quantity_ordered: z.number().min(1, "Quantity must be at least 1"),
    unit_price: z.number().min(0, "Unit price must be positive"),
    total_price: z.number().min(0, "Total price must be positive"),
    delivery_date: z.string().optional(),
    color: z.string().optional(),
    size: z.string().optional(),
    style_no: z.string().optional(),
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
  const { products: finishedGoods } = useFinishedGoods(selectedCompany?.id);
  const [manualCpoNumber, setManualCpoNumber] = useState(false);
  const [itemOptions, setItemOptions] = useState<Record<number, {
    colors: string[];
    sizes: string[];
  }>>({});

  const form = useForm<CreateCpoFormData>({
    resolver: zodResolver(createCpoSchema),
    defaultValues: {
      customer_id: "",
      company_id: selectedCompany?.id || "",
      cpo_number: "",
      po_date: new Date().toISOString().split('T')[0],
      items: [
        {
          product_master_id: "",
          finished_good_id: "",
          item_name: "",
          quantity_ordered: 1,
          unit_price: 0,
          total_price: 0,
          style_no: "",
        }
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const watchedItems = form.watch("items");

  // Helper function to find matching finished good based on style, size, and color
  const findMatchingFinishedGood = (index: number) => {
    const item = form.getValues(`items.${index}`);
    const styleNo = item.style_no;
    const size = item.size;
    const color = item.color;
    
    if (!styleNo || !size || !color || !finishedGoods) return null;
    
    // Find matching finished good with normalized comparison (trim, case-insensitive)
    const match = finishedGoods.find(fg => 
      fg.style_no?.trim().toLowerCase() === styleNo.trim().toLowerCase() &&
      fg.size?.trim().toLowerCase() === size.trim().toLowerCase() &&
      fg.color?.trim().toLowerCase() === color.trim().toLowerCase()
    );
    
    return match || null;
  };
  
  // Auto-link finished good when attributes are complete
  const autoLinkFinishedGood = (index: number) => {
    const matchedFg = findMatchingFinishedGood(index);
    if (matchedFg) {
      form.setValue(`items.${index}.finished_good_id`, matchedFg.id);
      console.log(`✓ Auto-linked finished good: ${matchedFg.product_code} (${matchedFg.product_name})`);
    } else {
      form.setValue(`items.${index}.finished_good_id`, "");
      console.log(`⚠ No matching finished good found for style/size/color combination`);
    }
  };

  const calculateTotalPrice = (index: number) => {
    const quantity = form.getValues(`items.${index}.quantity_ordered`);
    const unitPrice = form.getValues(`items.${index}.unit_price`);
    const total = quantity * unitPrice;
    form.setValue(`items.${index}.total_price`, total);
  };

  const addItem = () => {
    append({
      product_master_id: "",
      finished_good_id: "",
      item_name: "",
      quantity_ordered: 1,
      unit_price: 0,
      total_price: 0,
      style_no: "",
    });
  };

  const handleProductMasterSelect = (index: number, productMaster: ProductMaster | null) => {
    if (productMaster) {
      form.setValue(`items.${index}.product_master_id`, productMaster.id);
      form.setValue(`items.${index}.item_name`, productMaster.product_name);
      form.setValue(`items.${index}.description`, productMaster.description || "");
      
      // Extract available colors and sizes from Product Master
      const colors: string[] = [];
      const sizes: string[] = [];
      
      if (productMaster.available_colors && Array.isArray(productMaster.available_colors)) {
        (productMaster.available_colors as any[]).forEach((c: any) => {
          if (typeof c === 'string') {
            colors.push(c);
          } else if (c && c.color_name) {
            colors.push(c.color_name);
          }
        });
      }
      
      if (productMaster.available_sizes && Array.isArray(productMaster.available_sizes)) {
        (productMaster.available_sizes as any[]).forEach((s: any) => {
          if (typeof s === 'string') {
            sizes.push(s);
          } else if (s && s.size_name) {
            sizes.push(s.size_name);
          }
        });
      }
      
      setItemOptions(prev => ({
        ...prev,
        [index]: { colors, sizes }
      }));
      
      // Auto-select if only one option
      if (colors.length === 1) form.setValue(`items.${index}.color`, colors[0]);
      if (sizes.length === 1) form.setValue(`items.${index}.size`, sizes[0]);
      
      // NEW: Capture style_no from product master for better matching
      if (productMaster.style_no) {
        form.setValue(`items.${index}.style_no`, productMaster.style_no);
      }
      
      // Recalculate total price
      setTimeout(() => calculateTotalPrice(index), 0);
    } else {
      form.setValue(`items.${index}.product_master_id`, "");
      form.setValue(`items.${index}.item_name`, "");
      form.setValue(`items.${index}.description`, "");
      form.setValue(`items.${index}.unit_price`, 0);
      form.setValue(`items.${index}.total_price`, 0);
      form.setValue(`items.${index}.color`, "");
      form.setValue(`items.${index}.size`, "");
      form.setValue(`items.${index}.style_no`, "");
      
      // Clear options
      setItemOptions(prev => {
        const newOptions = { ...prev };
        delete newOptions[index];
        return newOptions;
      });
    }
  };

  const onSubmit = async (data: CreateCpoFormData) => {
    try {
      const cleanedData: CreateCustomerPoData = {
        customer_id: data.customer_id,
        company_id: data.company_id || null,
        cpo_number: manualCpoNumber ? data.cpo_number : undefined,
        po_date: data.po_date,
        delivery_date: data.delivery_date,
        notes: data.notes,
        items: data.items.map(item => ({
          product_master_id: item.product_master_id || null,
          finished_good_id: item.finished_good_id || null,
          item_name: item.item_name,
          description: item.description,
          quantity_ordered: item.quantity_ordered,
          unit_price: item.unit_price,
          total_price: item.total_price,
          delivery_date: item.delivery_date,
          color: item.color,
          size: item.size,
          style_no: item.style_no,
        }))
      };
      
      await createCustomerPO.mutateAsync(cleanedData);
      form.reset();
      setManualCpoNumber(false);
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
            {/* Company and CPO Number Header */}
            <div className="bg-muted/50 p-4 rounded-lg border">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Company Information */}
                {!isViewingAllCompanies ? (
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Company</Label>
                    <div className="text-lg font-semibold">{selectedCompany?.name}</div>
                    <div className="text-sm text-muted-foreground">Code: {selectedCompany?.code}</div>
                  </div>
                ) : (
                  <FormField
                    control={form.control}
                    name="company_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select company" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {companies.map((company) => (
                              <SelectItem key={company.id} value={company.id}>
                                {company.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* CPO Number */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">CPO Number</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setManualCpoNumber(!manualCpoNumber)}
                      className="h-auto p-1 text-xs"
                    >
                      {manualCpoNumber ? "Auto-generate" : "Manual entry"}
                    </Button>
                  </div>
                  {manualCpoNumber ? (
                    <FormField
                      control={form.control}
                      name="cpo_number"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input 
                              {...field} 
                              placeholder="Enter CPO number"
                              className="font-mono"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ) : (
                    <div className="bg-background p-2 rounded border font-mono text-sm text-muted-foreground">
                      Will be auto-generated (CPO-YYYYMMDD-XXX)
                    </div>
                  )}
                </div>
              </div>
            </div>

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

                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name={`items.${index}.product_master_id`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Select Product Template *</FormLabel>
                            <FormControl>
                              <ProductMasterSelector
                                value={field.value}
                                onSelect={(productMaster) => handleProductMasterSelect(index, productMaster)}
                                placeholder="Select product template..."
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <FormField
                          control={form.control}
                          name={`items.${index}.item_name`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Item Name</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="Auto-filled from product template" 
                                  {...field} 
                                  readOnly
                                  className="bg-muted"
                                />
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
                                <Input 
                                  placeholder="Auto-filled from product template" 
                                  {...field} 
                                  readOnly
                                  className="bg-muted"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`items.${index}.style_no`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Style No.</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="Auto-filled from product template" 
                                  {...field} 
                                  readOnly
                                  className="bg-muted"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* Color and Size Selection */}
                      {itemOptions[index] && (itemOptions[index].colors.length > 0 || itemOptions[index].sizes.length > 0) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Color Selector */}
                           {itemOptions[index].colors.length > 0 && (
                            <FormField
                              control={form.control}
                              name={`items.${index}.color`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Color</FormLabel>
                                  <Select 
                                    onValueChange={(value) => {
                                      field.onChange(value);
                                      // Auto-link finished good after color selection
                                      setTimeout(() => autoLinkFinishedGood(index), 100);
                                    }} 
                                    value={field.value}
                                  >
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select color" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {itemOptions[index].colors.map((color) => (
                                        <SelectItem key={color} value={color}>
                                          {color}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          )}

                          {itemOptions[index].sizes.length > 0 && (
                            <FormField
                              control={form.control}
                              name={`items.${index}.size`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Size</FormLabel>
                                  <Select 
                                    onValueChange={(value) => {
                                      field.onChange(value);
                                      // Auto-link finished good after size selection
                                      setTimeout(() => autoLinkFinishedGood(index), 100);
                                    }} 
                                    value={field.value}
                                  >
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select size" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {itemOptions[index].sizes.map((size) => (
                                        <SelectItem key={size} value={size}>
                                          {size}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          )}
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                      </div>

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