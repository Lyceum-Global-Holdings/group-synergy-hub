import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";
import type {
  ConstructionItemMaster,
  ConstructionSerialNumber,
  ConstructionInventoryStock,
  ConstructionTransfer,
  ConstructionRepairRecord,
  ItemCategory,
  ItemSection,
} from "@/types/construction-inventory";

// ==================== ITEM MASTER ====================

export function useItemMaster(category?: ItemCategory) {
  const { selectedCompany } = useCompany();

  return useQuery({
    queryKey: ["construction-item-master", selectedCompany?.id, category],
    queryFn: async () => {
      let query = supabase
        .from("construction_item_master")
        .select("*")
        .order("item_name", { ascending: true });

      if (selectedCompany?.id) {
        query = query.eq("company_id", selectedCompany.id);
      }

      if (category) {
        query = query.eq("category", category);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ConstructionItemMaster[];
    },
  });
}

export interface CreateItemMasterData {
  item_code: string;
  item_name: string;
  category: ItemCategory;
  section: ItemSection;
  brand?: string;
  model?: string;
  unit_of_measurement?: string;
  description?: string;
  image_url?: string;
  is_serial_tracked?: boolean;
  unit_cost?: number;
  purchase_date?: string;
}

export function useCreateItemMaster() {
  const queryClient = useQueryClient();
  const { selectedCompany } = useCompany();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateItemMasterData) => {
      const { data: user } = await supabase.auth.getUser();

      const { data: result, error } = await supabase
        .from("construction_item_master")
        .insert({
          ...data,
          company_id: selectedCompany?.id,
          created_by: user.user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["construction-item-master"] });
      toast({ title: "Item created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create item", description: error.message, variant: "destructive" });
    },
  });
}

export function useUpdateItemMaster() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<CreateItemMasterData> & { id: string }) => {
      const { data: result, error } = await supabase
        .from("construction_item_master")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["construction-item-master"] });
      toast({ title: "Item updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update item", description: error.message, variant: "destructive" });
    },
  });
}

// ==================== SERIAL NUMBERS ====================

export function useSerialNumbers(itemMasterId?: string) {
  const { selectedCompany } = useCompany();

  return useQuery({
    queryKey: ["construction-serial-numbers", selectedCompany?.id, itemMasterId],
    queryFn: async () => {
      let query = supabase
        .from("construction_serial_numbers")
        .select(`
          *,
          item_master:construction_item_master(*),
          location:warehouse_locations(id, name)
        `)
        .order("serial_number", { ascending: true });

      if (selectedCompany?.id) {
        query = query.eq("company_id", selectedCompany.id);
      }

      if (itemMasterId) {
        query = query.eq("item_master_id", itemMasterId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ConstructionSerialNumber[];
    },
  });
}

export interface CreateSerialNumberData {
  item_master_id: string;
  serial_number: string;
  current_location_id?: string;
  condition?: string;
  availability?: string;
  notes?: string;
  purchase_date?: string;
  warranty_expiry?: string;
  asset_value?: number;
}

export function useCreateSerialNumber() {
  const queryClient = useQueryClient();
  const { selectedCompany } = useCompany();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateSerialNumberData) => {
      const { data: user } = await supabase.auth.getUser();

      const { data: result, error } = await supabase
        .from("construction_serial_numbers")
        .insert({
          ...data,
          company_id: selectedCompany?.id,
          created_by: user.user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Log transaction
      await supabase.from("construction_inventory_transactions").insert({
        item_master_id: data.item_master_id,
        serial_number_id: result.id,
        transaction_type: "stock_in",
        quantity_change: 1,
        location_id: data.current_location_id,
        notes: `Serial number ${data.serial_number} added`,
        company_id: selectedCompany?.id,
        performed_by: user.user?.id,
      });

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["construction-serial-numbers"] });
      queryClient.invalidateQueries({ queryKey: ["construction-transactions"] });
      toast({ title: "Serial number added successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to add serial number", description: error.message, variant: "destructive" });
    },
  });
}

// ==================== STOCK (Non-Serial Items) ====================

export function useInventoryStock(locationId?: string) {
  const { selectedCompany } = useCompany();

  return useQuery({
    queryKey: ["construction-inventory-stock", selectedCompany?.id, locationId],
    queryFn: async () => {
      let query = supabase
        .from("construction_inventory_stock")
        .select(`
          *,
          item_master:construction_item_master(*),
          location:warehouse_locations(id, name)
        `)
        .order("created_at", { ascending: false });

      if (selectedCompany?.id) {
        query = query.eq("company_id", selectedCompany.id);
      }

      if (locationId) {
        query = query.eq("location_id", locationId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ConstructionInventoryStock[];
    },
  });
}

export interface AddStockData {
  item_master_id: string;
  location_id: string;
  quantity: number;
}

export function useAddStock() {
  const queryClient = useQueryClient();
  const { selectedCompany } = useCompany();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: AddStockData) => {
      const { data: user } = await supabase.auth.getUser();

      // Check if stock record exists for this item+location
      const { data: existing } = await supabase
        .from("construction_inventory_stock")
        .select("*")
        .eq("item_master_id", data.item_master_id)
        .eq("location_id", data.location_id)
        .single();

      let result;
      if (existing) {
        // Update existing
        const newQty = existing.quantity + data.quantity;
        const { data: updated, error } = await supabase
          .from("construction_inventory_stock")
          .update({ quantity: newQty })
          .eq("id", existing.id)
          .select()
          .single();
        if (error) throw error;
        result = updated;
      } else {
        // Create new
        const { data: created, error } = await supabase
          .from("construction_inventory_stock")
          .insert({
            ...data,
            company_id: selectedCompany?.id,
          })
          .select()
          .single();
        if (error) throw error;
        result = created;
      }

      // Log transaction
      await supabase.from("construction_inventory_transactions").insert({
        item_master_id: data.item_master_id,
        transaction_type: "stock_in",
        quantity_change: data.quantity,
        location_id: data.location_id,
        notes: "Stock added",
        company_id: selectedCompany?.id,
        performed_by: user.user?.id,
      });

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["construction-inventory-stock"] });
      queryClient.invalidateQueries({ queryKey: ["construction-transactions"] });
      toast({ title: "Stock added successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to add stock", description: error.message, variant: "destructive" });
    },
  });
}

// ==================== TRANSFERS ====================

export function useTransfers(status?: string) {
  const { selectedCompany } = useCompany();

  return useQuery({
    queryKey: ["construction-transfers", selectedCompany?.id, status],
    queryFn: async () => {
      let query = supabase
        .from("construction_inventory_transfers")
        .select(`
          *,
          from_location:warehouse_locations!construction_inventory_transfers_from_location_id_fkey(id, name),
          to_location:warehouse_locations!construction_inventory_transfers_to_location_id_fkey(id, name)
        `)
        .order("transfer_date", { ascending: false });

      if (selectedCompany?.id) {
        query = query.eq("company_id", selectedCompany.id);
      }

      if (status) {
        query = query.eq("status", status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ConstructionTransfer[];
    },
  });
}

// ==================== REPAIRS ====================

export function useRepairRecords(status?: string) {
  const { selectedCompany } = useCompany();

  return useQuery({
    queryKey: ["construction-repairs", selectedCompany?.id, status],
    queryFn: async () => {
      let query = supabase
        .from("construction_repair_records")
        .select(`
          *,
          item_master:construction_item_master(*),
          serial_number:construction_serial_numbers(*)
        `)
        .order("repair_date", { ascending: false });

      if (selectedCompany?.id) {
        query = query.eq("company_id", selectedCompany.id);
      }

      if (status) {
        query = query.eq("status", status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ConstructionRepairRecord[];
    },
  });
}

// ==================== TRANSACTIONS (Audit Log) ====================

export function useTransactions(limit: number = 50) {
  const { selectedCompany } = useCompany();

  return useQuery({
    queryKey: ["construction-transactions", selectedCompany?.id, limit],
    queryFn: async () => {
      let query = supabase
        .from("construction_inventory_transactions")
        .select(`
          *,
          item_master:construction_item_master(id, item_name, item_code),
          location:warehouse_locations(id, name)
        `)
        .order("transaction_date", { ascending: false })
        .limit(limit);

      if (selectedCompany?.id) {
        query = query.eq("company_id", selectedCompany.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

// ==================== DASHBOARD STATS ====================

export function useDashboardStats() {
  const { selectedCompany } = useCompany();

  return useQuery({
    queryKey: ["construction-dashboard-stats", selectedCompany?.id],
    queryFn: async () => {
      const companyFilter = selectedCompany?.id ? `company_id.eq.${selectedCompany.id}` : "";

      // Get item counts by category
      const { data: items } = await supabase
        .from("construction_item_master")
        .select("category, is_serial_tracked")
        .or(companyFilter || "id.not.is.null");

      // Get serial numbers stats
      const { data: serials } = await supabase
        .from("construction_serial_numbers")
        .select("condition, availability")
        .or(companyFilter || "id.not.is.null");

      // Get stock totals
      const { data: stocks } = await supabase
        .from("construction_inventory_stock")
        .select("quantity, reserved_quantity")
        .or(companyFilter || "id.not.is.null");

      // Get transfer stats
      const { data: transfers } = await supabase
        .from("construction_inventory_transfers")
        .select("status")
        .or(companyFilter || "id.not.is.null");

      // Get repair stats
      const { data: repairs } = await supabase
        .from("construction_repair_records")
        .select("status")
        .or(companyFilter || "id.not.is.null");

      // Calculate stats
      const categoryCount = items?.reduce((acc, item) => {
        acc[item.category] = (acc[item.category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      const serialStats = {
        total: serials?.length || 0,
        working: serials?.filter(s => s.condition === "working").length || 0,
        underRepair: serials?.filter(s => s.condition === "under_repair").length || 0,
        available: serials?.filter(s => s.availability === "available").length || 0,
      };

      const stockStats = {
        totalQuantity: stocks?.reduce((sum, s) => sum + Number(s.quantity), 0) || 0,
        reservedQuantity: stocks?.reduce((sum, s) => sum + Number(s.reserved_quantity), 0) || 0,
      };

      const transferStats = {
        pending: transfers?.filter(t => t.status === "pending").length || 0,
        inTransit: transfers?.filter(t => t.status === "in_transit").length || 0,
        completed: transfers?.filter(t => t.status === "completed").length || 0,
      };

      const repairStats = {
        sentForRepair: repairs?.filter(r => r.status === "sent_for_repair").length || 0,
        inRepair: repairs?.filter(r => r.status === "in_repair").length || 0,
        repaired: repairs?.filter(r => r.status === "repaired").length || 0,
      };

      return {
        totalItems: items?.length || 0,
        categoryCount,
        serialStats,
        stockStats,
        transferStats,
        repairStats,
      };
    },
  });
}

// ==================== LOCATIONS (from existing warehouse_locations) ====================

export function useLocations() {
  const { selectedCompany } = useCompany();

  return useQuery({
    queryKey: ["warehouse-locations", selectedCompany?.id],
    queryFn: async () => {
      let query = supabase
        .from("warehouse_locations")
        .select("id, name, type")
        .order("name", { ascending: true });

      if (selectedCompany?.id) {
        query = query.eq("company_id", selectedCompany.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}
