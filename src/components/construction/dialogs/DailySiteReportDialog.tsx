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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { useProjects } from "@/hooks/construction/useProjects";
import { useCreateDailySiteReport, useUpdateDailySiteReport } from "@/hooks/construction/useDailySiteReports";
import { useDailyMaterialsActivity } from "@/hooks/construction/useDailyMaterialsActivity";
import { useConstructionSites } from "@/hooks/construction/useConstructionSites";
import { useWarehouseLocations } from "@/hooks/useWarehouseLocations";
import { DailySiteReport, WEATHER_CONDITIONS } from "@/types/construction";
import { useEffect, useState, useCallback } from "react";
import { format } from "date-fns";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "sonner";
import { Package, RotateCcw, Loader2, SlidersHorizontal, Wrench, Users, AlertCircle } from "lucide-react";
import { LabourAttendanceSection, type AttendanceSummary } from "@/components/construction/labour/LabourAttendanceSection";

const formSchema = z.object({
  project_id: z.string().min(1, "Project is required"),
  report_date: z.string().min(1, "Report date is required"),
  location_id: z.string().optional(),
  weather_conditions: z.string().optional(),
  temperature_high: z.coerce.number().optional(),
  temperature_low: z.coerce.number().optional(),
  skilled_labor_count: z.coerce.number().min(0, "Cannot be negative").optional(),
  unskilled_labor_count: z.coerce.number().min(0, "Cannot be negative").optional(),
  subcontractor_count: z.coerce.number().min(0, "Cannot be negative").optional(),
  visitor_count: z.coerce.number().min(0, "Cannot be negative").optional(),
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
  const { data: projects, isLoading: projectsLoading } = useProjects();
  const { selectedCompany } = useCompany();
  const { locations } = useWarehouseLocations();
  const { data: constructionSites } = useConstructionSites();
  const createReport = useCreateDailySiteReport();
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummary | null>(null);

  // Filter locations to show only project sites - combine warehouse locations and construction sites
  const siteLocations = locations?.filter(loc => loc.type === 'location') || [];
  const updateReport = useUpdateDailySiteReport();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      project_id: "",
      report_date: format(new Date(), "yyyy-MM-dd"),
      location_id: "",
      weather_conditions: "",
      skilled_labor_count: 0,
      unskilled_labor_count: 0,
      subcontractor_count: 0,
      visitor_count: 0,
      work_summary: "",
      delays_issues: "",
      materials_received: "",
      equipment_on_site: "",
      safety_observations: "",
    },
  });

  const watchedLocationId = form.watch("location_id");

  const handleAttendanceChange = useCallback((summary: AttendanceSummary) => {
    setAttendanceSummary(summary);
    // Auto-update labour counts from attendance
    if (summary.present > 0) {
      // Calculate skilled/unskilled from category breakdown
      const skilledCount = summary.categoryBreakdown["Civil Skill"] || 0;
      const unskilledCount = summary.categoryBreakdown["Civil Labour (Unskill)"] || 0;
      form.setValue("skilled_labor_count", skilledCount);
      form.setValue("unskilled_labor_count", unskilledCount);
    }
  }, [form]);

  const watchedDate = form.watch("report_date");
  const { issues, returns, adjustments, isLoading: materialsLoading } = useDailyMaterialsActivity(watchedDate);

  useEffect(() => {
    if (report) {
      form.reset({
        project_id: report.project_id,
        report_date: report.report_date,
        location_id: (report as any).location_id || "",
        weather_conditions: report.weather_conditions || "",
        temperature_high: report.temperature_high || undefined,
        temperature_low: report.temperature_low || undefined,
        skilled_labor_count: (report as any).skilled_labor_count || 0,
        unskilled_labor_count: (report as any).unskilled_labor_count || 0,
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
        location_id: "",
        weather_conditions: "",
        skilled_labor_count: 0,
        unskilled_labor_count: 0,
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
    if (!report && !selectedCompany?.id) {
      toast.error("Please select a company before creating a report");
      return;
    }
    
    try {
      const payload: Record<string, any> = {
        project_id: data.project_id,
        report_date: data.report_date,
        location_id: data.location_id || null,
        weather_conditions: data.weather_conditions || null,
        temperature_high: data.temperature_high || null,
        temperature_low: data.temperature_low || null,
        skilled_labor_count: data.skilled_labor_count || null,
        unskilled_labor_count: data.unskilled_labor_count || null,
        subcontractor_count: data.subcontractor_count || null,
        visitor_count: data.visitor_count || null,
        work_summary: data.work_summary || null,
        delays_issues: data.delays_issues || null,
        materials_received: data.materials_received || null,
        equipment_on_site: data.equipment_on_site || null,
        safety_observations: data.safety_observations || null,
      };
      
      if (report) {
        await updateReport.mutateAsync({ id: report.id, ...payload });
      } else {
        await createReport.mutateAsync(payload);
      }
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving report:", error);
    }
  };

  const formattedDate = watchedDate ? format(new Date(watchedDate), "MMM dd, yyyy") : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
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
                    <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={projectsLoading ? "Loading projects..." : "Select project"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="z-[200]">
                        {projects && projects.length > 0 ? (
                          projects.map((project) => (
                            <SelectItem key={project.id} value={project.id}>
                              {project.project_name}
                            </SelectItem>
                          ))
                        ) : (
                          <div className="px-3 py-2 text-sm text-muted-foreground">
                            {projectsLoading ? "Loading..." : "No projects found"}
                          </div>
                        )}
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

              <FormField
                control={form.control}
                name="location_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location / Site</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select location" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="z-[200]">
                        {siteLocations.map((location) => (
                          <SelectItem key={location.id} value={location.id}>
                            {location.name} {location.location_code ? `(${location.location_code})` : ""}
                          </SelectItem>
                        ))}
                        {constructionSites && constructionSites.map((site) => (
                          <SelectItem key={site.id} value={site.id}>
                            {site.site_name} {site.site_code ? `(${site.site_code})` : ""}
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
                      <SelectContent className="z-[200]">
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

            <div className="grid grid-cols-4 gap-4">
              <FormField
                control={form.control}
                name="skilled_labor_count"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Skilled Labor</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} placeholder="0" {...field} />

                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="unskilled_labor_count"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Non-Skilled Labor</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} placeholder="0" {...field} />

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
                      <Input type="number" min={0} placeholder="0" {...field} />

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

            {/* Items Issued Section - Regular Items (non-contractor) */}
            {(() => {
              const regularIssues = issues.filter(i => i.supplier_type !== 'contractor');
              const contractorIssues = issues.filter(i => i.supplier_type === 'contractor');
              
              return (
                <>
                  <div className="border rounded-lg p-4 bg-muted/30">
                    <div className="flex items-center gap-2 mb-3">
                      <Package className="h-4 w-4 text-primary" />
                      <h3 className="font-medium">Items Issued on {formattedDate}</h3>
                      {materialsLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                    </div>
                    {regularIssues.length > 0 ? (
                      <div className="rounded-md border bg-background">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[100px]">Issue #</TableHead>
                              <TableHead>Item Code</TableHead>
                              <TableHead>Item Name</TableHead>
                              <TableHead className="text-right">Qty</TableHead>
                              <TableHead>Issued To</TableHead>
                              <TableHead>Item Master Notes</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {regularIssues.map((issue, idx) => (
                              <TableRow key={`${issue.min_number}-${idx}`}>
                                <TableCell className="font-mono text-xs">{issue.min_number}</TableCell>
                                <TableCell className="font-mono text-xs">{issue.item_code || "-"}</TableCell>
                                <TableCell>{issue.item_name}</TableCell>
                                <TableCell className="text-right">{issue.quantity_issued}</TableCell>
                                <TableCell>{issue.issued_to || "-"}</TableCell>
                                <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                                  {issue.item_master_notes || "-"}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No items issued on this date</p>
                    )}
                  </div>

                  {/* Contractor Supplied Items Section */}
                  <div className="border rounded-lg p-4 bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900">
                    <div className="flex items-center gap-2 mb-3">
                      <Wrench className="h-4 w-4 text-orange-600" />
                      <h3 className="font-medium text-orange-800 dark:text-orange-300">Contractor Supplied Items on {formattedDate}</h3>
                      {materialsLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                    </div>
                    {contractorIssues.length > 0 ? (
                      <div className="rounded-md border bg-background">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[100px]">Issue #</TableHead>
                              <TableHead>Item Code</TableHead>
                              <TableHead>Item Name</TableHead>
                              <TableHead className="text-right">Qty</TableHead>
                              <TableHead>Supplier</TableHead>
                              <TableHead>Issued To</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {contractorIssues.map((issue, idx) => (
                              <TableRow key={`contractor-${issue.min_number}-${idx}`}>
                                <TableCell className="font-mono text-xs">{issue.min_number}</TableCell>
                                <TableCell className="font-mono text-xs">{issue.item_code || "-"}</TableCell>
                                <TableCell>{issue.item_name}</TableCell>
                                <TableCell className="text-right">{issue.quantity_issued}</TableCell>
                                <TableCell className="text-orange-700 dark:text-orange-400">{issue.supplier_name || "-"}</TableCell>
                                <TableCell>{issue.issued_to || "-"}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No contractor supplied items on this date</p>
                    )}
                  </div>
                </>
              );
            })()}

            {/* Items Returned Section */}
            <div className="border rounded-lg p-4 bg-muted/30">
              <div className="flex items-center gap-2 mb-3">
                <RotateCcw className="h-4 w-4 text-primary" />
                <h3 className="font-medium">Items Returned on {formattedDate}</h3>
                {materialsLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </div>
              {returns.length > 0 ? (
                <div className="rounded-md border bg-background">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[100px]">Return #</TableHead>
                        <TableHead>Item Code</TableHead>
                        <TableHead>Item Name</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead>Returned By</TableHead>
                        <TableHead>Condition</TableHead>
                        <TableHead>Item Master Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {returns.map((ret, idx) => (
                        <TableRow key={`${ret.mrn_number}-${idx}`}>
                          <TableCell className="font-mono text-xs">{ret.mrn_number}</TableCell>
                          <TableCell className="font-mono text-xs">{ret.item_code || "-"}</TableCell>
                          <TableCell>{ret.item_name}</TableCell>
                          <TableCell className="text-right">{ret.quantity_returned}</TableCell>
                          <TableCell>{ret.returned_by || "-"}</TableCell>
                          <TableCell>{ret.condition || "-"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                            {ret.item_master_notes || "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No items returned on this date</p>
              )}
            </div>

            {/* Stock Adjustments Section */}
            <div className="border rounded-lg p-4 bg-muted/30">
              <div className="flex items-center gap-2 mb-3">
                <SlidersHorizontal className="h-4 w-4 text-primary" />
                <h3 className="font-medium">Stock Adjustments on {formattedDate}</h3>
                {materialsLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </div>
              {adjustments.length > 0 ? (
                <div className="rounded-md border bg-background">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item Code</TableHead>
                        <TableHead>Item Name</TableHead>
                        <TableHead>Supplier</TableHead>
                        <TableHead className="text-right">Change</TableHead>
                        <TableHead className="text-right">Before → After</TableHead>
                        <TableHead>Adjustment Notes</TableHead>
                        <TableHead>Item Master Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {adjustments.map((adj, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-mono text-xs">{adj.item_code || "-"}</TableCell>
                          <TableCell>{adj.item_name}</TableCell>
                          <TableCell className="text-sm">{adj.supplier_name || "-"}</TableCell>
                          <TableCell className={`text-right font-medium ${adj.quantity_change > 0 ? "text-green-600" : adj.quantity_change < 0 ? "text-red-600" : ""}`}>
                            {adj.quantity_change > 0 ? "+" : ""}{adj.quantity_change}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {adj.quantity_before} → {adj.quantity_after}
                          </TableCell>
                          <TableCell className="text-sm max-w-[150px] truncate">
                            {adj.adjustment_notes || "-"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">
                            {adj.item_master_notes || "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No stock adjustments on this date</p>
              )}
            </div>

            {/* Labour Attendance Section */}
            <div className="border rounded-lg p-4 bg-muted/30">
              <div className="flex items-center gap-2 mb-3">
                <Users className="h-4 w-4 text-primary" />
                <h3 className="font-medium">Labour Attendance</h3>
              </div>
              {report ? (
                <LabourAttendanceSection
                  report={report}
                  locationId={watchedLocationId || null}
                  isEditing={true}
                  onAttendanceChange={handleAttendanceChange}
                />
              ) : (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
                  <AlertCircle className="h-4 w-4" />
                  <span>Labour attendance tracking will be available after saving the report. Create the report first, then edit it to manage attendance.</span>
                </div>
              )}
            </div>

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
