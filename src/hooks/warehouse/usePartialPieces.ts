import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useLocationFilter } from "@/contexts/LocationFilterContext";
import type { PartialPieceRow } from "@/types/partialPiece";

export function usePartialPieceItems() {
  const { selectedCompany } = useCompany();
  const { globalLocationId } = useLocationFilter();
  const companyId = selectedCompany?.id ?? null;
  return useQuery({
    queryKey: ["partial-piece-items", companyId, globalLocationId],
    enabled: !!companyId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_partial_piece_items", {
        p_company_id: companyId!,
        p_location_id: globalLocationId,
      });
      if (error) throw error;
      return (data ?? []) as Array<{ parent_item_id: string; item_code: string; item_name: string; piece_count: number }>;
    },
  });
}

const KEY = "partial-pieces";

export function usePartialPieces(params: {
  search: string;
  status?: string;
  parentItemId?: string | null;
  limit?: number;
}) {
  const { selectedCompany } = useCompany();
  const { globalLocationId } = useLocationFilter();
  const companyId = selectedCompany?.id ?? null;

  return useQuery({
    queryKey: [KEY, companyId, globalLocationId, params.parentItemId, params.status, params.search, params.limit ?? 500],
    enabled: !!companyId,
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_partial_pieces", {
        p_company_id: companyId!,
        p_location_id: globalLocationId,
        p_parent_item_id: params.parentItemId ?? null,
        p_status: params.status && params.status !== "all" ? params.status : null,
        p_search: params.search?.trim() || null,
        p_limit: params.limit ?? 500,
        p_offset: 0,
      });
      if (error) throw error;
      return (data ?? []) as unknown as PartialPieceRow[];
    },
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: [KEY] });
    qc.invalidateQueries({ queryKey: ["partial-piece-items"] });
    qc.invalidateQueries({ queryKey: ["warehouse-items"] });
    qc.invalidateQueries({ queryKey: ["all-items-location-stock"] });
  };
}

export interface CreatePartialPieceInput {
  company_id: string;
  parent_item_id: string;
  size_value: number;
  size_uom?: string | null;
  location_id: string;
  bin_id?: string | null;
  piece_code?: string | null;
  source_ref?: string | null;
  batch_number?: string | null;
  unit_cost?: number | null;
  label?: string | null;
  notes?: string | null;
}

export function useCreatePartialPiece() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: CreatePartialPieceInput) => {
      const { data, error } = await supabase.rpc("create_partial_piece", {
        p_payload: input as never,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: invalidate,
  });
}

export interface BulkPartialPieceRow {
  size_value: number;
  piece_code?: string | null;
  label?: string | null;
}

export interface CreatePartialPiecesBulkInput {
  company_id: string;
  parent_item_id: string;
  location_id: string;
  bin_id?: string | null;
  shared: {
    size_uom?: string | null;
    source_ref?: string | null;
    batch_number?: string | null;
    unit_cost?: number | null;
    label?: string | null;
    notes?: string | null;
  };
  rows: BulkPartialPieceRow[];
}

export function useCreatePartialPiecesBulk() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: CreatePartialPiecesBulkInput) => {
      const { data, error } = await supabase.rpc("create_partial_pieces_bulk", {
        p_company_id: input.company_id,
        p_parent_item_id: input.parent_item_id,
        p_location_id: input.location_id,
        p_bin_id: input.bin_id ?? null,
        p_shared: input.shared as never,
        p_rows: input.rows as never,
      });
      if (error) throw error;
      return (data ?? []) as string[];
    },
    onSuccess: invalidate,
  });
}

export function useUpdatePartialPiece() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: { id: string; payload: Record<string, unknown> }) => {
      const { error } = await supabase.rpc("update_partial_piece", {
        p_id: input.id,
        p_payload: input.payload as never,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useDeletePartialPiece() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("delete_partial_piece", { p_id: id });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export interface ConsumePartialPieceInput {
  id: string;
  quantity: number;
  reason: string;
  post_to_stock?: boolean;
  reference?: string | null;
  notes?: string | null;
}

export function useConsumePartialPiece() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: ConsumePartialPieceInput) => {
      const { data, error } = await supabase.rpc("consume_partial_piece", {
        p_id: input.id,
        p_quantity: input.quantity,
        p_reason: input.reason,
        p_post_to_stock: input.post_to_stock ?? false,
        p_reference: input.reference ?? null,
        p_notes: input.notes ?? null,
      });
      if (error) throw error;
      return data as { ok: boolean; consumed_qty: number; residual_id: string | null; transaction_id: string | null };
    },
    onSuccess: invalidate,
  });
}

export function useSplitPartialPiece() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: { id: string; first_size: number; second_size: number }) => {
      const { data, error } = await supabase.rpc("split_partial_piece", {
        p_id: input.id,
        p_first_size: input.first_size,
        p_second_size: input.second_size,
      });
      if (error) throw error;
      return data as { ok: boolean; first_id: string; second_id: string };
    },
    onSuccess: invalidate,
  });
}

export function useImportPartialPieces() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: { company_id: string; rows: Record<string, unknown>[] }) => {
      const { data, error } = await supabase.rpc("import_partial_pieces", {
        p_company_id: input.company_id,
        p_rows: input.rows as never,
      });
      if (error) throw error;
      return data as { inserted: number; errors: Array<{ row: number; error: string; data: unknown }> };
    },
    onSuccess: invalidate,
  });
}
