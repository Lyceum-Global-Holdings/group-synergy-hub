import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";
import type { JournalEntry, CreateJournalEntryData, JournalStatus } from "@/types/generalLedger";

export const useJournalEntries = (filters?: { status?: JournalStatus; startDate?: string; endDate?: string }) => {
  const { selectedCompany } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: journalEntries, isLoading } = useQuery({
    queryKey: ["journal-entries", selectedCompany?.id, filters],
    queryFn: async () => {
      let query = supabase
        .from("journal_entries")
        .select(`
          *,
          lines:journal_entry_lines(
            *,
            account:chart_of_accounts(account_code, account_name)
          )
        `)
        .eq("company_id", selectedCompany?.id)
        .order("journal_date", { ascending: false });

      if (filters?.status) {
        query = query.eq("status", filters.status);
      }
      if (filters?.startDate) {
        query = query.gte("journal_date", filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte("journal_date", filters.endDate);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as unknown as JournalEntry[];
    },
    enabled: !!selectedCompany?.id,
  });

  const createJournalEntry = useMutation({
    mutationFn: async (entryData: CreateJournalEntryData) => {
      // Create journal entry header
      const { data: je, error: jeError } = await supabase
        .from("journal_entries")
        .insert({
          journal_date: entryData.journal_date,
          journal_type: entryData.journal_type || 'manual',
          reference_type: entryData.reference_type,
          reference_id: entryData.reference_id,
          reference_number: entryData.reference_number,
          description: entryData.description,
          tags: entryData.tags,
          company_id: selectedCompany?.id,
          status: 'draft' as const,
          fiscal_year: new Date(entryData.journal_date).getFullYear(),
          period_month: new Date(entryData.journal_date).getMonth() + 1,
        } as any)
        .select()
        .single();

      if (jeError) throw jeError;

      // Create journal entry lines
      const linesWithJeId = entryData.lines.map((line, index) => ({
        ...line,
        journal_entry_id: je.id,
        line_number: index + 1,
        base_currency_amount: line.debit_amount || line.credit_amount,
      }));

      const { error: linesError } = await supabase
        .from("journal_entry_lines")
        .insert(linesWithJeId);

      if (linesError) throw linesError;

      return je;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
      toast({
        title: "Success",
        description: "Journal entry created successfully",
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

  const postJournalEntry = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from("journal_entries")
        .update({
          status: 'posted',
          posted_date: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("status", "draft")
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
      queryClient.invalidateQueries({ queryKey: ["chart-of-accounts"] });
      toast({
        title: "Success",
        description: "Journal entry posted successfully",
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

  const voidJournalEntry = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from("journal_entries")
        .update({ status: 'void' })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
      toast({
        title: "Success",
        description: "Journal entry voided successfully",
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

  const deleteJournalEntry = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("journal_entries")
        .delete()
        .eq("id", id)
        .eq("status", "draft");

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
      toast({
        title: "Success",
        description: "Journal entry deleted successfully",
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

  return {
    journalEntries,
    isLoading,
    createJournalEntry,
    postJournalEntry,
    voidJournalEntry,
    deleteJournalEntry,
  };
};
