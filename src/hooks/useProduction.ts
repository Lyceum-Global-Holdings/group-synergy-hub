import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "sonner";
import { DEFAULT_SECTORS } from "@/constants/productionSectors";

// ── Sectors ──
export function useProductionSectors() {
  const { selectedCompany } = useCompany();
  return useQuery({
    queryKey: ["production-sectors", selectedCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_sectors")
        .select("*")
        .eq("company_id", selectedCompany!.id)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCompany?.id,
  });
}

export function useSeedDefaultSectors() {
  const { selectedCompany } = useCompany();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!selectedCompany?.id) throw new Error("No company");

      for (const sector of DEFAULT_SECTORS) {
        const { data: s, error: sErr } = await supabase
          .from("production_sectors")
          .insert({ company_id: selectedCompany.id, name: sector.name, code: sector.code, description: sector.description })
          .select()
          .single();
        if (sErr) throw sErr;

        const stages = sector.stages.map((st) => ({
          sector_id: s.id,
          company_id: selectedCompany.id,
          stage_name: st.stage_name,
          sequence_order: st.sequence_order,
          bom_categories: st.bom_categories as unknown as string[],
          description: st.description,
        }));
        const { error: stErr } = await supabase.from("production_stage_templates").insert(stages);
        if (stErr) throw stErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["production-sectors"] });
      qc.invalidateQueries({ queryKey: ["production-stage-templates"] });
      toast.success("Default sectors and stages created");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// ── Stage Templates ──
export function useStageTemplates(sectorId?: string) {
  const { selectedCompany } = useCompany();
  return useQuery({
    queryKey: ["production-stage-templates", sectorId],
    queryFn: async () => {
      let q = supabase
        .from("production_stage_templates")
        .select("*")
        .eq("company_id", selectedCompany!.id)
        .eq("is_active", true)
        .order("sequence_order");
      if (sectorId) q = q.eq("sector_id", sectorId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCompany?.id,
  });
}

// ── Production Orders ──
export function useProductionOrders() {
  const { selectedCompany } = useCompany();
  return useQuery({
    queryKey: ["production-orders", selectedCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_orders")
        .select(`*, production_sectors(name, code), production_order_stages(*), customer_po_items(item_name, color, size, style_no, quantity_ordered, unit_price)`)
        .eq("company_id", selectedCompany!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCompany?.id,
  });
}

export function useProductionOrder(orderId?: string) {
  return useQuery({
    queryKey: ["production-order", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_orders")
        .select(`*, production_sectors(name, code), production_order_stages(*, production_stage_costs(*)), customer_po_items(item_name, color, size, style_no, quantity_ordered, unit_price)`)
        .eq("id", orderId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!orderId,
  });
}

export function useCreateProductionOrder() {
  const { selectedCompany } = useCompany();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      sector_id: string;
      product_name: string;
      style_no?: string;
      target_qty: number;
      cpo_id?: string;
      cpo_item_id?: string;
      bom_id?: string;
      start_date?: string;
      due_date?: string;
      notes?: string;
      stages: { stage_name: string; sequence_order: number; stage_template_id?: string }[];
    }) => {
      const { data: user } = await supabase.auth.getUser();

      const { data: order, error } = await supabase
        .from("production_orders")
        .insert({
          company_id: selectedCompany!.id,
          order_number: "", // trigger will generate
          sector_id: input.sector_id,
          product_name: input.product_name,
          style_no: input.style_no || null,
          target_qty: input.target_qty,
          cpo_id: input.cpo_id || null,
          cpo_item_id: input.cpo_item_id || null,
          bom_id: input.bom_id || null,
          start_date: input.start_date || null,
          due_date: input.due_date || null,
          notes: input.notes || null,
          created_by: user?.user?.id || null,
        })
        .select()
        .single();
      if (error) throw error;

      // Create stages
      const stageInserts = input.stages.map((s) => ({
        order_id: order.id,
        stage_template_id: s.stage_template_id || null,
        stage_name: s.stage_name,
        sequence_order: s.sequence_order,
      }));
      const { error: stErr } = await supabase.from("production_order_stages").insert(stageInserts);
      if (stErr) throw stErr;

      // If BOM linked, auto-populate stage costs
      if (input.bom_id) {
        const { data: bomItems } = await supabase
          .from("bom_items")
          .select("*")
          .eq("bom_id", input.bom_id);

        if (bomItems && bomItems.length > 0) {
          const { data: createdStages } = await supabase
            .from("production_order_stages")
            .select("*, production_stage_templates(bom_categories)")
            .eq("order_id", order.id);

          if (createdStages) {
            const costInserts: any[] = [];
            for (const stage of createdStages) {
              const cats = (stage.production_stage_templates as any)?.bom_categories || [];
              if (Array.isArray(cats) && cats.length > 0) {
                const matchingItems = bomItems.filter((bi) => cats.includes(bi.category));
                for (const bi of matchingItems) {
                  costInserts.push({
                    stage_id: stage.id,
                    item_name: bi.item_name,
                    bom_item_id: bi.id,
                    unit_cost: bi.unit_cost || 0,
                    quantity_used: bi.quantity || 0,
                    total_cost: bi.total_cost || 0,
                    unit_of_measure: bi.unit_of_measure || "pcs",
                    source: "bom",
                  });
                }
              }
            }
            if (costInserts.length > 0) {
              await supabase.from("production_stage_costs").insert(costInserts);
            }
          }
        }
      }

      return order;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["production-orders"] });
      toast.success("Production order created");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// Batch create production orders from CPO items
export function useCreateBatchProductionOrders() {
  const { selectedCompany } = useCompany();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      sector_id: string;
      cpo_id: string;
      bom_id?: string;
      start_date?: string;
      due_date?: string;
      notes?: string;
      stages: { stage_name: string; sequence_order: number; stage_template_id?: string }[];
      items: {
        cpo_item_id: string;
        item_name: string;
        style_no?: string;
        target_qty: number;
        bom_id?: string;
      }[];
    }) => {
      const { data: user } = await supabase.auth.getUser();
      const createdOrders: any[] = [];

      for (const item of input.items) {
        const { data: order, error } = await supabase
          .from("production_orders")
          .insert({
            company_id: selectedCompany!.id,
            order_number: "",
            sector_id: input.sector_id,
            product_name: item.item_name,
            style_no: item.style_no || null,
            target_qty: item.target_qty,
            cpo_id: input.cpo_id,
            cpo_item_id: item.cpo_item_id,
            bom_id: item.bom_id || input.bom_id || null,
            start_date: input.start_date || null,
            due_date: input.due_date || null,
            notes: input.notes || null,
            created_by: user?.user?.id || null,
          })
          .select()
          .single();
        if (error) throw error;

        const stageInserts = input.stages.map((s) => ({
          order_id: order.id,
          stage_template_id: s.stage_template_id || null,
          stage_name: s.stage_name,
          sequence_order: s.sequence_order,
        }));
        const { error: stErr } = await supabase.from("production_order_stages").insert(stageInserts);
        if (stErr) throw stErr;

        // BOM cost auto-populate (use per-item bom_id first, fall back to shared)
        const effectiveBomId = item.bom_id || input.bom_id;
        if (effectiveBomId) {
          const { data: bomItems } = await supabase
            .from("bom_items")
            .select("*")
            .eq("bom_id", effectiveBomId);

          if (bomItems && bomItems.length > 0) {
            const { data: createdStages } = await supabase
              .from("production_order_stages")
              .select("*, production_stage_templates(bom_categories)")
              .eq("order_id", order.id);

            if (createdStages) {
              const costInserts: any[] = [];
              for (const stage of createdStages) {
                const cats = (stage.production_stage_templates as any)?.bom_categories || [];
                if (Array.isArray(cats) && cats.length > 0) {
                  const matchingItems = bomItems.filter((bi) => cats.includes(bi.category));
                  for (const bi of matchingItems) {
                    costInserts.push({
                      stage_id: stage.id,
                      item_name: bi.item_name,
                      bom_item_id: bi.id,
                      unit_cost: bi.unit_cost || 0,
                      quantity_used: bi.quantity || 0,
                      total_cost: bi.total_cost || 0,
                      unit_of_measure: bi.unit_of_measure || "pcs",
                      source: "bom",
                    });
                  }
                }
              }
              if (costInserts.length > 0) {
                await supabase.from("production_stage_costs").insert(costInserts);
              }
            }
          }
        }

        createdOrders.push(order);
      }

      return createdOrders;
    },
    onSuccess: (orders) => {
      qc.invalidateQueries({ queryKey: ["production-orders"] });
      toast.success(`${orders.length} production order(s) created`);
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// ── Update Stage ──
export function useUpdateProductionStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      status?: string;
      input_qty?: number;
      output_qty?: number;
      wastage_qty?: number;
      notes?: string;
    }) => {
      const updates: any = { ...input, updated_at: new Date().toISOString() };
      delete updates.id;

      if (input.status === "in_progress" && !updates.started_at) {
        updates.started_at = new Date().toISOString();
      }
      if (input.status === "completed") {
        updates.completed_at = new Date().toISOString();
        const { data: user } = await supabase.auth.getUser();
        updates.completed_by = user?.user?.id || null;
      }

      const { error } = await supabase
        .from("production_order_stages")
        .update(updates)
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["production-order"] });
      qc.invalidateQueries({ queryKey: ["production-orders"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// ── Stage Costs ──
export function useAddStageCost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      stage_id: string;
      item_name: string;
      unit_cost: number;
      quantity_used: number;
      total_cost: number;
      unit_of_measure?: string;
      source?: string;
    }) => {
      const { error } = await supabase.from("production_stage_costs").insert({
        ...input,
        source: input.source || "manual",
        unit_of_measure: input.unit_of_measure || "pcs",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["production-order"] });
      toast.success("Cost item added");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useDeleteStageCost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("production_stage_costs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["production-order"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// ── Update Order Status ──
export function useUpdateProductionOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; status?: string; notes?: string }) => {
      const updates: any = { ...input, updated_at: new Date().toISOString() };
      delete updates.id;
      if (input.status === "completed") updates.completed_date = new Date().toISOString().split("T")[0];
      const { error } = await supabase.from("production_orders").update(updates).eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["production-orders"] });
      qc.invalidateQueries({ queryKey: ["production-order"] });
      toast.success("Order updated");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// ── Helpers ──
export function useBOMs() {
  const { selectedCompany } = useCompany();
  return useQuery({
    queryKey: ["boms-for-production", selectedCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bill_of_materials")
        .select("id, bom_number, product_name, style_no, product_master_id, status")
        .eq("company_id", selectedCompany!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCompany?.id,
  });
}

// ── Daily Production Entries ──
export function useDailyEntries(stageId?: string) {
  return useQuery({
    queryKey: ["production-daily-entries", stageId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_daily_entries")
        .select("*")
        .eq("stage_id", stageId!)
        .order("entry_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!stageId,
  });
}

export function useUpsertDailyEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      stage_id: string;
      entry_date: string;
      input_qty: number;
      output_qty: number;
      wastage_qty: number;
      notes?: string;
    }) => {
      const { data: user } = await supabase.auth.getUser();

      // Upsert the daily entry. Stage totals (output/wastage) and the rolled
      // input are recomputed server-side by the sync_production_order trigger,
      // which is the single source of truth — no client-side rollup needed.
      const { error } = await supabase
        .from("production_daily_entries")
        .upsert(
          {
            stage_id: input.stage_id,
            entry_date: input.entry_date,
            input_qty: input.input_qty,
            output_qty: input.output_qty,
            wastage_qty: input.wastage_qty,
            notes: input.notes || null,
            created_by: user?.user?.id || null,
          },
          { onConflict: "stage_id,entry_date" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["production-daily-entries"] });
      qc.invalidateQueries({ queryKey: ["production-order"] });
      qc.invalidateQueries({ queryKey: ["production-orders"] });
      toast.success("Daily entry saved");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// ── Daily Summary ──
export function useDailySummary(date: string) {
  const { selectedCompany } = useCompany();
  return useQuery({
    queryKey: ["production-daily-summary", selectedCompany?.id, date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_daily_entries")
        .select(`
          id, entry_date, input_qty, output_qty, wastage_qty, notes,
          stage:production_order_stages!stage_id (
            id, stage_name, sequence_order,
            production_stage_costs (total_cost),
            order:production_orders!order_id (
              id, order_number, product_name, target_qty
            )
          )
        `)
        .eq("entry_date", date);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCompany?.id && !!date,
  });
}

export function useCPOs() {
  const { selectedCompany } = useCompany();
  return useQuery({
    queryKey: ["cpos-for-production", selectedCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_purchase_orders")
        .select("id, cpo_number, notes, total_amount, items:customer_po_items(id, item_name, style_no, color, size, quantity_ordered, unit_price, product_master_id)")
        .eq("company_id", selectedCompany!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCompany?.id,
  });
}

// ── Material Consumption (Phase 3) ──
export function useIssueStageMaterials() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { stage_id: string; location_id: string }) => {
      const { data, error } = await (supabase as any).rpc("issue_production_stage_materials", {
        p_stage_id: input.stage_id,
        p_location_id: input.location_id,
      });
      if (error) throw error;
      return data as { issued: any[]; shortfalls: any[]; reference: string };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["production-order"] });
      qc.invalidateQueries({ queryKey: ["warehouse-items"] });
      qc.invalidateQueries({ queryKey: ["warehouse-bin-allocations"] });
      const issued = data?.issued?.length ?? 0;
      const short = data?.shortfalls ?? [];
      if (issued > 0) toast.success(`Issued ${issued} material line(s) to production`);
      if (short.length > 0) {
        toast.error(`${short.length} line(s) not issued — ${short.map((s: any) => `${s.item}: ${s.error}`).join("; ")}`);
      } else if (issued === 0) {
        toast.info("No BOM-linked materials left to issue for this stage");
      }
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to issue materials"),
  });
}
