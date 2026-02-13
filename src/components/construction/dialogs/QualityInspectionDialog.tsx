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
import { useCreateQualityInspection, useUpdateQualityInspection } from "@/hooks/construction/useQualityInspections";
import { QualityInspection, QUALITY_INSPECTION_TYPES, QUALITY_INSPECTION_STATUSES, INSPECTION_RESULTS } from "@/types/construction";
import { useEffect } from "react";
import { format } from "date-fns";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "sonner";

const formSchema = z.object({
  project_id: z.string().min(1, "Project is required"),
  inspection_type: z.string().min(1, "Inspection type is required"),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  inspection_date: z.string().min(1, "Inspection date is required"),
  status: z.string().optional(),
  overall_result: z.string().optional(),
  findings: z.string().optional(),
  corrective_actions: z.string().optional(),
  follow_up_date: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface QualityInspectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inspection?: QualityInspection | null;
}

export function QualityInspectionDialog({ open, onOpenChange, inspection }: QualityInspectionDialogProps) {
  const { data: projects } = useProjects();
  const { selectedCompany } = useCompany();
  const createInspection = useCreateQualityInspection();
  const updateInspection = useUpdateQualityInspection();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      project_id: "",
      inspection_type: "",
      title: "",
      description: "",
      inspection_date: format(new Date(), "yyyy-MM-dd"),
      status: "scheduled",
      overall_result: "",
      findings: "",
      corrective_actions: "",
      follow_up_date: "",
    },
  });

  useEffect(() => {
    if (inspection) {
      form.reset({
        project_id: inspection.project_id,
        inspection_type: inspection.inspection_type,
        title: inspection.title,
        description: inspection.description || "",
        inspection_date: inspection.inspection_date,
        status: inspection.status,
        overall_result: inspection.overall_result || "",
        findings: inspection.findings || "",
        corrective_actions: inspection.corrective_actions || "",
        follow_up_date: inspection.follow_up_date || "",
      });
    } else {
      form.reset({
        project_id: "",
        inspection_type: "",
        title: "",
        description: "",
        inspection_date: format(new Date(), "yyyy-MM-dd"),
        status: "scheduled",
        overall_result: "",
        findings: "",
        corrective_actions: "",
        follow_up_date: "",
      });
    }
  }, [inspection, form]);

  const onSubmit = async (data: FormData) => {
    if (!inspection && !selectedCompany?.id) {
      toast.error("Please select a company before creating an inspection");
      return;
    }
    
    try {
      const payload = {
        project_id: data.project_id,
        title: data.title,
        inspection_date: data.inspection_date,
        inspection_type: data.inspection_type as any,
        description: data.description || undefined,
        status: data.status as any || undefined,
        overall_result: data.overall_result as any || undefined,
        findings: data.findings || undefined,
        corrective_actions: data.corrective_actions || undefined,
        follow_up_date: data.follow_up_date || null,
      };
      
      if (inspection) {
        await updateInspection.mutateAsync({
          id: inspection.id,
          ...payload,
        });
      } else {
        await createInspection.mutateAsync(payload);
      }
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving inspection:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {inspection ? "Edit Quality Inspection" : "New Quality Inspection"}
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
                        {QUALITY_INSPECTION_TYPES.map((type) => (
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
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title *</FormLabel>
                  <FormControl>
                    <Input placeholder="Inspection title" {...field} />
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
                        {QUALITY_INSPECTION_STATUSES.map((s) => (
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
                name="overall_result"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Result</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select result" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {INSPECTION_RESULTS.map((r) => (
                          <SelectItem key={r.value} value={r.value}>
                            {r.label}
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
