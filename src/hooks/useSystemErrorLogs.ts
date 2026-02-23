import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useMemo } from "react";

export interface SystemErrorLog {
  id: string;
  company_id: string | null;
  user_id: string | null;
  function_name: string;
  error_message: string;
  error_code: number | null;
  request_context: any;
  resolution: string | null;
  status: string;
  created_at: string;
}

export interface ErrorSummary {
  total24h: number;
  autoResolved: number;
  open: number;
  dismissed: number;
  topFunction: string | null;
}

export function useSystemErrorLogs(filters?: {
  functionName?: string;
  status?: string;
  errorCode?: number;
}) {
  const { selectedCompany } = useCompany();
  const queryClient = useQueryClient();

  const { data: logs = [], isLoading, error } = useQuery({
    queryKey: ["system-error-logs", selectedCompany?.id, filters],
    queryFn: async (): Promise<SystemErrorLog[]> => {
      if (!selectedCompany?.id) return [];

      let query = supabase
        .from("system_error_logs")
        .select("*")
        .eq("company_id", selectedCompany.id)
        .order("created_at", { ascending: false })
        .limit(200);

      if (filters?.functionName && filters.functionName !== "all") {
        query = query.eq("function_name", filters.functionName);
      }
      if (filters?.status && filters.status !== "all") {
        query = query.eq("status", filters.status);
      }
      if (filters?.errorCode) {
        query = query.eq("error_code", filters.errorCode);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as SystemErrorLog[];
    },
    enabled: !!selectedCompany?.id,
    refetchInterval: 30000, // Auto-refresh every 30s
  });

  const summary = useMemo((): ErrorSummary => {
    const now = new Date();
    const h24Ago = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const recent = logs.filter((l) => new Date(l.created_at) >= h24Ago);
    const open = logs.filter((l) => l.status === "open").length;
    const autoResolved = logs.filter((l) => l.status === "auto_resolved").length;
    const dismissed = logs.filter((l) => l.status === "dismissed").length;

    // Most frequent function in last 24h
    const fnCounts: Record<string, number> = {};
    recent.forEach((l) => {
      fnCounts[l.function_name] = (fnCounts[l.function_name] || 0) + 1;
    });
    const topFunction =
      Object.entries(fnCounts).sort(([, a], [, b]) => b - a)[0]?.[0] || null;

    return {
      total24h: recent.length,
      autoResolved,
      open,
      dismissed,
      topFunction,
    };
  }, [logs]);

  const dismissMutation = useMutation({
    mutationFn: async (logId: string) => {
      const { error } = await supabase
        .from("system_error_logs")
        .update({ status: "dismissed" })
        .eq("id", logId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["system-error-logs"],
      });
    },
  });

  // Get unique function names for filter dropdown
  const functionNames = useMemo(() => {
    const names = new Set(logs.map((l) => l.function_name));
    return Array.from(names).sort();
  }, [logs]);

  return {
    logs,
    isLoading,
    error,
    summary,
    functionNames,
    dismissLog: dismissMutation.mutateAsync,
    isDismissing: dismissMutation.isPending,
  };
}
