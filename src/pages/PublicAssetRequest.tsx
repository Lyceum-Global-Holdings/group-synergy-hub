import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Plus, Trash2, CheckCircle, Package } from "lucide-react";
import { AssetMasterSelector } from "@/components/common/AssetMasterSelector";
import { Badge } from "@/components/ui/badge";

const itemSchema = z.object({
  asset_master_id: z.string().optional(),
  item_name: z.string().min(1, "Item name is required"),
  item_description: z.string().optional(),
  quantity_requested: z.number().min(1, "Quantity must be at least 1"),
  justification: z.string().optional(),
});

const formSchema = z.object({
  requester_name: z.string().min(2, "Name must be at least 2 characters"),
  requester_email: z.string().email("Invalid email address"),
  department: z.string().min(2, "Department is required"),
  contact_number: z.string().optional(),
  purpose: z.string().min(10, "Purpose must be at least 10 characters"),
  justification: z.string().optional(),
  required_date: z.string().min(1, "Required date is required"),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  items: z.array(itemSchema).min(1, "At least one item is required"),
});

type FormData = z.infer<typeof formSchema>;

interface RequestItem {
  id: string;
  asset_master_id?: string;
  item_name: string;
  item_description?: string;
  quantity_requested: number;
  justification?: string;
}

export default function PublicAssetRequest() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [items, setItems] = useState<RequestItem[]>([
    { id: crypto.randomUUID(), item_name: "", quantity_requested: 1 }
  ]);
  const { toast } = useToast();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      requester_name: "",
      requester_email: "",
      department: "",
      contact_number: "",
      purpose: "",
      justification: "",
      required_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      priority: "medium",
      items: [{ item_name: "", quantity_requested: 1 }],
    },
  });

  const addItem = () => {
    setItems([...items, { id: crypto.randomUUID(), item_name: "", quantity_requested: 1 }]);
  };

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter(item => item.id !== id));
    }
  };

  const updateItem = (id: string, field: keyof RequestItem, value: any) => {
    setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const onSubmit = async (data: FormData) => {
    try {
      setIsSubmitting(true);

      // Validate items
      const validItems = items.filter(item => item.item_name.trim() !== "");
      if (validItems.length === 0) {
        toast({
          title: "Validation Error",
          description: "Please add at least one item to your request",
          variant: "destructive",
        });
        return;
      }

      // Call edge function
      const { data: result, error } = await supabase.functions.invoke('public-asset-request', {
        body: {
          ...data,
          items: validItems.map(item => ({
            asset_master_id: item.asset_master_id,
            item_name: item.item_name,
            item_description: item.item_description,
            quantity_requested: item.quantity_requested,
            justification: item.justification,
          })),
        },
      });

      if (error) throw error;

      if (result.success) {
        setTrackingNumber(result.request_number);
        setIsSuccess(true);
        toast({
          title: "Request Submitted",
          description: `Your request has been submitted with tracking number: ${result.request_number}`,
        });
      }
    } catch (error: any) {
      console.error('Error submitting request:', error);
      toast({
        title: "Submission Failed",
        description: error.message || "Failed to submit asset request. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-2xl w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Request Submitted Successfully!</CardTitle>
            <CardDescription>
              Your asset request has been received and is being processed.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-muted p-6 rounded-lg text-center">
              <p className="text-sm text-muted-foreground mb-2">Your Tracking Number</p>
              <p className="text-3xl font-bold text-primary">{trackingNumber}</p>
            </div>
            
            <div className="space-y-3">
              <h3 className="font-semibold">What happens next?</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">1.</span>
                  <span>Your request will be reviewed by the Head of Department</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">2.</span>
                  <span>If approved by HOD, it will be forwarded to Procurement</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">3.</span>
                  <span>Procurement will finalize the request and arrange fulfillment</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">4.</span>
                  <span>You will be notified at each stage via email</span>
                </li>
              </ul>
            </div>

            <div className="bg-muted/50 p-4 rounded-lg">
              <p className="text-sm">
                <strong>Note:</strong> Please save your tracking number. You can use it to inquire about your request status.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <Package className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-2xl">Asset Request Form</CardTitle>
                <CardDescription>
                  Submit a request for assets or equipment. No login required.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              {/* Requester Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Requester Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="requester_name">Full Name *</Label>
                    <Input
                      id="requester_name"
                      {...form.register("requester_name")}
                      placeholder="John Doe"
                    />
                    {form.formState.errors.requester_name && (
                      <p className="text-sm text-destructive">{form.formState.errors.requester_name.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="requester_email">Email *</Label>
                    <Input
                      id="requester_email"
                      type="email"
                      {...form.register("requester_email")}
                      placeholder="john.doe@example.com"
                    />
                    {form.formState.errors.requester_email && (
                      <p className="text-sm text-destructive">{form.formState.errors.requester_email.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="department">Department *</Label>
                    <Input
                      id="department"
                      {...form.register("department")}
                      placeholder="IT Department"
                    />
                    {form.formState.errors.department && (
                      <p className="text-sm text-destructive">{form.formState.errors.department.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contact_number">Contact Number</Label>
                    <Input
                      id="contact_number"
                      {...form.register("contact_number")}
                      placeholder="+94 77 123 4567"
                    />
                  </div>
                </div>
              </div>

              {/* Request Details */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Request Details</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="purpose">Purpose *</Label>
                    <Textarea
                      id="purpose"
                      {...form.register("purpose")}
                      placeholder="Describe the purpose of this asset request..."
                      rows={3}
                    />
                    {form.formState.errors.purpose && (
                      <p className="text-sm text-destructive">{form.formState.errors.purpose.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="justification">Justification</Label>
                    <Textarea
                      id="justification"
                      {...form.register("justification")}
                      placeholder="Additional justification or business case..."
                      rows={2}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="required_date">Required Date *</Label>
                      <Input
                        id="required_date"
                        type="date"
                        {...form.register("required_date")}
                      />
                      {form.formState.errors.required_date && (
                        <p className="text-sm text-destructive">{form.formState.errors.required_date.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="priority">Priority *</Label>
                      <Select
                        value={form.watch("priority")}
                        onValueChange={(value) => form.setValue("priority", value as any)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Asset Items */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Asset Items *</h3>
                  <Button type="button" onClick={addItem} size="sm" variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Item
                  </Button>
                </div>

                <div className="space-y-4">
                  {items.map((item, index) => (
                    <Card key={item.id}>
                      <CardContent className="pt-6">
                        <div className="space-y-4">
                          <div className="flex items-start justify-between gap-2">
                            <Badge variant="secondary">Item {index + 1}</Badge>
                            {items.length > 1 && (
                              <Button
                                type="button"
                                onClick={() => removeItem(item.id)}
                                size="icon"
                                variant="ghost"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>

                          <div className="space-y-2">
                            <Label>Select from Asset Master (Optional)</Label>
                            <AssetMasterSelector
                              value={item.asset_master_id}
                              onValueChange={(value) => updateItem(item.id, 'asset_master_id', value)}
                              onAssetSelected={(asset) => {
                                updateItem(item.id, 'asset_master_id', asset.id);
                                updateItem(item.id, 'item_name', asset.asset_name);
                                updateItem(item.id, 'item_description', asset.description || '');
                              }}
                            />
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Item Name *</Label>
                              <Input
                                value={item.item_name}
                                onChange={(e) => updateItem(item.id, 'item_name', e.target.value)}
                                placeholder="Enter item name"
                              />
                            </div>

                            <div className="space-y-2">
                              <Label>Quantity *</Label>
                              <Input
                                type="number"
                                min="1"
                                value={item.quantity_requested}
                                onChange={(e) => updateItem(item.id, 'quantity_requested', parseInt(e.target.value) || 1)}
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label>Description</Label>
                            <Textarea
                              value={item.item_description || ''}
                              onChange={(e) => updateItem(item.id, 'item_description', e.target.value)}
                              placeholder="Additional details about this item..."
                              rows={2}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Justification</Label>
                            <Textarea
                              value={item.justification || ''}
                              onChange={(e) => updateItem(item.id, 'justification', e.target.value)}
                              placeholder="Why is this item needed?"
                              rows={2}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Submit */}
              <div className="flex justify-end gap-3">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  size="lg"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit Request"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
