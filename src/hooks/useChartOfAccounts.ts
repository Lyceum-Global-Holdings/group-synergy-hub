import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";
import type { ChartOfAccount, CreateAccountData } from "@/types/generalLedger";

export const useChartOfAccounts = () => {
  const { selectedCompany } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: accounts, isLoading } = useQuery({
    queryKey: ["chart-of-accounts", selectedCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chart_of_accounts")
        .select("*")
        .eq("company_id", selectedCompany?.id)
        .order("account_code");

      if (error) throw error;
      return data as ChartOfAccount[];
    },
    enabled: !!selectedCompany?.id,
  });

  const createAccount = useMutation({
    mutationFn: async (accountData: CreateAccountData) => {
      const { data, error } = await supabase
        .from("chart_of_accounts")
        .insert({
          ...accountData,
          company_id: selectedCompany?.id,
          level: accountData.parent_account_id ? 2 : 1,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chart-of-accounts"] });
      toast({
        title: "Success",
        description: "Account created successfully",
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

  const updateAccount = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ChartOfAccount> & { id: string }) => {
      const { data, error } = await supabase
        .from("chart_of_accounts")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chart-of-accounts"] });
      toast({
        title: "Success",
        description: "Account updated successfully",
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

  const deleteAccount = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("chart_of_accounts")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chart-of-accounts"] });
      toast({
        title: "Success",
        description: "Account deleted successfully",
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

  // Helper to build hierarchical tree
  const buildAccountTree = (accounts: ChartOfAccount[]) => {
    const accountMap = new Map(accounts.map(acc => [acc.id, { ...acc, children: [] as any[] }]));
    const roots: any[] = [];

    accounts.forEach(account => {
      const node = accountMap.get(account.id);
      if (account.parent_account_id) {
        const parent = accountMap.get(account.parent_account_id);
        if (parent) {
          parent.children.push(node);
        } else {
          roots.push(node);
        }
      } else {
        roots.push(node);
      }
    });

    return roots;
  };

  const accountTree = accounts ? buildAccountTree(accounts) : [];

  return {
    accounts,
    accountTree,
    isLoading,
    createAccount,
    updateAccount,
    deleteAccount,
  };
};
