import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCreateSupplierQuote } from "@/hooks/useRfqRfp";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { RfqRfpRequest, CreateQuoteData, SupplierQuoteItem } from "@/types/rfqRfp";

const formSchema = z.object({
  validity_period: z.string().min(1, "Validity period is required"),
  payment_terms: z.string().optional(),
  delivery_commitment: z.string().optional(),
  warranty_offered: z.string().optional(),
  notes: z.string().optional(),
});

interface SubmitQuoteDialogProps {
  request: RfqRfpRequest | null;
  supplierId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SubmitQuoteDialog({ request, supplierId, open, onOpenChange }: SubmitQuoteDialogProps) {
  const createMutation = useCreateSupplierQuote();
  const [quoteItems, setQuoteItems] = useState<Record<string, { unit_price: string; delivery_days: string }>>({});

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      validity_period: "30",
    },
  });

  const handleItemChange = (itemId: string, field: "unit_price" | "delivery_days", value: string) => {
    setQuoteItems((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: value,
      },
    }));
  };

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    if (!request) return;

    const items: Omit<SupplierQuoteItem, 'id' | 'quote_id' | 'created_at' | 'updated_at'>[] = [];
    
    request.items?.forEach((item, index) => {
      const quoteItem = quoteItems[item.id || ""];
      if (quoteItem?.unit_price) {
        const unitPrice = parseFloat(quoteItem.unit_price);
        items.push({
          rfq_item_id: item.id || "",
          line_number: index + 1,
          unit_price: unitPrice,
          total_price: unitPrice * item.quantity,
          delivery_days: quoteItem.delivery_days ? parseInt(quoteItem.delivery_days) : undefined,
          alternative_offered: false,
        });
      }
    });

    if (items.length === 0) {
      form.setError("root", { message: "Please provide prices for at least one item" });
      return;
    }

    const data: CreateQuoteData = {
      request_id: request.id,
      supplier_id: supplierId,
      validity_period: parseInt(values.validity_period),
      payment_terms: values.payment_terms,
      delivery_commitment: values.delivery_commitment,
      warranty_offered: values.warranty_offered,
      notes: values.notes,
      items,
    };

    createMutation.mutate(data, {
      onSuccess: () => {
        form.reset();
        setQuoteItems({});
        onOpenChange(false);
      },
    });
  };

  if (!request) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-screen h-screen max-w-none max-h-none rounded-none p-6 overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Submit Quote - {request.title}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="border rounded-lg p-4">
              <h3 className="font-medium mb-4">Quote Items</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item Name</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>UOM</TableHead>
                    <TableHead>Unit Price *</TableHead>
                    <TableHead>Total Price</TableHead>
                    <TableHead>Delivery Days</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {request.items?.map((item) => {
                    const quoteItem = quoteItems[item.id || ""] || { unit_price: "", delivery_days: "" };
                    const unitPrice = parseFloat(quoteItem.unit_price || "0");
                    const totalPrice = unitPrice * item.quantity;

                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.item_name}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>{item.unit_of_measure}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={quoteItem.unit_price}
                            onChange={(e) => handleItemChange(item.id || "", "unit_price", e.target.value)}
                          />
                        </TableCell>
                        <TableCell>{totalPrice > 0 ? totalPrice.toFixed(2) : "-"}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            placeholder="Days"
                            value={quoteItem.delivery_days}
                            onChange={(e) => handleItemChange(item.id || "", "delivery_days", e.target.value)}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="validity_period"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quote Validity (days)</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="delivery_commitment"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Delivery Commitment</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., Within 15 days" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
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

              <FormField
                control={form.control}
                name="warranty_offered"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Warranty Offered</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={2} />
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
                  <FormLabel>Additional Notes</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {form.formState.errors.root && (
              <p className="text-sm text-destructive">{form.formState.errors.root.message}</p>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Submitting..." : "Submit Quote"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
