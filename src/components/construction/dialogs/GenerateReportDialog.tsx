import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProjects } from "@/hooks/construction/useProjects";
import { useGenerateSiteReports } from "@/hooks/construction/useDailySiteReports";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { Calendar, FileText, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const formSchema = z.object({
  report_type: z.enum(["daily", "weekly", "monthly"]),
  project_id: z.string().min(1, "Project is required"),
  date: z.string().min(1, "Date is required"),
});

type FormData = z.infer<typeof formSchema>;

interface GenerateReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GenerateReportDialog({ open, onOpenChange }: GenerateReportDialogProps) {
  const { data: projects, isLoading: projectsLoading } = useProjects();
  const generateReports = useGenerateSiteReports();
  const [dateRange, setDateRange] = useState<{ start: string; end: string } | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      report_type: "daily",
      project_id: "",
      date: format(new Date(), "yyyy-MM-dd"),
    },
  });

  const reportType = form.watch("report_type");
  const selectedDate = form.watch("date");

  // Calculate date range based on report type
  const calculateDateRange = (type: string, dateStr: string) => {
    if (!dateStr) return null;
    const date = parseISO(dateStr);
    
    switch (type) {
      case "daily":
        return { start: dateStr, end: dateStr };
      case "weekly":
        return {
          start: format(startOfWeek(date, { weekStartsOn: 1 }), "yyyy-MM-dd"),
          end: format(endOfWeek(date, { weekStartsOn: 1 }), "yyyy-MM-dd"),
        };
      case "monthly":
        return {
          start: format(startOfMonth(date), "yyyy-MM-dd"),
          end: format(endOfMonth(date), "yyyy-MM-dd"),
        };
      default:
        return null;
    }
  };

  // Update date range when type or date changes
  const updateDateRange = () => {
    const range = calculateDateRange(reportType, selectedDate);
    setDateRange(range);
  };

  // Watch for changes
  form.watch(() => updateDateRange());

  const onSubmit = async (data: FormData) => {
    const range = calculateDateRange(data.report_type, data.date);
    if (!range) return;

    await generateReports.mutateAsync({
      projectId: data.project_id,
      reportType: data.report_type,
      startDate: range.start,
      endDate: range.end,
    });

    onOpenChange(false);
    form.reset();
  };

  const getDateLabel = () => {
    switch (reportType) {
      case "daily":
        return "Select Date";
      case "weekly":
        return "Select Week (any day in the week)";
      case "monthly":
        return "Select Month (any day in the month)";
      default:
        return "Select Date";
    }
  };

  const range = calculateDateRange(reportType, selectedDate);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Generate Site Report
          </DialogTitle>
          <DialogDescription>
            Create a report for the selected period with material activity summary
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="report_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Report Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select report type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="daily">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Daily</Badge>
                          <span className="text-muted-foreground text-sm">Single day report</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="weekly">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Weekly</Badge>
                          <span className="text-muted-foreground text-sm">7-day summary</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="monthly">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">Monthly</Badge>
                          <span className="text-muted-foreground text-sm">Full month summary</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="project_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={projectsLoading}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={projectsLoading ? "Loading..." : "Select project"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {projects?.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{project.project_code}</span>
                            <span className="text-muted-foreground">- {project.project_name}</span>
                          </div>
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
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{getDateLabel()}</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {range && (
              <div className="p-3 rounded-lg bg-muted/50 border">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Report Period:</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {reportType === "daily" ? (
                    format(parseISO(range.start), "MMMM d, yyyy")
                  ) : (
                    <>
                      {format(parseISO(range.start), "MMM d, yyyy")} — {format(parseISO(range.end), "MMM d, yyyy")}
                    </>
                  )}
                </p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={generateReports.isPending}>
                {generateReports.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  "Generate Report"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
