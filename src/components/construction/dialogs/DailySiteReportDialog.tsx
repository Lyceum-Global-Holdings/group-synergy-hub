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
import { useCreateDailySiteReport, useUpdateDailySiteReport } from "@/hooks/construction/useDailySiteReports";
import { DailySiteReport, WEATHER_CONDITIONS } from "@/types/construction";
import { useEffect } from "react";
import { format } from "date-fns";

const formSchema = z.object({
  project_id: z.string().min(1, "Project is required"),
  report_date: z.string().min(1, "Report date is required"),
  weather_conditions: z.string().optional(),
  temperature_high: z.coerce.number().optional(),
  temperature_low: z.coerce.number().optional(),
  labor_count: z.coerce.number().optional(),
  subcontractor_count: z.coerce.number().optional(),
  visitor_count: z.coerce.number().optional(),
  work_summary: z.string().optional(),
  delays_issues: z.string().optional(),
  materials_received: z.string().optional(),
  equipment_on_site: z.string().optional(),
  safety_observations: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface DailySiteReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  report?: DailySiteReport | null;
}

export function DailySiteReportDialog({ open, onOpenChange, report }: DailySiteReportDialogProps) {
  const { data: projects } = useProjects();
  const createReport = useCreateDailySiteReport();
  const updateReport = useUpdateDailySiteReport();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      project_id: "",
      report_date: format(new Date(), "yyyy-MM-dd"),
      weather_conditions: "",
      labor_count: 0,
      subcontractor_count: 0,
      visitor_count: 0,
      work_summary: "",
      delays_issues: "",
      materials_received: "",
      equipment_on_site: "",
      safety_observations: "",
    },
  });

  useEffect(() => {
    if (report) {
      form.reset({
        project_id: report.project_id,
        report_date: report.report_date,
        weather_conditions: report.weather_conditions || "",
        temperature_high: report.temperature_high || undefined,
        temperature_low: report.temperature_low || undefined,
        labor_count: report.labor_count || 0,
        subcontractor_count: report.subcontractor_count || 0,
        visitor_count: report.visitor_count || 0,
        work_summary: report.work_summary || "",
        delays_issues: report.delays_issues || "",
        materials_received: report.materials_received || "",
        equipment_on_site: report.equipment_on_site || "",
        safety_observations: report.safety_observations || "",
      });
    } else {
      form.reset({
        project_id: "",
        report_date: format(new Date(), "yyyy-MM-dd"),
        weather_conditions: "",
        labor_count: 0,
        subcontractor_count: 0,
        visitor_count: 0,
        work_summary: "",
        delays_issues: "",
        materials_received: "",
        equipment_on_site: "",
        safety_observations: "",
      });
    }
  }, [report, form]);

  const onSubmit = async (data: FormData) => {
    try {
      if (report) {
        await updateReport.mutateAsync({ id: report.id, ...data });
      } else {
        await createReport.mutateAsync({ project_id: data.project_id, report_date: data.report_date, ...data });
      }
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving report:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {report ? "Edit Daily Site Report" : "New Daily Site Report"}
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
                name="report_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Report Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="weather_conditions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Weather</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select weather" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {WEATHER_CONDITIONS.map((w) => (
                          <SelectItem key={w} value={w}>
                            {w}
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
                name="temperature_high"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>High Temp (°F)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="temperature_low"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Low Temp (°F)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="labor_count"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Labor Count</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="subcontractor_count"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subcontractors</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="visitor_count"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Visitors</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="work_summary"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Work Summary</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Summary of work performed today" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="delays_issues"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Delays/Issues</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Any delays or issues encountered" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="safety_observations"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Safety Observations</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Safety observations" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createReport.isPending || updateReport.isPending}>
                {report ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
