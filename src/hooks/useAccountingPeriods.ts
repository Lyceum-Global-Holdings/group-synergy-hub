import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";
import type { AccountingPeriod, FiscalYear } from "@/types/generalLedger";

export const useAccountingPeriods = () => {
  const { selectedCompany } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: periods, isLoading: periodsLoading } = useQuery({
    queryKey: ["accounting-periods", selectedCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounting_periods")
        .select("*")
        .eq("company_id", selectedCompany?.id)
        .order("fiscal_year", { ascending: false })
        .order("period_number", { ascending: false });

      if (error) throw error;
      return data as AccountingPeriod[];
    },
    enabled: !!selectedCompany?.id,
  });

  const { data: fiscalYears, isLoading: fiscalYearsLoading } = useQuery({
    queryKey: ["fiscal-years", selectedCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fiscal_years")
        .select("*")
        .eq("company_id", selectedCompany?.id)
        .order("fiscal_year", { ascending: false });

      if (error) throw error;
      return data as FiscalYear[];
    },
    enabled: !!selectedCompany?.id,
  });

  const createFiscalYear = useMutation({
    mutationFn: async (yearData: Omit<FiscalYear, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase
        .from("fiscal_years")
        .insert({
          ...yearData,
          company_id: selectedCompany?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fiscal-years"] });
      toast({
        title: "Success",
        description: "Fiscal year created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const closePeriod = useMutation({
    mutationFn: async (periodId: string) => {
      const { data, error } = await supabase
        .from("accounting_periods")
        .update({
          status: 'closed',
          closed_date: new Date().toISOString(),
        })
        .eq("id", periodId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounting-periods"] });
      toast({
        title: "Success",
        description: "Period closed successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const currentPeriod = periods?.find(p => p.status === 'open');

  return {
    periods,
    fiscalYears,
    currentPeriod,
    isLoading: periodsLoading || fiscalYearsLoading,
    createFiscalYear,
    closePeriod,
  };
};
