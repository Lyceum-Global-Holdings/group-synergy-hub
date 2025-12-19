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
import { useCreateWorkOrder, useUpdateWorkOrder } from "@/hooks/construction/useWorkOrders";
import {
  WorkOrder,
  WORK_ORDER_STATUSES,
  WORK_ORDER_PRIORITIES,
  WORK_ORDER_TYPES,
} from "@/types/construction";
import { useEffect } from "react";

const formSchema = z.object({
  project_id: z.string().min(1, "Project is required"),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  work_type: z.string().optional(),
  priority: z.string().optional(),
  status: z.string().optional(),
  planned_start_date: z.string().optional(),
  planned_end_date: z.string().optional(),
  estimated_hours: z.coerce.number().optional(),
  estimated_cost: z.coerce.number().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface WorkOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workOrder?: WorkOrder | null;
}

export function WorkOrderDialog({ open, onOpenChange, workOrder }: WorkOrderDialogProps) {
  const { data: projects } = useProjects();
  const createWorkOrder = useCreateWorkOrder();
  const updateWorkOrder = useUpdateWorkOrder();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      project_id: "",
      title: "",
      description: "",
      work_type: "",
      priority: "medium",
      status: "pending",
      planned_start_date: "",
      planned_end_date: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (workOrder) {
      form.reset({
        project_id: workOrder.project_id,
        title: workOrder.title,
        description: workOrder.description || "",
        work_type: workOrder.work_type || "",
        priority: workOrder.priority,
        status: workOrder.status,
        planned_start_date: workOrder.planned_start_date || "",
        planned_end_date: workOrder.planned_end_date || "",
        estimated_hours: workOrder.estimated_hours || undefined,
        estimated_cost: workOrder.estimated_cost || undefined,
        notes: workOrder.notes || "",
      });
    } else {
      form.reset({
        project_id: "",
        title: "",
        description: "",
        work_type: "",
        priority: "medium",
        status: "pending",
        planned_start_date: "",
        planned_end_date: "",
        notes: "",
      });
    }
  }, [workOrder, form]);

  const onSubmit = async (data: FormData) => {
    try {
      if (workOrder) {
        await updateWorkOrder.mutateAsync({
          id: workOrder.id,
          ...data,
          work_type: data.work_type as any,
          priority: data.priority as any,
          status: data.status as any,
        });
      } else {
        await createWorkOrder.mutateAsync({
          project_id: data.project_id,
          title: data.title,
          description: data.description,
          work_type: data.work_type as any,
          priority: data.priority as any,
          status: data.status as any,
          planned_start_date: data.planned_start_date,
          planned_end_date: data.planned_end_date,
          estimated_hours: data.estimated_hours,
          estimated_cost: data.estimated_cost,
          notes: data.notes,
        });
      }
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving work order:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {workOrder ? "Edit Work Order" : "Create Work Order"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title *</FormLabel>
                  <FormControl>
                    <Input placeholder="Work order title" {...field} />
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
                name="work_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {WORK_ORDER_TYPES.map((type) => (
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

              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {WORK_ORDER_PRIORITIES.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            {p.label}
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
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {WORK_ORDER_STATUSES.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="planned_start_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Planned Start Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="planned_end_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Planned End Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="estimated_hours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estimated Hours</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="estimated_cost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estimated Cost</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="0.00" {...field} />
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
              <Button type="submit" disabled={createWorkOrder.isPending || updateWorkOrder.isPending}>
                {workOrder ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
