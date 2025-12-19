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
import { useCreateSafetyIncident, useUpdateSafetyIncident } from "@/hooks/construction/useSafetyManagement";
import { SafetyIncident, INCIDENT_TYPES, INCIDENT_SEVERITIES, INCIDENT_STATUSES } from "@/types/construction";
import { useEffect } from "react";
import { format } from "date-fns";

const formSchema = z.object({
  project_id: z.string().min(1, "Project is required"),
  incident_type: z.string().min(1, "Incident type is required"),
  severity: z.string().optional(),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  incident_date: z.string().min(1, "Incident date is required"),
  incident_time: z.string().optional(),
  location: z.string().optional(),
  injured_party: z.string().optional(),
  injury_description: z.string().optional(),
  immediate_actions: z.string().optional(),
  root_cause: z.string().optional(),
  corrective_actions: z.string().optional(),
  preventive_actions: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface SafetyIncidentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  incident?: SafetyIncident | null;
}

export function SafetyIncidentDialog({ open, onOpenChange, incident }: SafetyIncidentDialogProps) {
  const { data: projects } = useProjects();
  const createIncident = useCreateSafetyIncident();
  const updateIncident = useUpdateSafetyIncident();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      project_id: "",
      incident_type: "",
      severity: "low",
      title: "",
      description: "",
      incident_date: format(new Date(), "yyyy-MM-dd"),
      incident_time: "",
      location: "",
      injured_party: "",
      injury_description: "",
      immediate_actions: "",
      root_cause: "",
      corrective_actions: "",
      preventive_actions: "",
    },
  });

  useEffect(() => {
    if (incident) {
      form.reset({
        project_id: incident.project_id,
        incident_type: incident.incident_type,
        severity: incident.severity,
        title: incident.title,
        description: incident.description || "",
        incident_date: incident.incident_date,
        incident_time: incident.incident_time || "",
        location: incident.location || "",
        injured_party: incident.injured_party || "",
        injury_description: incident.injury_description || "",
        immediate_actions: incident.immediate_actions || "",
        root_cause: incident.root_cause || "",
        corrective_actions: incident.corrective_actions || "",
        preventive_actions: incident.preventive_actions || "",
      });
    } else {
      form.reset({
        project_id: "",
        incident_type: "",
        severity: "low",
        title: "",
        description: "",
        incident_date: format(new Date(), "yyyy-MM-dd"),
        incident_time: "",
        location: "",
        injured_party: "",
        injury_description: "",
        immediate_actions: "",
        root_cause: "",
        corrective_actions: "",
        preventive_actions: "",
      });
    }
  }, [incident, form]);

  const onSubmit = async (data: FormData) => {
    try {
      if (incident) {
        await updateIncident.mutateAsync({
          id: incident.id,
          ...data,
          incident_type: data.incident_type as any,
          severity: data.severity as any,
        });
      } else {
        await createIncident.mutateAsync({
          project_id: data.project_id,
          title: data.title,
          incident_date: data.incident_date,
          incident_type: data.incident_type as any,
          severity: data.severity as any,
          description: data.description,
          incident_time: data.incident_time,
          location: data.location,
          injured_party: data.injured_party,
          injury_description: data.injury_description,
          immediate_actions: data.immediate_actions,
        });
      }
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving incident:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {incident ? "Edit Safety Incident" : "Report Safety Incident"}
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
                name="incident_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Incident Type *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {INCIDENT_TYPES.map((type) => (
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
                    <Input placeholder="Brief description of incident" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="severity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Severity</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select severity" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {INCIDENT_SEVERITIES.map((s) => (
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
                name="incident_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Incident Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="incident_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Incident Time</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <FormControl>
                    <Input placeholder="Where did the incident occur?" {...field} />
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
                    <Textarea placeholder="Detailed description of the incident" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="injured_party"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Injured Party</FormLabel>
                    <FormControl>
                      <Input placeholder="Name of injured person (if any)" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="injury_description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Injury Description</FormLabel>
                    <FormControl>
                      <Input placeholder="Type of injury" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="immediate_actions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Immediate Actions Taken</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Actions taken immediately after the incident" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createIncident.isPending || updateIncident.isPending}>
                {incident ? "Update" : "Report"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
