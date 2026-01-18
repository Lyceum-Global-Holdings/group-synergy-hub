import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const profitCenterSchema = z.object({
  code: z.string().min(1, "Profit center code is required").max(20, "Code is too long"),
  name: z.string().min(1, "Name is required").max(100, "Name is too long"),
  description: z.string().max(500, "Description is too long").optional(),
});

type ProfitCenterFormValues = z.infer<typeof profitCenterSchema>;

interface CreateProfitCenterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateProfitCenterDialog({ open, onOpenChange }: CreateProfitCenterDialogProps) {
  const { selectedCompany } = useCompany();
  const queryClient = useQueryClient();

  const form = useForm<ProfitCenterFormValues>({
    resolver: zodResolver(profitCenterSchema),
    defaultValues: {
      code: '',
      name: '',
      description: '',
    },
  });

  const createProfitCenter = useMutation({
    mutationFn: async (values: ProfitCenterFormValues) => {
      const { error } = await supabase.from("profit_centers").insert({
        code: values.code,
        name: values.name,
        description: values.description || null,
        company_id: selectedCompany?.id,
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profit-centers"] });
      toast.success("Profit center created successfully");
      form.reset();
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error("Failed to create profit center: " + error.message);
    },
  });

  const onSubmit = (values: ProfitCenterFormValues) => {
    createProfitCenter.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Profit Center</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Profit Center Code</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g., PC-001" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g., Retail Division" />
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
                    <Textarea {...field} placeholder="Profit center description..." rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createProfitCenter.isPending}>
                {createProfitCenter.isPending ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
