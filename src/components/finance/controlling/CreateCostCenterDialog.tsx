import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const costCenterSchema = z.object({
  code: z.string().min(1, "Cost center code is required").max(20, "Code is too long"),
  name: z.string().min(1, "Name is required").max(100, "Name is too long"),
  description: z.string().max(500, "Description is too long").optional(),
  parent_id: z.string().optional(),
});

type CostCenterFormValues = z.infer<typeof costCenterSchema>;

interface CreateCostCenterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateCostCenterDialog({ open, onOpenChange }: CreateCostCenterDialogProps) {
  const { selectedCompany } = useCompany();
  const queryClient = useQueryClient();

  const form = useForm<CostCenterFormValues>({
    resolver: zodResolver(costCenterSchema),
    defaultValues: {
      code: '',
      name: '',
      description: '',
      parent_id: '',
    },
  });

  const { data: existingCostCenters } = useQuery({
    queryKey: ["cost-centers", selectedCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cost_centers")
        .select("id, code, name")
        .eq("company_id", selectedCompany?.id)
        .eq("is_active", true)
        .order("code");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCompany?.id && open,
  });

  const createCostCenter = useMutation({
    mutationFn: async (values: CostCenterFormValues) => {
      const { error } = await supabase.from("cost_centers").insert({
        code: values.code,
        name: values.name,
        description: values.description || null,
        parent_id: values.parent_id && values.parent_id !== "none" ? values.parent_id : null,
        company_id: selectedCompany?.id,
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cost-centers"] });
      toast.success("Cost center created successfully");
      form.reset();
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error("Failed to create cost center: " + error.message);
    },
  });

  const onSubmit = (values: CostCenterFormValues) => {
    createCostCenter.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Cost Center</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cost Center Code</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., CC-001" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="parent_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Parent Cost Center</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="None (Top Level)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">None (Top Level)</SelectItem>
                        {existingCostCenters?.map((cc) => (
                          <SelectItem key={cc.id} value={cc.id}>
                            {cc.code} - {cc.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g., Production Department" />
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
                    <Textarea {...field} placeholder="Cost center description..." rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createCostCenter.isPending}>
                {createCostCenter.isPending ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
