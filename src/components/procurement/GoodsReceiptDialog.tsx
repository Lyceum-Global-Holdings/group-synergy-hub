/**
 * @deprecated This component is deprecated. Use CreateGrnDialog from warehouse instead.
 * 
 * This dialog creates po_receipts which are NOT connected to warehouse stock management.
 * All goods receipt should go through the unified GRN system which properly updates
 * warehouse stock and creates stock transactions.
 * 
 * Migration Path:
 * 1. Use CreateGrnDialog with preselectedPo prop
 * 2. GRNs will auto-update PO quantities via database trigger
 * 3. Stock transactions will be created when GRN is approved
 * 
 * @see CreateGrnDialog in src/components/warehouse/CreateGrnDialog.tsx
 */

import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCreateGoodsReceipt } from "@/hooks/usePurchaseOrders";
import { PurchaseOrder, QualityStatus } from "@/types/purchaseOrder";
import { cn } from "@/lib/utils";

const createReceiptSchema = z.object({
  receipt_number: z.string().min(1, "Receipt number is required"),
  received_date: z.string().min(1, "Received date is required"),
  notes: z.string().optional(),
  items: z.array(z.object({
    po_item_id: z.string(),
    quantity_received: z.number().min(0.01, "Quantity must be greater than 0"),
    quality_status: z.enum(['good', 'damaged', 'rejected'] as const),
    notes: z.string().optional(),
  })).min(1, "At least one item must be received"),
});

type CreateReceiptFormData = z.infer<typeof createReceiptSchema>;

interface GoodsReceiptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseOrder: PurchaseOrder;
}

const qualityStatusOptions: { value: QualityStatus; label: string }[] = [
  { value: 'good', label: 'Good' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'rejected', label: 'Rejected' },
];

export function GoodsReceiptDialog({ open, onOpenChange, purchaseOrder }: GoodsReceiptDialogProps) {
  const createReceiptMutation = useCreateGoodsReceipt();

  // Generate default receipt number
  const generateReceiptNumber = () => {
    const date = new Date();
    const dateStr = format(date, 'yyyyMMdd');
    const time = format(date, 'HHmmss');
    return `GR-${dateStr}-${time}`;
  };

  const form = useForm<CreateReceiptFormData>({
    resolver: zodResolver(createReceiptSchema),
    defaultValues: {
      receipt_number: generateReceiptNumber(),
      received_date: new Date().toISOString().split('T')[0],
      items: purchaseOrder.items?.map(item => ({
        po_item_id: item.id!,
        quantity_received: Math.min(item.quantity_pending, item.quantity_ordered),
        quality_status: 'good' as QualityStatus,
        notes: '',
      })) || [],
    },
  });

  const { fields } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const onSubmit = async (data: CreateReceiptFormData) => {
    try {
      await createReceiptMutation.mutateAsync({
        po_id: purchaseOrder.id,
        receipt_number: data.receipt_number,
        received_date: data.received_date,
        notes: data.notes,
        items: data.items.map(item => ({
          po_item_id: item.po_item_id!,
          quantity_received: item.quantity_received!,
          quality_status: item.quality_status!,
          notes: item.notes,
        })),
      });
      form.reset();
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating goods receipt:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Goods Receipt</DialogTitle>
          <DialogDescription>
            Record goods received for PO: {purchaseOrder.po_number}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Receipt Header */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Receipt Information</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="receipt_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Receipt Number *</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="received_date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Received Date *</FormLabel>
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
                            disabled={(date) => date > new Date()}
                            initialFocus
                            className="pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Items to Receive */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Items to Receive</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item Name</TableHead>
                      <TableHead>Ordered</TableHead>
                      <TableHead>Already Received</TableHead>
                      <TableHead>Pending</TableHead>
                      <TableHead>Receiving Now *</TableHead>
                      <TableHead>Quality Status *</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fields.map((field, index) => {
                      const poItem = purchaseOrder.items?.find(item => item.id === field.po_item_id);
                      if (!poItem) return null;

                      return (
                        <TableRow key={field.id}>
                          <TableCell className="font-medium">{poItem.item_name}</TableCell>
                          <TableCell>{poItem.quantity_ordered}</TableCell>
                          <TableCell>{poItem.quantity_received}</TableCell>
                          <TableCell>{poItem.quantity_pending}</TableCell>
                          <TableCell>
                            <FormField
                              control={form.control}
                              name={`items.${index}.quantity_received`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      max={poItem.quantity_pending}
                                      className="w-24"
                                      {...field}
                                      onChange={(e) => field.onChange(Number(e.target.value))}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </TableCell>
                          <TableCell>
                            <FormField
                              control={form.control}
                              name={`items.${index}.quality_status`}
                              render={({ field }) => (
                                <FormItem>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                      <SelectTrigger className="w-32">
                                        <SelectValue />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {qualityStatusOptions.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                          {option.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </TableCell>
                          <TableCell>
                            <FormField
                              control={form.control}
                              name={`items.${index}.notes`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Input
                                      placeholder="Notes..."
                                      className="w-32"
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Receipt Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Receipt Notes</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Additional notes about this receipt..."
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createReceiptMutation.isPending}>
                {createReceiptMutation.isPending ? "Recording..." : "Record Receipt"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}