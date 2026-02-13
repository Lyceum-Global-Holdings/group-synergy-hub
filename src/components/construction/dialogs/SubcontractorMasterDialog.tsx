import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateSubcontractorMaster, useUpdateSubcontractorMaster } from "@/hooks/construction/useSubcontractorMaster";
import type { SubcontractorMaster, CreateSubcontractorMasterData } from "@/types/construction";
import { useEffect } from "react";

const formSchema = z.object({
  name: z.string().min(1, "Company name is required"),
  trade: z.string().optional(),
  contact_person: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  license_number: z.string().optional(),
  insurance_expiry: z.string().optional(),
  status: z.string().default("pending"),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface SubcontractorMasterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subcontractor?: SubcontractorMaster | null;
}

export function SubcontractorMasterDialog({ open, onOpenChange, subcontractor }: SubcontractorMasterDialogProps) {
  const createMutation = useCreateSubcontractorMaster();
  const updateMutation = useUpdateSubcontractorMaster();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", trade: "", contact_person: "", phone: "", email: "", address: "", license_number: "", insurance_expiry: "", status: "pending", notes: "" },
  });

  useEffect(() => {
    if (subcontractor) {
      form.reset({ name: subcontractor.name, trade: subcontractor.trade || "", contact_person: subcontractor.contact_person || "", phone: subcontractor.phone || "", email: subcontractor.email || "", address: subcontractor.address || "", license_number: subcontractor.license_number || "", insurance_expiry: subcontractor.insurance_expiry || "", status: subcontractor.status, notes: subcontractor.notes || "" });
    } else {
      form.reset({ name: "", trade: "", contact_person: "", phone: "", email: "", address: "", license_number: "", insurance_expiry: "", status: "pending", notes: "" });
    }
  }, [subcontractor, form]);

  const onSubmit = async (data: FormData) => {
    if (subcontractor) {
      await updateMutation.mutateAsync({ id: subcontractor.id, ...data });
    } else {
      await createMutation.mutateAsync(data as CreateSubcontractorMasterData);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{subcontractor ? "Edit Subcontractor" : "Add Subcontractor"}</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Company Name *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="trade" render={({ field }) => (<FormItem><FormLabel>Trade</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="contact_person" render={({ field }) => (<FormItem><FormLabel>Contact Person</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="phone" render={({ field }) => (<FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>
            <FormField control={form.control} name="address" render={({ field }) => (<FormItem><FormLabel>Address</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="license_number" render={({ field }) => (<FormItem><FormLabel>License Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="insurance_expiry" render={({ field }) => (<FormItem><FormLabel>Insurance Expiry</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>
            <FormField control={form.control} name="status" render={({ field }) => (<FormItem><FormLabel>Status</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="pending">Pending</SelectItem><SelectItem value="approved">Approved</SelectItem><SelectItem value="rejected">Rejected</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="notes" render={({ field }) => (<FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>{subcontractor ? "Update" : "Add"}</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
