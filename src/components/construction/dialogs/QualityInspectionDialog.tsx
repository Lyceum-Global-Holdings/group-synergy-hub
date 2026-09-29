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
import { QualityInspection, QUALITY_INSPECTION_TYPES } from "@/types/construction";
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
      });
    } else {
      form.reset({
        project_id: "",
        inspection_type: "",
        title: "",
        description: "",
        inspection_date: format(new Date(), "yyyy-MM-dd"),
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
