import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AssetMasterSelector } from "@/components/common/AssetMasterSelector";
import { useAssetRequests } from "@/hooks/useAssetRequests";
import { useAssetMaster } from "@/hooks/useAssetMaster";
import { useAssetCategories } from "@/hooks/useAssetCategories";
import { AssetMaster } from "@/types/assetMaster";
import { CreateAssetRequestItemData } from "@/types/assetRequest";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const requestFormSchema = z.object({
  requester_name: z.string().min(1, "Name is required"),
  department: z.string().optional(),
  contact_number: z.string().optional(),
  purpose: z.string().min(10, "Purpose must be at least 10 characters"),
  justification: z.string().optional(),
  required_date: z.string().min(1, "Required date is required"),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  notes: z.string().optional(),
});

const itemFormSchema = z.object({
  asset_master_id: z.string().optional(),
  item_name: z.string().min(1, "Item name is required"),
  item_description: z.string().optional(),
  brand: z.string().optional(),
  category_id: z.string().optional(),
  quantity_requested: z.number().min(1, "Quantity must be at least 1"),
  unit_price_estimate: z.number().optional(),
  specifications: z.string().optional(),
  justification: z.string().optional(),
  preferred_vendor: z.string().optional(),
});

interface CreateAssetRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateAssetRequestDialog({
  open,
  onOpenChange,
}: CreateAssetRequestDialogProps) {
  const [step, setStep] = useState(1);
  const [items, setItems] = useState<CreateAssetRequestItemData[]>([]);
  const [itemType, setItemType] = useState<"from_master" | "new_item">("from_master");
  const [selectedAssetMaster, setSelectedAssetMaster] = useState<AssetMaster | null>(null);

  const { createAssetRequest, createAssetRequestItem, submitAssetRequest } = useAssetRequests();
  const { assetMasterItems } = useAssetMaster();
  const { mainCategories } = useAssetCategories();

  const requestForm = useForm({
    resolver: zodResolver(requestFormSchema),
    defaultValues: {
      requester_name: "",
      department: "",
      contact_number: "",
      purpose: "",
      justification: "",
      required_date: new Date().toISOString().split('T')[0],
      priority: "medium" as const,
      notes: "",
    },
  });

  const itemForm = useForm({
    resolver: zodResolver(itemFormSchema),
    defaultValues: {
      asset_master_id: "",
      item_name: "",
      item_description: "",
      brand: "",
      category_id: "",
      quantity_requested: 1,
      unit_price_estimate: 0,
      specifications: "",
      justification: "",
      preferred_vendor: "",
    },
  });

  const handleAssetMasterSelect = (asset: AssetMaster | null) => {
    setSelectedAssetMaster(asset);
    if (asset) {
      itemForm.setValue("item_name", asset.asset_name);
      itemForm.setValue("brand", asset.brand || "");
      itemForm.setValue("category_id", asset.category_id || "");
      itemForm.setValue("unit_price_estimate", 0);
      itemForm.setValue("item_description", asset.description || "");
    }
  };

  const handleAddItem = (data: z.infer<typeof itemFormSchema>) => {
    const newItem: CreateAssetRequestItemData = {
      request_id: "", // Will be set when creating
      request_type: itemType,
      asset_master_id: itemType === "from_master" ? data.asset_master_id : undefined,
      item_name: data.item_name,
      item_description: data.item_description,
      brand: data.brand,
      category_id: data.category_id,
      quantity_requested: itemType === "from_master" ? 1 : data.quantity_requested,
      unit_price_estimate: itemType === "from_master" ? 0 : data.unit_price_estimate,
      total_price_estimate: itemType === "from_master" ? 0 : (data.unit_price_estimate || 0) * data.quantity_requested,
      specifications: data.specifications,
      justification: data.justification,
      preferred_vendor: data.preferred_vendor,
    };

    setItems([...items, newItem]);
    itemForm.reset();
    setSelectedAssetMaster(null);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    const requestData = requestForm.getValues();
    
    createAssetRequest(
      {
        ...requestData,
        request_date: new Date().toISOString().split('T')[0],
      },
      {
        onSuccess: (newRequest) => {
          // Add all items
          items.forEach((item) => {
            createAssetRequestItem({
              ...item,
              request_id: newRequest.id,
            });
          });

          // Submit request for approval
          submitAssetRequest(newRequest.id);

          // Reset and close
          requestForm.reset();
          setItems([]);
          setStep(1);
          onOpenChange(false);
        },
      }
    );
  };

  const totalEstimate = items.reduce(
    (sum, item) => sum + (item.total_price_estimate || 0),
    0
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Asset Request</DialogTitle>
          <DialogDescription>
            Request assets from Asset Master or specify new items
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <Form {...requestForm}>
            <form className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={requestForm.control}
                  name="requester_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Requester Name *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Your name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={requestForm.control}
                  name="department"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Department</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Department name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={requestForm.control}
                  name="contact_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Number</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Phone number" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={requestForm.control}
                  name="required_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Required Date *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={requestForm.control}
                name="purpose"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Purpose *</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Why do you need these assets?"
                        rows={3}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={requestForm.control}
                name="justification"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Business Justification</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Business case for this request"
                        rows={2}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={requestForm.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
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

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  onClick={() => {
                    requestForm.handleSubmit(() => setStep(2))();
                  }}
                >
                  Next: Add Items
                </Button>
              </div>
            </form>
          </Form>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <Tabs value={itemType} onValueChange={(v) => setItemType(v as any)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="from_master">From Asset Master</TabsTrigger>
                <TabsTrigger value="new_item">New Item</TabsTrigger>
              </TabsList>

              <TabsContent value="from_master" className="space-y-4 mt-4">
                <Form {...itemForm}>
                  <form className="space-y-4">
                    <FormField
                      control={itemForm.control}
                      name="asset_master_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Select Asset</FormLabel>
                          <FormControl>
                            <AssetMasterSelector
                              value={field.value}
                              onValueChange={field.onChange}
                              onAssetSelected={handleAssetMasterSelect}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {selectedAssetMaster && (
                      <Card>
                        <CardContent className="pt-4">
                          <div className="flex gap-3">
                            {selectedAssetMaster.image_url && (
                              <img
                                src={selectedAssetMaster.image_url}
                                alt={selectedAssetMaster.asset_name}
                                className="h-16 w-16 rounded object-cover"
                              />
                            )}
                            <div className="flex-1">
                              <p className="font-medium">{selectedAssetMaster.asset_name}</p>
                              {selectedAssetMaster.brand && (
                                <p className="text-sm text-muted-foreground">
                                  Brand: {selectedAssetMaster.brand}
                                </p>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    <div className="space-y-4">
                      <div className="text-sm text-muted-foreground p-3 bg-muted/50 rounded-md">
                        Quantity and pricing will be determined during the approval process
                      </div>

                      <FormField
                        control={itemForm.control}
                        name="justification"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Justification</FormLabel>
                            <FormControl>
                              <Textarea {...field} placeholder="Why do you need this asset?" rows={2} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <Button
                      type="button"
                      onClick={itemForm.handleSubmit(handleAddItem)}
                      variant="outline"
                      className="w-full"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Item
                    </Button>
                  </form>
                </Form>
              </TabsContent>

              <TabsContent value="new_item" className="space-y-4 mt-4">
                <Form {...itemForm}>
                  <form className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={itemForm.control}
                        name="item_name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Item Name *</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Asset name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={itemForm.control}
                        name="brand"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Brand</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Brand name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={itemForm.control}
                        name="category_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Category</FormLabel>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select category" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {mainCategories.map((cat) => (
                                  <SelectItem key={cat.id} value={cat.id}>
                                    {cat.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={itemForm.control}
                        name="quantity_requested"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Quantity *</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                {...field}
                                onChange={(e) =>
                                  field.onChange(parseInt(e.target.value))
                                }
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={itemForm.control}
                        name="unit_price_estimate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Est. Unit Price</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                {...field}
                                onChange={(e) =>
                                  field.onChange(parseFloat(e.target.value))
                                }
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={itemForm.control}
                        name="preferred_vendor"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Preferred Vendor</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Vendor name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={itemForm.control}
                      name="specifications"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Specifications</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              placeholder="Detailed specifications"
                              rows={3}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button
                      type="button"
                      onClick={itemForm.handleSubmit(handleAddItem)}
                      variant="outline"
                      className="w-full"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Item
                    </Button>
                  </form>
                </Form>
              </TabsContent>
            </Tabs>

            {/* Items List */}
            {items.length > 0 && (
              <Card>
                <CardContent className="pt-4">
                  <h3 className="font-medium mb-3">Requested Items ({items.length})</h3>
                  <div className="space-y-2">
                    {items.map((item, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-muted rounded-lg"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{item.item_name}</p>
                            <Badge variant="outline">
                              {item.request_type === "from_master"
                                ? "From Master"
                                : "New Item"}
                            </Badge>
                          </div>
                          {item.request_type === "new_item" && (
                            <p className="text-sm text-muted-foreground mt-1">
                              Qty: {item.quantity_requested} • Est: LKR{" "}
                              {item.total_price_estimate?.toLocaleString()}
                            </p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveItem(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  {items.some(item => item.request_type === "new_item") && (
                    <div className="mt-4 pt-4 border-t">
                      <div className="flex justify-between text-lg font-semibold">
                        <span>Total Estimated Cost (New Items):</span>
                        <span>LKR {totalEstimate.toLocaleString()}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <div className="flex justify-between gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button onClick={handleSubmit} disabled={items.length === 0}>
                Submit Request
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
