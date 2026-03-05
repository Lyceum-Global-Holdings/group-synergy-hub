import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/contexts/CompanyContext";
import type { DailySiteReport, CreateDailySiteReportData, UpdateDailySiteReportData, SiteReportActivity } from "@/types/construction";
import { format, parseISO, differenceInDays } from "date-fns";

export type ReportPeriodType = 'daily' | 'weekly' | 'monthly';

type DailySiteReportWithProject = Omit<DailySiteReport, 'project'> & {
  project?: { id: string; project_name: string; project_code: string } | null;
  activities?: SiteReportActivity[];
  report_type?: ReportPeriodType;
  period_start_date?: string | null;
  period_end_date?: string | null;
};

export function useDailySiteReports(projectId?: string, reportType?: ReportPeriodType) {
  const { selectedCompany } = useCompany();

  return useQuery({
    queryKey: ["daily-site-reports", selectedCompany?.id, projectId, reportType],
    queryFn: async () => {
      let query = supabase
        .from("daily_site_reports")
        .select(`
          *,
          project:construction_projects(id, project_name, project_code),
          activities:site_report_activities(*)
        `)
        .order("report_date", { ascending: false });

      if (selectedCompany?.id) {
        query = query.eq("company_id", selectedCompany.id);
      }

      if (projectId) {
        query = query.eq("project_id", projectId);
      }

      if (reportType) {
        query = query.eq("report_type", reportType);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as DailySiteReportWithProject[];
    },
    enabled: !!selectedCompany?.id,
  });
}

export function useCreateDailySiteReport() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { selectedCompany } = useCompany();

  return useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const { data: user } = await supabase.auth.getUser();

      // Generate report_number: DSR-YYYYMMDD-XXXX
      const datePart = (data.report_date || format(new Date(), "yyyy-MM-dd")).replace(/-/g, "");
      const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
      const reportNumber = `DSR-${datePart}-${randomSuffix}`;

      const insertData: Record<string, any> = {
        project_id: data.project_id,
        report_date: data.report_date,
        report_number: reportNumber,
        company_id: selectedCompany?.id,
        submitted_by: user.user?.id,
        status: "draft",
      };

      // Map optional fields
      if (data.location_id) insertData.location_id = data.location_id;
      if (data.weather_conditions) insertData.weather_conditions = data.weather_conditions;
      if (data.temperature_high != null) insertData.temperature_high = data.temperature_high;
      if (data.temperature_low != null) insertData.temperature_low = data.temperature_low;
      if (data.skilled_labor_count != null) insertData.skilled_labor_count = data.skilled_labor_count;
      if (data.unskilled_labor_count != null) insertData.unskilled_labor_count = data.unskilled_labor_count;
      if (data.subcontractor_count != null) insertData.subcontractor_count = data.subcontractor_count;
      if (data.visitor_count != null) insertData.visitor_count = data.visitor_count;
      if (data.work_summary) insertData.work_summary = data.work_summary;
      if (data.delays_issues) insertData.delays_issues = data.delays_issues;
      if (data.materials_received) insertData.materials_received = data.materials_received;
      if (data.equipment_on_site) insertData.equipment_on_site = data.equipment_on_site;
      if (data.safety_observations) insertData.safety_observations = data.safety_observations;

      const { data: result, error } = await supabase
        .from("daily_site_reports")
        .insert(insertData as any)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["daily-site-reports"] });
      toast({ title: "Daily site report created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error creating report", description: error.message, variant: "destructive" });
    },
  });
}

export function useUpdateDailySiteReport() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...data }: UpdateDailySiteReportData & { id: string }) => {
      const { data: result, error } = await supabase
        .from("daily_site_reports")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["daily-site-reports"] });
      toast({ title: "Report updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error updating report", description: error.message, variant: "destructive" });
    },
  });
}

export function useDeleteDailySiteReport() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("daily_site_reports")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["daily-site-reports"] });
      toast({ title: "Report deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error deleting report", description: error.message, variant: "destructive" });
    },
  });
}

// Site Report Activities
export function useCreateReportActivity() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: Omit<SiteReportActivity, "id" | "created_at">) => {
      const { data: result, error } = await supabase
        .from("site_report_activities")
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["daily-site-reports"] });
      toast({ title: "Activity added successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error adding activity", description: error.message, variant: "destructive" });
    },
  });
}

// Generate site reports for daily, weekly, or monthly periods
interface GenerateReportParams {
  projectId: string;
  reportType: ReportPeriodType;
  startDate: string;
  endDate: string;
}

export function useGenerateSiteReports() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { selectedCompany } = useCompany();

  return useMutation({
    mutationFn: async ({ projectId, reportType, startDate, endDate }: GenerateReportParams) => {
      const { data: user } = await supabase.auth.getUser();

      if (!selectedCompany?.id) {
        throw new Error("No company selected");
      }

      // Check if a report already exists for this period and project
      const { data: existingReports, error: existingError } = await supabase
        .from("daily_site_reports")
        .select("id, report_number")
        .eq("company_id", selectedCompany.id)
        .eq("project_id", projectId)
        .eq("report_type", reportType)
        .eq("period_start_date", startDate)
        .eq("period_end_date", endDate);

      if (existingError) throw existingError;

      if (existingReports && existingReports.length > 0) {
        throw new Error(`A ${reportType} report already exists for this period (${existingReports[0].report_number})`);
      }

      // Get project details
      const { data: project, error: projectError } = await supabase
        .from("construction_projects")
        .select("id, project_name, project_code")
        .eq("id", projectId)
        .single();

      if (projectError || !project) {
        throw new Error("Project not found");
      }

      // Get floor drawings for this project
      const { data: floors } = await supabase
        .from("project_floor_drawings")
        .select("id, drawing_name")
        .eq("project_id", projectId);

      let issuedCount = 0;
      let returnedCount = 0;
      let issuedValue = 0;
      let returnedValue = 0;
      const floorSummaries: { name: string; issued: number; returned: number }[] = [];

      if (floors && floors.length > 0) {
        const floorIds = floors.map(f => f.id);

        // Get rooms for these floors
        const { data: rooms } = await supabase
          .from("floor_drawing_rooms")
          .select("id, room_name, floor_drawing_id")
          .in("floor_drawing_id", floorIds);

        if (rooms && rooms.length > 0) {
          const roomIds = rooms.map(r => r.id);

          // Get material transactions for the period
          const { data: transactions } = await supabase
            .from("floor_room_material_transactions")
            .select("id, transaction_type, quantity, total_value, room_id")
            .in("room_id", roomIds)
            .gte("created_at", `${startDate}T00:00:00`)
            .lte("created_at", `${endDate}T23:59:59.999`);

          if (transactions && transactions.length > 0) {
            // Create a map of room_id to floor
            const roomToFloor = new Map<string, { id: string; name: string }>();
            rooms.forEach(room => {
              const floor = floors.find(f => f.id === room.floor_drawing_id);
              if (floor) {
                roomToFloor.set(room.id, { id: floor.id, name: floor.drawing_name });
              }
            });

            // Aggregate by floor
            const floorData = new Map<string, { name: string; issued: number; returned: number }>();

            transactions.forEach(t => {
              const floor = roomToFloor.get(t.room_id);
              if (floor) {
                if (!floorData.has(floor.id)) {
                  floorData.set(floor.id, { name: floor.name, issued: 0, returned: 0 });
                }
                const data = floorData.get(floor.id)!;
                if (t.transaction_type === 'issue') {
                  data.issued += t.quantity || 0;
                  issuedCount += t.quantity || 0;
                  issuedValue += t.total_value || 0;
                } else if (t.transaction_type === 'return') {
                  data.returned += t.quantity || 0;
                  returnedCount += t.quantity || 0;
                  returnedValue += t.total_value || 0;
                }
              }
            });

            floorData.forEach((data) => {
              floorSummaries.push(data);
            });
          }
        }
      }

      // Generate report number based on type
      const reportDate = parseISO(startDate);
      const typePrefix = reportType === 'daily' ? 'DSR' : reportType === 'weekly' ? 'WSR' : 'MSR';
      const dateSuffix = reportType === 'monthly' 
        ? format(reportDate, 'yyyyMM')
        : format(reportDate, 'yyyyMMdd');
      const reportNumber = `${typePrefix}-${project.project_code}-${dateSuffix}`;

      // Calculate period days for summary
      const periodDays = differenceInDays(parseISO(endDate), parseISO(startDate)) + 1;

      const materialsReceived = issuedCount > 0 || returnedCount > 0
        ? `Issued: ${issuedCount} items, Returned: ${returnedCount} items`
        : "No material activity";

      // Create the report with empty work_summary for user to fill in
      const { data: newReport, error: insertError } = await supabase
        .from("daily_site_reports")
        .insert({
          report_number: reportNumber,
          project_id: projectId,
          report_date: startDate,
          report_type: reportType,
          period_start_date: startDate,
          period_end_date: endDate,
          status: "draft",
          work_summary: null,
          materials_received: materialsReceived,
          company_id: selectedCompany.id,
          submitted_by: user.user?.id,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      return {
        report: newReport,
        summary: {
          issuedCount,
          returnedCount,
          issuedValue,
          returnedValue,
          floorCount: floorSummaries.length,
          periodDays,
        },
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["daily-site-reports"] });
      toast({ 
        title: "Report Generated", 
        description: `${result.report.report_number} created with ${result.summary.issuedCount} issued and ${result.summary.returnedCount} returned items`,
      });
    },
    onError: (error: Error) => {
      toast({ title: "Error generating report", description: error.message, variant: "destructive" });
    },
  });
}
