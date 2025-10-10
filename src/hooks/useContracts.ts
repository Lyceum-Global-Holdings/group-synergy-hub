import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Contract } from "@/types/contracts";

import { ContractStatus, ContractType } from "@/types/contracts";

export const useContracts = (filters?: {
  status?: ContractStatus | string;
  contract_type?: ContractType | string;
  search?: string;
}) => {
  return useQuery({
    queryKey: ["contracts", filters],
    queryFn: async () => {
      let query = supabase
        .from("contracts")
        .select(`
          *,
          parties:contract_parties(*),
          documents:contract_documents(*),
          obligations:contract_obligations(*),
          amendments:contract_amendments(*)
        `)
        .order("created_at", { ascending: false });

      if (filters?.status && filters.status !== "") {
        query = query.eq("status", filters.status as any);
      }

      if (filters?.contract_type && filters.contract_type !== "") {
        query = query.eq("contract_type", filters.contract_type as any);
      }

      if (filters?.search) {
        query = query.or(
          `contract_number.ilike.%${filters.search}%,contract_title.ilike.%${filters.search}%,counterparty_name.ilike.%${filters.search}%`
        );
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Contract[];
    },
  });
};

export const useContract = (id: string) => {
  return useQuery({
    queryKey: ["contract", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contracts")
        .select(`
          *,
          parties:contract_parties(*),
          documents:contract_documents(*),
          obligations:contract_obligations(*),
          amendments:contract_amendments(*)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as Contract;
    },
    enabled: !!id,
  });
};

export const useContractParties = (contractId: string) => {
  return useQuery({
    queryKey: ["contract-parties", contractId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contract_parties")
        .select("*")
        .eq("contract_id", contractId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!contractId,
  });
};

export const useContractDocuments = (contractId: string) => {
  return useQuery({
    queryKey: ["contract-documents", contractId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contract_documents")
        .select("*")
        .eq("contract_id", contractId)
        .order("uploaded_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!contractId,
  });
};

export const useContractObligations = (contractId: string) => {
  return useQuery({
    queryKey: ["contract-obligations", contractId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contract_obligations")
        .select("*")
        .eq("contract_id", contractId)
        .order("due_date", { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!contractId,
  });
};

export const useContractAmendments = (contractId: string) => {
  return useQuery({
    queryKey: ["contract-amendments", contractId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contract_amendments")
        .select("*")
        .eq("contract_id", contractId)
        .order("amendment_date", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!contractId,
  });
};
