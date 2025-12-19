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
import { useCreateConstructionResource, useUpdateConstructionResource } from "@/hooks/construction/useConstructionResources";
import { ConstructionResource, RESOURCE_TYPES, RESOURCE_STATUSES } from "@/types/construction";
import { useEffect } from "react";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "sonner";

const formSchema = z.object({
  project_id: z.string().min(1, "Project is required"),
  resource_type: z.string().min(1, "Resource type is required"),
  resource_name: z.string().min(1, "Resource name is required"),
  description: z.string().optional(),
  unit: z.string().optional(),
  quantity_allocated: z.coerce.number().optional(),
  unit_cost: z.coerce.number().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface ResourceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resource?: ConstructionResource | null;
}

export function ResourceDialog({ open, onOpenChange, resource }: ResourceDialogProps) {
  const { data: projects } = useProjects();
  const { selectedCompany } = useCompany();
  const createResource = useCreateConstructionResource();
  const updateResource = useUpdateConstructionResource();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      project_id: "",
      resource_type: "",
      resource_name: "",
      description: "",
      unit: "",
      quantity_allocated: 0,
      unit_cost: 0,
      start_date: "",
      end_date: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (resource) {
      form.reset({
        project_id: resource.project_id,
        resource_type: resource.resource_type,
        resource_name: resource.resource_name,
        description: resource.description || "",
        unit: resource.unit || "",
        quantity_allocated: resource.quantity_allocated || 0,
        unit_cost: resource.unit_cost || 0,
        start_date: resource.start_date || "",
        end_date: resource.end_date || "",
        notes: resource.notes || "",
      });
    } else {
      form.reset({
        project_id: "",
        resource_type: "",
        resource_name: "",
        description: "",
        unit: "",
        quantity_allocated: 0,
        unit_cost: 0,
        start_date: "",
        end_date: "",
        notes: "",
      });
    }
  }, [resource, form]);

  const onSubmit = async (data: FormData) => {
    if (!resource && !selectedCompany?.id) {
      toast.error("Please select a company before adding a resource");
      return;
    }
    
    try {
      const payload = {
        project_id: data.project_id,
        resource_name: data.resource_name,
        resource_type: data.resource_type as any,
        description: data.description || undefined,
        unit: data.unit || undefined,
        quantity_allocated: data.quantity_allocated || undefined,
        unit_cost: data.unit_cost || undefined,
        start_date: data.start_date || null,
        end_date: data.end_date || null,
        notes: data.notes || undefined,
      };
      
      if (resource) {
        await updateResource.mutateAsync({
          id: resource.id,
          ...payload,
        });
      } else {
        await createResource.mutateAsync(payload);
      }
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving resource:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {resource ? "Edit Resource" : "Add Resource"}
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
                name="resource_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Resource Type *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {RESOURCE_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
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
              name="resource_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Resource Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="Resource name" {...field} />
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
                    <Textarea placeholder="Description" {...field} />
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
                      <Input placeholder="e.g., hours, pcs" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="quantity_allocated"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Qty Allocated</FormLabel>
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

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="start_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="end_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
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
              <Button type="submit" disabled={createResource.isPending || updateResource.isPending}>
                {resource ? "Update" : "Add"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
