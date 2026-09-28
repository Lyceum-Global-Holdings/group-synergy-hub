import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { untypedRpc } from "@/lib/untypedRpc";

// Picking and packing run through database functions (migration
// 20260928170000): starting and confirming a pick list, packing picked goods,
// and moving the sales order to picked / packed so it can be delivered.

export interface PickLine {
  id: string;
  quantity_to_pick: number;
  quantity_picked: number | null;
  status: string;
  notes: string | null;
  pick_sequence: number | null;
  finished_goods: { product_name: string | null; product_code: string | null } | null;
  warehouse_locations: { name: string | null } | null;
  warehouse_bins: { bin_code: string | null } | null;
}

export interface PackLine {
  id: string;
  item_name: string | null;
  quantity_issued: number;
  quantity_picked: number;
  quantity_packed: number;
}

function refresh(qc: QueryClient) {
  for (const key of ["pick-lists", "pick-list-lines", "pick-list-items", "sales-orders", "sales-order-items", "sales-order-pack-lines", "packing-lists"]) {
    qc.invalidateQueries({ queryKey: [key] });
  }
}

export const usePickListLines = (pickListId: string | undefined) =>
  useQuery({
    queryKey: ["pick-list-lines", pickListId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pick_list_items")
        .select(`id, quantity_to_pick, quantity_picked, status, notes, pick_sequence,
          finished_goods (product_name, product_code),
          warehouse_locations!location_id (name),
          warehouse_bins!bin_id (bin_code)`)
        .eq("pick_list_id", pickListId!)
        .order("pick_sequence", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as PickLine[];
    },
    enabled: !!pickListId,
  });

export const useSalesOrderPackLines = (salesOrderId: string | undefined) =>
  useQuery({
    queryKey: ["sales-order-pack-lines", salesOrderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_order_items")
        .select("id, item_name, quantity_issued, quantity_picked, quantity_packed")
        .eq("sales_order_id", salesOrderId!);
      if (error) throw error;
      return (data ?? []).map((l) => ({
        ...l,
        quantity_issued: Number(l.quantity_issued || 0),
        quantity_picked: Number(l.quantity_picked || 0),
        quantity_packed: Number(l.quantity_packed || 0),
      })) as PackLine[];
    },
    enabled: !!salesOrderId,
  });

export const useStartPickList = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (pickListId: string) => untypedRpc<null>("start_pick_list", { p_pick_list_id: pickListId }),
    onSuccess: () => { refresh(qc); toast.success("Picking started"); },
    onError: (e: Error) => toast.error(e.message),
  });
};

export const useConfirmPickList = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ pickListId, lines }: {
      pickListId: string;
      lines: { pick_list_item_id: string; quantity_picked: number; not_found?: boolean; notes?: string }[];
    }) => untypedRpc<null>("confirm_pick_list", { p_pick_list_id: pickListId, p_lines: lines }),
    onSuccess: () => { refresh(qc); toast.success("Pick confirmed"); },
    onError: (e: Error) => toast.error(e.message),
  });
};

export const usePackSalesOrder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      salesOrderId: string;
      lines: { sales_order_item_id: string; quantity_packed: number; package_number?: number }[];
      packageType?: string; packageWeight?: number | null; packageDimensions?: string; notes?: string;
    }) => untypedRpc<{ packing_list_number: string; status: string }>("pack_sales_order", {
      p_sales_order_id: input.salesOrderId,
      p_lines: input.lines,
      p_package_type: input.packageType || null,
      p_package_weight: input.packageWeight ?? null,
      p_package_dimensions: input.packageDimensions || null,
      p_notes: input.notes || null,
    }),
    onSuccess: (r) => {
      refresh(qc);
      toast.success(r.status === "packed"
        ? `${r.packing_list_number} recorded. The order is packed and ready for a delivery order.`
        : `${r.packing_list_number} recorded.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

/** Super admins only; deletes one company's fulfilment records and gives back issued stock. */
export const useResetFulfilment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (companyId: string) => untypedRpc<{ sales_orders_deleted: number }>("reset_fulfilment_data", { p_company_id: companyId }),
    onSuccess: (r) => {
      refresh(qc);
      qc.invalidateQueries({ queryKey: ["finished-goods-issues"] });
      qc.invalidateQueries({ queryKey: ["delivery-orders"] });
      toast.success(`Reset done: ${r.sales_orders_deleted} sales orders removed for this company`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
};
