import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
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
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProjects } from "@/hooks/construction/useProjects";
import { useCreateProjectBudgetItem, useUpdateProjectBudgetItem } from "@/hooks/construction/useProjectBudgets";
import { ProjectBudgetItem, BUDGET_CATEGORIES } from "@/types/construction";
import { useEffect } from "react";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "sonner";

const formSchema = z.object({
  project_id: z.string().min(1, "Project is required"),
  budget_code: z.string().min(1, "Budget code is required"),
  category: z.string().min(1, "Category is required"),
  description: z.string().min(1, "Description is required"),
  planned_amount: z.coerce.number().min(0, "Planned amount must be positive"),
  unit: z.string().optional(),
  quantity: z.coerce.number().optional(),
  unit_cost: z.coerce.number().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface BudgetItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budgetItem?: ProjectBudgetItem | null;
}

export function BudgetItemDialog({ open, onOpenChange, budgetItem }: BudgetItemDialogProps) {
  const { data: projects } = useProjects();
  const { selectedCompany } = useCompany();
  const createBudgetItem = useCreateProjectBudgetItem();
  const updateBudgetItem = useUpdateProjectBudgetItem();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      project_id: "",
      budget_code: "",
      category: "",
      description: "",
      planned_amount: 0,
      unit: "",
      quantity: 0,
      unit_cost: 0,
      notes: "",
    },
  });

  useEffect(() => {
    if (budgetItem) {
      form.reset({
        project_id: budgetItem.project_id,
        budget_code: budgetItem.budget_code,
        category: budgetItem.category,
        description: budgetItem.description,
        planned_amount: budgetItem.planned_amount,
        unit: budgetItem.unit || "",
        quantity: budgetItem.quantity || 0,
        unit_cost: budgetItem.unit_cost || 0,
        notes: budgetItem.notes || "",
      });
    } else {
      form.reset({
        project_id: "",
        budget_code: "",
        category: "",
        description: "",
        planned_amount: 0,
        unit: "",
        quantity: 0,
        unit_cost: 0,
        notes: "",
      });
    }
  }, [budgetItem, form]);

  const onSubmit = async (data: FormData) => {
    if (!budgetItem && !selectedCompany?.id) {
      toast.error("Please select a company before adding a budget item");
      return;
    }
    
    try {
      const payload = {
        project_id: data.project_id,
        budget_code: data.budget_code,
        description: data.description,
        planned_amount: data.planned_amount,
        category: data.category as any,
        unit: data.unit || undefined,
        quantity: data.quantity || undefined,
        unit_cost: data.unit_cost || undefined,
        notes: data.notes || undefined,
      };
      
      if (budgetItem) {
        await updateBudgetItem.mutateAsync({
          id: budgetItem.id,
          ...payload,
        });
      } else {
        await createBudgetItem.mutateAsync(payload);
      }
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving budget item:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {budgetItem ? "Edit Budget Item" : "Add Budget Item"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="project_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select project" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {projects?.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.project_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {BUDGET_CATEGORIES.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>
                            {cat.label}
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
              name="budget_code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Budget Code *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., LAB-001" {...field} />
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
                  <FormLabel>Description *</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Budget item description" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., hours, units" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="unit_cost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit Cost</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="0.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="planned_amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Planned Amount *</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" placeholder="0.00" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Additional notes" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createBudgetItem.isPending || updateBudgetItem.isPending}>
                {budgetItem ? "Update" : "Add"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
