import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";
import { invokeEdgeFunction } from "@/lib/edgeFunctionClient";

export type TelegramReportType =
  | "warehouse_stock_daily"
  | "tool_management_daily"
  | "site_report_daily"
  | "stock_transfer_daily";

export type TelegramFrequency = "daily" | "weekly" | "monthly";

export interface TelegramScheduledJob {
  id: string;
  company_id: string;
  name: string;
  report_type: TelegramReportType;
  frequency: TelegramFrequency;
  send_time: string;
  timezone: string;
  weekday: number | null;
  day_of_month: number | null;
  filters: Record<string, unknown>;
  chat_ids: string[];
  is_enabled: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TelegramJobRun {
  id: string;
  job_id: string;
  started_at: string;
  finished_at: string | null;
  status: "running" | "success" | "partial" | "failed";
  recipient_count: number;
  error_text: string | null;
  payload_preview: string | null;
  triggered_by: "cron" | "manual" | "test";
}

export type JobUpsert = Partial<TelegramScheduledJob> & {
  name: string;
  report_type: TelegramReportType;
  frequency: TelegramFrequency;
  send_time: string;
  timezone: string;
};

export function useTelegramJobs() {
  const { selectedCompany } = useCompany();
  const { toast } = useToast();
  const qc = useQueryClient();

  const jobsQuery = useQuery({
    queryKey: ["telegram-jobs", selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];
      const { data, error } = await supabase
        .from("telegram_scheduled_jobs")
        .select("*")
        .eq("company_id", selectedCompany.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TelegramScheduledJob[];
    },
    enabled: !!selectedCompany?.id,
  });

  const saveJob = useMutation({
    mutationFn: async (input: JobUpsert) => {
      if (!selectedCompany?.id) throw new Error("No company selected");
      const payload: any = {
        name: input.name,
        report_type: input.report_type,
        frequency: input.frequency,
        send_time: input.send_time,
        timezone: input.timezone,
        is_enabled: input.is_enabled ?? true,
        company_id: selectedCompany.id,
        weekday: input.frequency === "weekly" ? input.weekday ?? 1 : null,
        day_of_month: input.frequency === "monthly" ? input.day_of_month ?? 1 : null,
        chat_ids: input.chat_ids ?? [],
        filters: (input.filters ?? {}) as any,
      };
      if (input.id) {
        const { data, error } = await supabase
          .from("telegram_scheduled_jobs")
          .update(payload)
          .eq("id", input.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase
        .from("telegram_scheduled_jobs")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["telegram-jobs"] });
      toast({ title: "Saved", description: "Scheduled job saved." });
    },
    onError: (e: Error) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const deleteJob = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("telegram_scheduled_jobs").delete().eq("id", id).select("id");
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["telegram-jobs"] });
      toast({ title: "Deleted", description: "Scheduled job removed." });
    },
    onError: (e: Error) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  const toggleJob = useMutation({
    mutationFn: async ({ id, is_enabled }: { id: string; is_enabled: boolean }) => {
      const { error } = await supabase.from("telegram_scheduled_jobs").update({ is_enabled }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["telegram-jobs"] }),
  });

  const runNow = useMutation({
    mutationFn: async ({ jobId, dryRun }: { jobId: string; dryRun?: boolean }) => {
      const res = await invokeEdgeFunction<{ ok: boolean; preview?: string; error?: string }>(
        "telegram-job-dispatcher",
        { job_id: jobId, dry_run: !!dryRun },
      );
      if (!res?.ok) throw new Error(res?.error || "Failed to run job");
      return res;
    },
    onSuccess: (res, vars) => {
      qc.invalidateQueries({ queryKey: ["telegram-job-runs"] });
      toast({
        title: vars.dryRun ? "Preview generated" : "Report sent",
        description: vars.dryRun ? (res.preview?.slice(0, 200) ?? "") : "Telegram message delivered.",
      });
    },
    onError: (e: Error) => toast({ title: "Run failed", description: e.message, variant: "destructive" }),
  });

  return { ...jobsQuery, saveJob, deleteJob, toggleJob, runNow };
}

export function useTelegramJobRuns(jobId?: string) {
  const { selectedCompany } = useCompany();
  return useQuery({
    queryKey: ["telegram-job-runs", selectedCompany?.id, jobId],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];
      let q = supabase
        .from("telegram_job_runs")
        .select("*")
        .eq("company_id", selectedCompany.id)
        .order("started_at", { ascending: false })
        .limit(100);
      if (jobId) q = q.eq("job_id", jobId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as TelegramJobRun[];
    },
    enabled: !!selectedCompany?.id,
  });
}

export const REPORT_TYPE_LABELS: Record<TelegramReportType, string> = {
  warehouse_stock_daily: "Warehouse Stock (Daily)",
  tool_management_daily: "Tool Management (Daily)",
  site_report_daily: "Site Report (Daily)",
  stock_transfer_daily: "Stock Transfers (Daily)",
};
