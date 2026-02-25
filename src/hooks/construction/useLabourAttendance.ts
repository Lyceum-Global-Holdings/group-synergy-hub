import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/contexts/CompanyContext";
import type { 
  LabourAttendance, 
  CreateLabourAttendanceData, 
  UpdateLabourAttendanceData,
  LabourMaster 
} from "@/types/construction";

export interface LabourAttendanceWithLabour extends LabourAttendance {
  labour: LabourMaster;
}

export function useLabourAttendance(siteReportId: string | null | undefined) {
  return useQuery({
    queryKey: ["labour-attendance", siteReportId],
    queryFn: async () => {
      if (!siteReportId) return [];

      const { data, error } = await supabase
        .from("site_report_labour_attendance")
        .select(`
          *,
          labour:construction_labour_directory(*)
        `)
        .eq("site_report_id", siteReportId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as LabourAttendanceWithLabour[];
    },
    enabled: !!siteReportId,
  });
}

export function useLaboursByLocation(
  locationId: string | null | undefined,
  companyId?: string | null
) {
  const { selectedCompany } = useCompany();
  const effectiveCompanyId = companyId ?? selectedCompany?.id ?? null;

  return useQuery({
    queryKey: ["labours-by-location", locationId, effectiveCompanyId],
    queryFn: async () => {
      if (!locationId) return [];

      let query = supabase
        .from("construction_labour_directory")
        .select("*")
        .eq("location_id", locationId)
        .eq("status", "active")
        .order("name", { ascending: true });

      if (effectiveCompanyId) {
        query = query.or(`company_id.eq.${effectiveCompanyId},company_id.is.null`);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as LabourMaster[];
    },
    enabled: !!locationId,
  });
}

export function useCreateLabourAttendance() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { selectedCompany } = useCompany();

  return useMutation({
    mutationFn: async (data: CreateLabourAttendanceData) => {
      const { data: user } = await supabase.auth.getUser();
      
      const { data: result, error } = await supabase
        .from("site_report_labour_attendance")
        .insert({
          ...data,
          company_id: selectedCompany?.id,
          created_by: user.user?.id,
        })
        .select(`
          *,
          labour:construction_labour_directory(*)
        `)
        .single();

      if (error) throw error;
      return result as LabourAttendanceWithLabour;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["labour-attendance", data.site_report_id] });
    },
    onError: (error: Error) => {
      toast({ title: "Error recording attendance", description: error.message, variant: "destructive" });
    },
  });
}

export function useUpdateLabourAttendance() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...data }: UpdateLabourAttendanceData & { id: string }) => {
      const { data: result, error } = await supabase
        .from("site_report_labour_attendance")
        .update(data)
        .eq("id", id)
        .select(`
          *,
          labour:construction_labour_directory(*)
        `)
        .single();

      if (error) throw error;
      return result as LabourAttendanceWithLabour;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["labour-attendance", data.site_report_id] });
    },
    onError: (error: Error) => {
      toast({ title: "Error updating attendance", description: error.message, variant: "destructive" });
    },
  });
}

export function useDeleteLabourAttendance() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, siteReportId }: { id: string; siteReportId: string }) => {
      const { error } = await supabase
        .from("site_report_labour_attendance")
        .delete()
        .eq("id", id);

      if (error) throw error;
      return { siteReportId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["labour-attendance", data.siteReportId] });
      toast({ title: "Attendance record removed" });
    },
    onError: (error: Error) => {
      toast({ title: "Error removing attendance", description: error.message, variant: "destructive" });
    },
  });
}

export function useUpsertLabourAttendance() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { selectedCompany } = useCompany();

  return useMutation({
    mutationFn: async (data: CreateLabourAttendanceData) => {
      const { data: user } = await supabase.auth.getUser();
      
      const { data: result, error } = await supabase
        .from("site_report_labour_attendance")
        .upsert(
          {
            ...data,
            company_id: selectedCompany?.id,
            created_by: user.user?.id,
          },
          { onConflict: "site_report_id,labour_id,attendance_date" }
        )
        .select(`
          *,
          labour:construction_labour_directory(*)
        `)
        .single();

      if (error) throw error;
      return result as LabourAttendanceWithLabour;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["labour-attendance", data.site_report_id] });
    },
    onError: (error: Error) => {
      toast({ title: "Error saving attendance", description: error.message, variant: "destructive" });
    },
  });
}

export function useBulkCreateAttendance() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { selectedCompany } = useCompany();

  return useMutation({
    mutationFn: async ({ 
      siteReportId, 
      locationId, 
      attendanceDate, 
      labourIds,
      companyId,
    }: {
      siteReportId: string;
      locationId: string;
      attendanceDate: string;
      labourIds: string[];
      companyId?: string | null;
    }) => {
      const { data: user } = await supabase.auth.getUser();
      const userId = user.user?.id;

      if (!userId) {
        throw new Error("You must be logged in to initialize attendance");
      }

      // Resolve company from the report first (source of truth for link-based flows)
      const { data: reportCompanyRow, error: reportCompanyError } = await supabase
        .from("daily_site_reports")
        .select("company_id")
        .eq("id", siteReportId)
        .maybeSingle();

      if (reportCompanyError) throw reportCompanyError;

      let resolvedCompanyId = reportCompanyRow?.company_id ?? companyId ?? selectedCompany?.id ?? null;

      // If company cannot be resolved, skip auto-initialization without throwing
      if (!resolvedCompanyId) {
        return [];
      }

      // Preflight access check to avoid RLS insert errors in shared-link/edit flows
      const [isSuperAdminResult, canAccessCompanyResult] = await Promise.all([
        supabase.rpc("is_super_admin", { _user_id: userId }),
        supabase.rpc("can_access_company", { target_company_id: resolvedCompanyId }),
      ]);

      if (isSuperAdminResult.error) throw isSuperAdminResult.error;
      if (canAccessCompanyResult.error) throw canAccessCompanyResult.error;

      const hasCompanyAccess = isSuperAdminResult.data === true || canAccessCompanyResult.data === true;
      if (!hasCompanyAccess) {
        return [];
      }
      
      // First get existing attendance records for this report
      const { data: existing, error: existingError } = await supabase
        .from("site_report_labour_attendance")
        .select("labour_id")
        .eq("site_report_id", siteReportId)
        .eq("attendance_date", attendanceDate);

      if (existingError) throw existingError;

      const existingLabourIds = new Set(existing?.map(e => e.labour_id) || []);
      
      // Filter out labours that already have attendance records
      const newLabourIds = labourIds.filter(id => !existingLabourIds.has(id));
      
      if (newLabourIds.length === 0) return [];

      // Get labour details to include category
      const { data: labours, error: laboursError } = await supabase
        .from("construction_labour_directory")
        .select("id, category")
        .in("id", newLabourIds);

      if (laboursError) throw laboursError;

      const labourCategoryMap = new Map(labours?.map(l => [l.id, l.category]) || []);

      const records = newLabourIds.map(labourId => ({
        site_report_id: siteReportId,
        labour_id: labourId,
        location_id: locationId,
        attendance_date: attendanceDate,
        attendance_status: 'absent' as const, // Default to absent until marked IN
        category: labourCategoryMap.get(labourId) || null,
        company_id: resolvedCompanyId,
        created_by: userId,
      }));

      const { data: result, error } = await supabase
        .from("site_report_labour_attendance")
        .insert(records)
        .select(`
          *,
          labour:construction_labour_directory(*)
        `);

      if (error) throw error;
      return result as LabourAttendanceWithLabour[];
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["labour-attendance", variables.siteReportId] });
    },
    onError: (error: Error) => {
      toast({ title: "Error initializing attendance", description: error.message, variant: "destructive" });
    },
  });
}
