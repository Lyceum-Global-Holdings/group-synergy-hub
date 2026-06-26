import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RentalOrder, CreateRentalOrderData } from "@/types/costumeRental";
import { toast } from "sonner";

const LIST_KEY = "rental-orders";

export function useRentalOrders(companyId?: string) {
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [LIST_KEY] });
    queryClient.invalidateQueries({ queryKey: ["rental-order"] }); // detail view
    queryClient.invalidateQueries({ queryKey: ["rental-availability"] });
  };

  const { data: orders = [], isLoading, error } = useQuery({
    queryKey: [LIST_KEY, companyId],
    queryFn: async () => {
      let query = (supabase as any)
        .from("rental_orders")
        .select("*, customer:customers(id, customer_name, customer_code), items:rental_order_items(*, costume:rental_costumes(id, name, costume_code, image_url))")
        .order("created_at", { ascending: false });
      if (companyId) query = query.eq("company_id", companyId);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as RentalOrder[];
    },
  });

  const createOrder = useMutation({
    mutationFn: async (input: CreateRentalOrderData) => {
      const user = await supabase.auth.getUser();
      const { data: number, error: numErr } = await (supabase as any).rpc("generate_rental_number");
      if (numErr) throw numErr;

      const { data: order, error: orderErr } = await (supabase as any)
        .from("rental_orders")
        .insert({
          rental_number: number,
          customer_id: input.customer_id,
          pickup_date: input.pickup_date,
          due_date: input.due_date,
          discount_amount: input.discount_amount ?? 0,
          tax_amount: input.tax_amount ?? 0,
          notes: input.notes ?? null,
          company_id: input.company_id,
          created_by: user.data.user?.id,
        })
        .select()
        .single();
      if (orderErr) throw orderErr;

      if (input.items.length > 0) {
        const { error: itemsErr } = await (supabase as any)
          .from("rental_order_items")
          .insert(input.items.map((it) => ({ ...it, rental_order_id: order.id, company_id: input.company_id })));
        if (itemsErr) throw itemsErr;
      }
      return order as RentalOrder;
    },
    onSuccess: () => { invalidate(); toast.success("Rental order created"); },
    onError: (e: any) => toast.error(`Failed to create rental: ${e.message}`),
  });

  // Single mutation for every status transition; the RPC + success message are
  // passed in, so there's exactly one useMutation call (no rules-of-hooks issue).
  const lifecycle = useMutation({
    mutationFn: async (args: {
      rpc: "submit_rental_for_approval" | "approve_rental_order" | "reject_rental_order" | "cancel_rental_order";
      id: string; reason?: string; comments?: string; okMsg: string;
    }) => {
      const params: Record<string, any> = { p_id: args.id };
      if (args.reason !== undefined) params.p_reason = args.reason;
      if (args.comments !== undefined) params.p_comments = args.comments;
      const { data, error } = await (supabase as any).rpc(args.rpc, params);
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, vars) => { invalidate(); toast.success(vars.okMsg); },
    onError: (e: any) => toast.error(e?.message ?? "Action failed"),
  });

  // Fulfillment transitions that carry jsonb payloads (checkout/return/complete).
  const fulfillment = useMutation({
    mutationFn: async (args: {
      rpc: "checkout_rental_order" | "return_rental_order" | "complete_rental_order";
      id: string; assignments?: any[]; returns?: any[]; damageFee?: number; okMsg: string;
    }) => {
      const params: Record<string, any> = { p_id: args.id };
      if (args.assignments !== undefined) params.p_assignments = args.assignments;
      if (args.returns !== undefined) params.p_returns = args.returns;
      if (args.damageFee !== undefined) params.p_damage_fee = args.damageFee;
      const { data, error } = await (supabase as any).rpc(args.rpc, params);
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, vars) => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["rental-order"] });
      queryClient.invalidateQueries({ queryKey: ["costume-units"] });
      queryClient.invalidateQueries({ queryKey: ["costumes"] });
      toast.success(vars.okMsg);
    },
    onError: (e: any) => toast.error(e?.message ?? "Action failed"),
  });

  return {
    orders, isLoading, error,
    createOrder,
    submitOrder: (id: string) => lifecycle.mutateAsync({ rpc: "submit_rental_for_approval", id, okMsg: "Submitted for approval" }),
    approveOrder: (id: string, comments?: string) => lifecycle.mutateAsync({ rpc: "approve_rental_order", id, comments, okMsg: "Rental approved" }),
    rejectOrder: (id: string, reason?: string) => lifecycle.mutateAsync({ rpc: "reject_rental_order", id, reason, okMsg: "Rental rejected" }),
    cancelOrder: (id: string, reason?: string) => lifecycle.mutateAsync({ rpc: "cancel_rental_order", id, reason, okMsg: "Rental cancelled" }),
    checkoutOrder: (id: string, assignments: any[]) => fulfillment.mutateAsync({ rpc: "checkout_rental_order", id, assignments, okMsg: "Checked out" }),
    returnOrder: (id: string, returns: any[], damageFee: number) => fulfillment.mutateAsync({ rpc: "return_rental_order", id, returns, damageFee, okMsg: "Return processed" }),
    completeOrder: (id: string) => fulfillment.mutateAsync({ rpc: "complete_rental_order", id, okMsg: "Rental completed" }),
    isMutating: lifecycle.isPending || fulfillment.isPending,
    isCreating: createOrder.isPending,
  };
}

export function useRentalOrder(id?: string) {
  return useQuery({
    queryKey: ["rental-order", id],
    enabled: !!id,
    queryFn: async () => {
      // Note: assignments (Phase C) are fetched separately by the Return dialog,
      // so viewing an order never depends on the rental_unit_assignments table.
      const { data, error } = await (supabase as any)
        .from("rental_orders")
        .select("*, customer:customers(id, customer_name, customer_code), items:rental_order_items(*, costume:rental_costumes(id, name, costume_code, image_url))")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as RentalOrder;
    },
  });
}
