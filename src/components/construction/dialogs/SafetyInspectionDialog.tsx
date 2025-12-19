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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProjects } from "@/hooks/construction/useProjects";
import { useCreateSafetyInspection, useUpdateSafetyInspection } from "@/hooks/construction/useSafetyManagement";
import { SafetyInspection, SAFETY_INSPECTION_TYPES, SAFETY_INSPECTION_STATUSES } from "@/types/construction";
import { useEffect } from "react";
import { format } from "date-fns";

const formSchema = z.object({
  project_id: z.string().min(1, "Project is required"),
  inspection_type: z.string().min(1, "Inspection type is required"),
  inspection_date: z.string().min(1, "Inspection date is required"),
  status: z.string().optional(),
  overall_score: z.coerce.number().min(0).max(100).optional(),
  findings: z.string().optional(),
  hazards_identified: z.string().optional(),
  corrective_actions: z.string().optional(),
  follow_up_required: z.boolean().default(false),
  follow_up_date: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface SafetyInspectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inspection?: SafetyInspection | null;
}

export function SafetyInspectionDialog({ open, onOpenChange, inspection }: SafetyInspectionDialogProps) {
  const { data: projects } = useProjects();
  const createInspection = useCreateSafetyInspection();
  const updateInspection = useUpdateSafetyInspection();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      project_id: "",
      inspection_type: "",
      inspection_date: format(new Date(), "yyyy-MM-dd"),
      status: "scheduled",
      overall_score: undefined,
      findings: "",
      hazards_identified: "",
      corrective_actions: "",
      follow_up_required: false,
      follow_up_date: "",
    },
  });

  useEffect(() => {
    if (inspection) {
      form.reset({
        project_id: inspection.project_id,
        inspection_type: inspection.inspection_type,
        inspection_date: inspection.inspection_date,
        status: inspection.status,
        overall_score: inspection.overall_score || undefined,
        findings: inspection.findings || "",
        hazards_identified: inspection.hazards_identified || "",
        corrective_actions: inspection.corrective_actions || "",
        follow_up_required: inspection.follow_up_required,
        follow_up_date: inspection.follow_up_date || "",
      });
    } else {
      form.reset({
        project_id: "",
        inspection_type: "",
        inspection_date: format(new Date(), "yyyy-MM-dd"),
        status: "scheduled",
        overall_score: undefined,
        findings: "",
        hazards_identified: "",
        corrective_actions: "",
        follow_up_required: false,
        follow_up_date: "",
      });
    }
  }, [inspection, form]);

  const onSubmit = async (data: FormData) => {
    try {
      if (inspection) {
        await updateInspection.mutateAsync({
          id: inspection.id,
          ...data,
          inspection_type: data.inspection_type as any,
        });
      } else {
        await createInspection.mutateAsync({
          project_id: data.project_id,
          inspection_date: data.inspection_date,
          inspection_type: data.inspection_type as any,
        });
      }
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving inspection:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {inspection ? "Edit Safety Inspection" : "New Safety Inspection"}
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
                name="inspection_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Inspection Type *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {SAFETY_INSPECTION_TYPES.map((type) => (
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

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="inspection_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Inspection Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
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
                        {SAFETY_INSPECTION_STATUSES.map((s) => (
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

              <FormField
                control={form.control}
                name="overall_score"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Overall Score (0-100)</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" max="100" placeholder="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="findings"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Findings</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Inspection findings" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="hazards_identified"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hazards Identified</FormLabel>
                  <FormControl>
                    <Textarea placeholder="List any hazards identified" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="corrective_actions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Corrective Actions</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Required corrective actions" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4 items-end">
              <FormField
                control={form.control}
                name="follow_up_required"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Follow-up Required</FormLabel>
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="follow_up_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Follow-up Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createInspection.isPending || updateInspection.isPending}>
                {inspection ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
