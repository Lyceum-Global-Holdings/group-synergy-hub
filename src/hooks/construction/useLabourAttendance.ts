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

async function resolveAttendanceInsertContext(
  siteReportId: string,
  fallbackCompanyId?: string | null
): Promise<{ userId: string; companyId: string } | null> {
  const { data: user, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;

  const userId = user.user?.id;
  if (!userId) return null;

  const { data: reportCompanyRow, error: reportCompanyError } = await supabase
    .from("daily_site_reports")
    .select("company_id")
    .eq("id", siteReportId)
    .maybeSingle();

  if (reportCompanyError) throw reportCompanyError;

  const resolvedCompanyId = reportCompanyRow?.company_id ?? fallbackCompanyId ?? null;
  if (!resolvedCompanyId) return null;

  const [isSuperAdminResult, canAccessCompanyResult] = await Promise.all([
    supabase.rpc("is_super_admin", { _user_id: userId }),
    supabase.rpc("can_access_company", { target_company_id: resolvedCompanyId }),
  ]);

  if (isSuperAdminResult.error) throw isSuperAdminResult.error;
  if (canAccessCompanyResult.error) throw canAccessCompanyResult.error;

  const hasCompanyAccess =
    isSuperAdminResult.data === true || canAccessCompanyResult.data === true;

  if (!hasCompanyAccess) return null;

  return { userId, companyId: resolvedCompanyId };
}


async function attachLabourDirectory(
  attendanceRows: LabourAttendance[] | null | undefined
): Promise<LabourAttendanceWithLabour[]> {
  const rows = (attendanceRows ?? []) as LabourAttendance[];
  if (rows.length === 0) return [];

  const labourIds = Array.from(
    new Set(rows.map((row) => row.labour_id).filter((id): id is string => Boolean(id)))
  );

  if (labourIds.length === 0) return [];

  const { data: labours, error: laboursError } = await supabase
    .from("construction_labour_directory")
    .select("*")
    .in("id", labourIds);

  if (laboursError) throw laboursError;

  const labourMap = new Map(
    (labours ?? [])
      .filter((labour): labour is LabourMaster & { id: string } => Boolean(labour?.id))
      .map((labour) => [labour.id, labour as LabourMaster])
  );

  return rows.flatMap((row) => {
    const labour = row.labour_id ? labourMap.get(row.labour_id) : undefined;
    return labour ? [{ ...row, labour } as LabourAttendanceWithLabour] : [];
  });
}

export function useLabourAttendance(siteReportId: string | null | undefined) {
  return useQuery({
    queryKey: ["labour-attendance", siteReportId],
    queryFn: async () => {
      if (!siteReportId) return [];

      const { data, error } = await supabase
        .from("site_report_labour_attendance")
        .select("*")
        .eq("site_report_id", siteReportId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return attachLabourDirectory((data ?? []) as LabourAttendance[]);
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
        .select("*")
        .single();

      if (error) throw error;

      const hydrated = await attachLabourDirectory(result ? [result as LabourAttendance] : []);
      if (!hydrated[0]) throw new Error("Failed to load labour details for attendance record");
      return hydrated[0];
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
        .select("*")
        .single();

      if (error) throw error;

      const hydrated = await attachLabourDirectory(result ? [result as LabourAttendance] : []);
      if (!hydrated[0]) throw new Error("Failed to load labour details for attendance record");
      return hydrated[0];
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
    mutationFn: async ({
      companyId,
      ...data
    }: CreateLabourAttendanceData & { companyId?: string | null }) => {
      const insertContext = await resolveAttendanceInsertContext(
        data.site_report_id,
        companyId ?? selectedCompany?.id ?? null
      );

      if (!insertContext) {
        throw new Error("You do not have access to create attendance for this report");
      }

      const { data: result, error } = await supabase
        .from("site_report_labour_attendance")
        .upsert(
          {
            ...data,
            company_id: insertContext.companyId,
            created_by: insertContext.userId,
          },
          { onConflict: "site_report_id,labour_id,attendance_date" }
        )
        .select("*")
        .single();

      if (error) throw error;

      const hydrated = await attachLabourDirectory(result ? [result as LabourAttendance] : []);
      if (!hydrated[0]) throw new Error("Failed to load labour details for attendance record");
      return hydrated[0];
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
      const insertContext = await resolveAttendanceInsertContext(
        siteReportId,
        companyId ?? selectedCompany?.id ?? null
      );

      // Skip silent initialization if company cannot be resolved or access is not allowed
      if (!insertContext) {
        return [];
      }

      const { userId, companyId: resolvedCompanyId } = insertContext;
      
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
        .select("*");

      if (error) throw error;
      return attachLabourDirectory((result ?? []) as LabourAttendance[]);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["labour-attendance", variables.siteReportId] });
    },
    onError: (error: Error) => {
      toast({ title: "Error initializing attendance", description: error.message, variant: "destructive" });
    },
  });
}
