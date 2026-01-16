import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateInventoryMaster, useUpdateInventoryMaster } from "@/hooks/construction/useInventoryMaster";
import type { InventoryMaster, CreateInventoryMasterData } from "@/types/construction";
import { useEffect } from "react";

const formSchema = z.object({
  item_code: z.string().optional(),
  item_name: z.string().min(1, "Item name is required"),
  category: z.string().optional(),
  unit: z.string().optional(),
  unit_cost: z.coerce.number().optional(),
  description: z.string().optional(),
  status: z.string().default("active"),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface InventoryMasterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: InventoryMaster | null;
}

export function InventoryMasterDialog({ open, onOpenChange, item }: InventoryMasterDialogProps) {
  const createMutation = useCreateInventoryMaster();
  const updateMutation = useUpdateInventoryMaster();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { item_code: "", item_name: "", category: "", unit: "", unit_cost: 0, description: "", status: "active", notes: "" },
  });

  useEffect(() => {
    if (item) {
      form.reset({ item_code: item.item_code || "", item_name: item.item_name, category: item.category || "", unit: item.unit || "", unit_cost: item.unit_cost || 0, description: item.description || "", status: item.status, notes: item.notes || "" });
    } else {
      form.reset({ item_code: "", item_name: "", category: "", unit: "", unit_cost: 0, description: "", status: "active", notes: "" });
    }
  }, [item, form]);

  const onSubmit = async (data: FormData) => {
    if (item) {
      await updateMutation.mutateAsync({ id: item.id, ...data });
    } else {
      await createMutation.mutateAsync(data as CreateInventoryMasterData);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{item ? "Edit Inventory Item" : "Add Inventory Item"}</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="item_code" render={({ field }) => (<FormItem><FormLabel>Item Code</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="item_name" render={({ field }) => (<FormItem><FormLabel>Item Name *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="category" render={({ field }) => (<FormItem><FormLabel>Category</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="unit" render={({ field }) => (<FormItem><FormLabel>Unit</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>
            <FormField control={form.control} name="unit_cost" render={({ field }) => (<FormItem><FormLabel>Unit Cost</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="status" render={({ field }) => (<FormItem><FormLabel>Status</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="notes" render={({ field }) => (<FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>{item ? "Update" : "Add"}</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
