import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateLabourMaster, useUpdateLabourMaster } from "@/hooks/construction/useLabourMaster";
import type { LabourMaster, CreateLabourMasterData } from "@/types/construction";
import { useEffect } from "react";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  trade: z.string().optional(),
  skill_level: z.string().optional(),
  contact_number: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  hourly_rate: z.coerce.number().optional(),
  daily_rate: z.coerce.number().optional(),
  status: z.string().default("active"),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface LabourMasterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  labour?: LabourMaster | null;
}

export function LabourMasterDialog({ open, onOpenChange, labour }: LabourMasterDialogProps) {
  const createMutation = useCreateLabourMaster();
  const updateMutation = useUpdateLabourMaster();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", trade: "", skill_level: "", contact_number: "", email: "", hourly_rate: 0, daily_rate: 0, status: "active", notes: "" },
  });

  useEffect(() => {
    if (labour) {
      form.reset({ name: labour.name, trade: labour.trade || "", skill_level: labour.skill_level || "", contact_number: labour.contact_number || "", email: labour.email || "", hourly_rate: labour.hourly_rate || 0, daily_rate: labour.daily_rate || 0, status: labour.status, notes: labour.notes || "" });
    } else {
      form.reset({ name: "", trade: "", skill_level: "", contact_number: "", email: "", hourly_rate: 0, daily_rate: 0, status: "active", notes: "" });
    }
  }, [labour, form]);

  const onSubmit = async (data: FormData) => {
    if (labour) {
      await updateMutation.mutateAsync({ id: labour.id, ...data });
    } else {
      await createMutation.mutateAsync(data as CreateLabourMasterData);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{labour ? "Edit Labour" : "Add Labour"}</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Name *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="trade" render={({ field }) => (<FormItem><FormLabel>Trade / Skill</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="skill_level" render={({ field }) => (<FormItem><FormLabel>Skill Level</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="contact_number" render={({ field }) => (<FormItem><FormLabel>Contact Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="hourly_rate" render={({ field }) => (<FormItem><FormLabel>Hourly Rate</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="daily_rate" render={({ field }) => (<FormItem><FormLabel>Daily Rate</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>
            <FormField control={form.control} name="status" render={({ field }) => (<FormItem><FormLabel>Status</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="notes" render={({ field }) => (<FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>{labour ? "Update" : "Add"}</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
