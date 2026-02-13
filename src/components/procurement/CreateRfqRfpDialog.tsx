import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateRfqRfpRequest } from "@/hooks/useRfqRfp";
import { useCompany } from "@/contexts/CompanyContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";
import type { CreateRfqRfpData, RfqRfpItem } from "@/types/rfqRfp";

const formSchema = z.object({
  request_type: z.enum(["rfq", "rfp"]),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  category: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  submission_deadline: z.string().min(1, "Submission deadline is required"),
  evaluation_deadline: z.string().optional(),
  budget_estimate: z.string().optional(),
  currency: z.string().default("LKR"),
  terms_and_conditions: z.string().optional(),
  technical_specifications: z.string().optional(),
  delivery_requirements: z.string().optional(),
  payment_terms: z.string().optional(),
  warranty_requirements: z.string().optional(),
  compliance_requirements: z.string().optional(),
  publish_type: z.enum(["public", "invited", "limited"]),
});

interface CreateRfqRfpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateRfqRfpDialog({ open, onOpenChange }: CreateRfqRfpDialogProps) {
  const { selectedCompany } = useCompany();
  const createMutation = useCreateRfqRfpRequest();
  const [activeTab, setActiveTab] = useState("basic");
  const [items, setItems] = useState<Omit<RfqRfpItem, 'id' | 'request_id' | 'created_at' | 'updated_at'>[]>([]);
  const [newItem, setNewItem] = useState({
    item_name: "",
    description: "",
    quantity: "",
    unit_of_measure: "pcs",
    estimated_unit_price: "",
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      request_type: "rfq",
      priority: "medium",
      currency: "LKR",
      publish_type: "public",
    },
  });

  const handleAddItem = () => {
    if (newItem.item_name && newItem.quantity) {
      const quantity = parseFloat(newItem.quantity);
      const unitPrice = newItem.estimated_unit_price ? parseFloat(newItem.estimated_unit_price) : undefined;
      
      setItems([
        ...items,
        {
          line_number: items.length + 1,
          item_name: newItem.item_name,
          description: newItem.description || undefined,
          quantity,
          unit_of_measure: newItem.unit_of_measure,
          estimated_unit_price: unitPrice,
          estimated_total_price: unitPrice ? quantity * unitPrice : undefined,
        },
      ]);
      
      setNewItem({
        item_name: "",
        description: "",
        quantity: "",
        unit_of_measure: "pcs",
        estimated_unit_price: "",
      });
    }
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    if (items.length === 0) {
      form.setError("root", { message: "Please add at least one item" });
      return;
    }

    const data: CreateRfqRfpData = {
      request_type: values.request_type,
      title: values.title,
      description: values.description,
      category: values.category,
      priority: values.priority,
      submission_deadline: values.submission_deadline,
      evaluation_deadline: values.evaluation_deadline,
      budget_estimate: values.budget_estimate ? parseFloat(values.budget_estimate) : undefined,
      currency: values.currency,
      terms_and_conditions: values.terms_and_conditions,
      technical_specifications: values.technical_specifications,
      delivery_requirements: values.delivery_requirements,
      payment_terms: values.payment_terms,
      warranty_requirements: values.warranty_requirements,
      compliance_requirements: values.compliance_requirements,
      publish_type: values.publish_type,
      company_id: selectedCompany?.id,
      items,
    };

    createMutation.mutate(data, {
      onSuccess: () => {
        form.reset();
        setItems([]);
        onOpenChange(false);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create RFQ/RFP Request</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                <TabsTrigger value="items">Items</TabsTrigger>
                <TabsTrigger value="details">Requirements</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="request_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Request Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="rfq">RFQ (Request for Quotation)</SelectItem>
                            <SelectItem value="rfp">RFP (Request for Proposal)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Priority</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                </div>

                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Enter request title" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea {...field} rows={3} placeholder="Enter description" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g., Raw Materials" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="publish_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Publish Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="public">Public</SelectItem>
                            <SelectItem value="invited">Invited Only</SelectItem>
                            <SelectItem value="limited">Limited</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="submission_deadline"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Submission Deadline</FormLabel>
                        <FormControl>
                          <Input {...field} type="datetime-local" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="evaluation_deadline"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Evaluation Deadline</FormLabel>
                        <FormControl>
                          <Input {...field} type="date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="budget_estimate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Budget Estimate</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" step="0.01" placeholder="0.00" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>

              <TabsContent value="items" className="space-y-4">
                <div className="border rounded-lg p-4 space-y-4">
                  <h3 className="font-medium">Add Item</h3>
                  <div className="grid grid-cols-5 gap-2">
                    <Input
                      placeholder="Item Name"
                      value={newItem.item_name}
                      onChange={(e) => setNewItem({ ...newItem, item_name: e.target.value })}
                    />
                    <Input
                      placeholder="Description"
                      value={newItem.description}
                      onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                    />
                    <Input
                      placeholder="Quantity"
                      type="number"
                      value={newItem.quantity}
                      onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
                    />
                    <Input
                      placeholder="Unit"
                      value={newItem.unit_of_measure}
                      onChange={(e) => setNewItem({ ...newItem, unit_of_measure: e.target.value })}
                    />
                    <Input
                      placeholder="Est. Price"
                      type="number"
                      step="0.01"
                      value={newItem.estimated_unit_price}
                      onChange={(e) => setNewItem({ ...newItem, estimated_unit_price: e.target.value })}
                    />
                  </div>
                  <Button type="button" onClick={handleAddItem} size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Item
                  </Button>
                </div>

                {items.length > 0 && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item Name</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>UOM</TableHead>
                        <TableHead>Est. Price</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>{item.item_name}</TableCell>
                          <TableCell>{item.description}</TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell>{item.unit_of_measure}</TableCell>
                          <TableCell>{item.estimated_unit_price?.toFixed(2)}</TableCell>
                          <TableCell>{item.estimated_total_price?.toFixed(2)}</TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveItem(index)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>

              <TabsContent value="details" className="space-y-4">
                <FormField
                  control={form.control}
                  name="technical_specifications"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Technical Specifications</FormLabel>
                      <FormControl>
                        <Textarea {...field} rows={3} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="terms_and_conditions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Terms and Conditions</FormLabel>
                      <FormControl>
                        <Textarea {...field} rows={3} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="delivery_requirements"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Delivery Requirements</FormLabel>
                        <FormControl>
                          <Textarea {...field} rows={2} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="payment_terms"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payment Terms</FormLabel>
                        <FormControl>
                          <Textarea {...field} rows={2} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="warranty_requirements"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Warranty Requirements</FormLabel>
                        <FormControl>
                          <Textarea {...field} rows={2} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="compliance_requirements"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Compliance Requirements</FormLabel>
                        <FormControl>
                          <Textarea {...field} rows={2} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>
            </Tabs>

            {form.formState.errors.root && (
              <p className="text-sm text-destructive">{form.formState.errors.root.message}</p>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creating..." : "Create Request"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
