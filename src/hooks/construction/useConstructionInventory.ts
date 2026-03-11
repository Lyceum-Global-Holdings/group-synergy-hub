import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";
import { useAccessibleCompanyIds } from "./useAccessibleCompanyIds";
import { assertUserCanEditLocation } from "./locationPermissionGuard";
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
  const { data: accessibleIds } = useAccessibleCompanyIds();

  return useQuery({
    queryKey: ["construction-item-master", selectedCompany?.id, category, accessibleIds],
    queryFn: async () => {
      let query = supabase
        .from("construction_item_master")
        .select("*")
        .order("item_name", { ascending: true });

      if (selectedCompany?.id && accessibleIds && accessibleIds.length > 0) {
        query = query.in("company_id", accessibleIds);
      } else if (selectedCompany?.id) {
        query = query.eq("company_id", selectedCompany.id);
      }

      if (category) {
        query = query.eq("category", category);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ConstructionItemMaster[];
    },
    staleTime: 0,
    refetchOnMount: "always",
  });
}

export interface CreateItemMasterData {
  item_code: string;
  item_name: string;
  category: ItemCategory;
  section: ItemSection;
  sub_category?: string;
  color?: string;
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
      const { data: authData, error: authError } = await supabase.auth.getUser();

      if (authError || !authData.user) {
        throw new Error("You must be logged in to create items. Please sign in and try again.");
      }

      if (!selectedCompany?.id) {
        throw new Error("No company selected. Please select a company first.");
      }

      const { data: result, error } = await supabase
        .from("construction_item_master")
        .insert({
          ...data,
          company_id: selectedCompany.id,
          created_by: authData.user.id,
        })
        .select()
        .single();

      if (error) {
        console.error("Create item error:", error);
        throw error;
      }
      return result;
    },
    onSuccess: () => {
      // Invalidate all related queries to update allocation views
      queryClient.invalidateQueries({ queryKey: ["construction-item-master"] });
      queryClient.invalidateQueries({ queryKey: ["construction-dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["construction-serial-numbers"] });
      queryClient.invalidateQueries({ queryKey: ["construction-inventory-stock"] });
      toast({ title: "Item created successfully" });
    },
    onError: (error: Error) => {
      console.error("Create item mutation error:", error);
      toast({ title: "Failed to create item", description: error.message, variant: "destructive" });
    },
  });
}

// Create Item Master with Serial Number (for machines)
export interface CreateItemMasterWithSerialData extends CreateItemMasterData {
  serial_number?: string;
  current_location_id?: string;
  condition?: string;
  availability?: string;
  warranty_expiry?: string;
  asset_value?: number;
}

export function useCreateItemMasterWithSerial() {
  const queryClient = useQueryClient();
  const { selectedCompany } = useCompany();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateItemMasterWithSerialData) => {
      const { data: authData, error: authError } = await supabase.auth.getUser();

      if (authError || !authData.user) {
        throw new Error("You must be logged in to create items. Please sign in and try again.");
      }

      if (!selectedCompany?.id) {
        throw new Error("No company selected. Please select a company first.");
      }

      // Extract serial number fields
      const { serial_number, current_location_id, condition, availability, warranty_expiry, asset_value, ...itemData } = data;

      await assertUserCanEditLocation(authData.user.id, current_location_id);

      // Create item master first
      const { data: itemResult, error: itemError } = await supabase
        .from("construction_item_master")
        .insert({
          ...itemData,
          company_id: selectedCompany.id,
          created_by: authData.user.id,
        })
        .select()
        .single();

      if (itemError) {
        console.error("Create item with serial error:", itemError);
        throw itemError;
      }

      // If serial number provided (for machines), create serial number record
      if (serial_number && itemData.is_serial_tracked) {
        const { data: serialResult, error: serialError } = await supabase
          .from("construction_serial_numbers")
          .insert({
            item_master_id: itemResult.id,
            serial_number,
            current_location_id: current_location_id || null,
            condition: condition || "working",
            availability: availability || "available",
            warranty_expiry: warranty_expiry || null,
            asset_value: asset_value || null,
            company_id: selectedCompany.id,
            created_by: authData.user.id,
          })
          .select()
          .single();

        if (serialError) {
          console.error("Create serial error:", serialError);
          throw serialError;
        }

        // Log transaction
        await supabase.from("construction_inventory_transactions").insert({
          item_master_id: itemResult.id,
          serial_number_id: serialResult.id,
          transaction_type: "stock_in",
          quantity_change: 1,
          location_id: current_location_id || null,
          notes: `Machine added with serial number ${serial_number}`,
          company_id: selectedCompany.id,
          performed_by: authData.user.id,
        });

        return { item: itemResult, serial: serialResult };
      }

      return { item: itemResult, serial: null };
    },
    onSuccess: () => {
      // Invalidate all related queries to update allocation views
      queryClient.invalidateQueries({ queryKey: ["construction-item-master"] });
      queryClient.invalidateQueries({ queryKey: ["construction-dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["construction-serial-numbers"] });
      queryClient.invalidateQueries({ queryKey: ["construction-inventory-stock"] });
      queryClient.invalidateQueries({ queryKey: ["construction-transactions"] });
      toast({ title: "Item created successfully" });
    },
    onError: (error: Error) => {
      console.error("Create item with serial mutation error:", error);
      toast({ title: "Failed to create item", description: error.message, variant: "destructive" });
    },
  });
}

// Create Item Master with Initial Stock (for bulk categories: tools, safety, equipment, scaffolding)
export interface CreateItemMasterWithStockData extends CreateItemMasterData {
  initial_quantity?: number;
  location_id?: string;
}

export function useCreateItemMasterWithStock() {
  const queryClient = useQueryClient();
  const { selectedCompany } = useCompany();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateItemMasterWithStockData) => {
      const { data: authData, error: authError } = await supabase.auth.getUser();

      if (authError || !authData.user) {
        throw new Error("You must be logged in to create items. Please sign in and try again.");
      }

      if (!selectedCompany?.id) {
        throw new Error("No company selected. Please select a company first.");
      }

      // Extract stock fields
      const { initial_quantity, location_id, ...itemData } = data;

      await assertUserCanEditLocation(authData.user.id, location_id);

      // Create item master first (ensure is_serial_tracked is false for bulk items)
      const { data: itemResult, error: itemError } = await supabase
        .from("construction_item_master")
        .insert({
          ...itemData,
          is_serial_tracked: false,
          company_id: selectedCompany.id,
          created_by: authData.user.id,
        })
        .select()
        .single();

      if (itemError) {
        console.error("Create item with stock error:", itemError);
        throw itemError;
      }

      // If initial quantity and location provided, create stock record
      if (initial_quantity && initial_quantity > 0 && location_id) {
        const { error: stockError } = await supabase
          .from("construction_inventory_stock")
          .insert({
            item_master_id: itemResult.id,
            location_id,
            quantity: initial_quantity,
            company_id: selectedCompany.id,
          });

        if (stockError) {
          console.error("Create stock error:", stockError);
          throw stockError;
        }

        // Log transaction
        await supabase.from("construction_inventory_transactions").insert({
          item_master_id: itemResult.id,
          transaction_type: "initial_stock",
          quantity_change: initial_quantity,
          location_id,
          notes: `Initial stock of ${initial_quantity} units added`,
          company_id: selectedCompany.id,
          performed_by: authData.user.id,
        });

        return { item: itemResult, stock: { quantity: initial_quantity, location_id } };
      }

      return { item: itemResult, stock: null };
    },
    onSuccess: () => {
      // Invalidate all related queries to update allocation views
      queryClient.invalidateQueries({ queryKey: ["construction-item-master"] });
      queryClient.invalidateQueries({ queryKey: ["construction-dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["construction-inventory-stock"] });
      queryClient.invalidateQueries({ queryKey: ["construction-transactions"] });
      toast({ title: "Item created successfully" });
    },
    onError: (error: Error) => {
      console.error("Create item with stock mutation error:", error);
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
  const { data: accessibleIds } = useAccessibleCompanyIds();

  return useQuery({
    queryKey: ["construction-serial-numbers", selectedCompany?.id, itemMasterId, accessibleIds],
    queryFn: async () => {
      let query = supabase
        .from("construction_serial_numbers")
        .select(`
          *,
          item_master:construction_item_master(*),
          location:warehouse_locations(id, name)
        `)
        .order("serial_number", { ascending: true });

      if (selectedCompany?.id && accessibleIds && accessibleIds.length > 0) {
        query = query.in("company_id", accessibleIds);
      } else if (selectedCompany?.id) {
        query = query.eq("company_id", selectedCompany.id);
      }

      if (itemMasterId) {
        query = query.eq("item_master_id", itemMasterId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ConstructionSerialNumber[];
    },
    staleTime: 0,
    refetchOnMount: "always",
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

export interface UpdateSerialNumberData {
  id: string;
  current_location_id?: string | null;
  condition?: string;
  availability?: string;
  notes?: string;
}

export function useUpdateSerialNumber() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...data }: UpdateSerialNumberData) => {
      const { data: result, error } = await supabase
        .from("construction_serial_numbers")
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select(`
          *,
          location:warehouse_locations(id, name)
        `)
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["construction-serial-numbers"] });
      queryClient.invalidateQueries({ queryKey: ["construction-inventory-stock"] });
      toast({ title: "Serial number updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update serial number", description: error.message, variant: "destructive" });
    },
  });
}

// ==================== STOCK (Non-Serial Items) ====================

export function useInventoryStock(locationId?: string) {
  const { selectedCompany } = useCompany();
  const { data: accessibleIds } = useAccessibleCompanyIds();

  return useQuery({
    queryKey: ["construction-inventory-stock", selectedCompany?.id, locationId, accessibleIds],
    queryFn: async () => {
      let query = supabase
        .from("construction_inventory_stock")
        .select(`
          *,
          item_master:construction_item_master(*),
          location:warehouse_locations(id, name)
        `)
        .order("created_at", { ascending: false });

      if (selectedCompany?.id && accessibleIds && accessibleIds.length > 0) {
        query = query.in("company_id", accessibleIds);
      } else if (selectedCompany?.id) {
        query = query.eq("company_id", selectedCompany.id);
      }

      if (locationId) {
        query = query.eq("location_id", locationId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ConstructionInventoryStock[];
    },
    staleTime: 0,
    refetchOnMount: "always",
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
  const { data: accessibleIds } = useAccessibleCompanyIds();

  return useQuery({
    queryKey: ["construction-transfers", selectedCompany?.id, status, accessibleIds],
    queryFn: async () => {
      let query = supabase
        .from("construction_inventory_transfers")
        .select(`
          *,
          from_location:warehouse_locations!construction_inventory_transfers_from_location_id_fkey(id, name),
          to_location:warehouse_locations!construction_inventory_transfers_to_location_id_fkey(id, name),
          construction_transfer_items(id, quantity, item_master_id, serial_number_id, item_master:construction_item_master(id, item_name))
        `)
        .order("transfer_date", { ascending: false });

      if (selectedCompany?.id && accessibleIds && accessibleIds.length > 0) {
        query = query.in("company_id", accessibleIds);
      } else if (selectedCompany?.id) {
        query = query.eq("company_id", selectedCompany.id);
      }

      if (status) {
        query = query.eq("status", status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ConstructionTransfer[];
    },
    staleTime: 0,
    refetchOnMount: "always",
  });
}

// ==================== REPAIRS ====================

export function useRepairRecords(status?: string) {
  const { selectedCompany } = useCompany();
  const { data: accessibleIds } = useAccessibleCompanyIds();

  return useQuery({
    queryKey: ["construction-repairs", selectedCompany?.id, status, accessibleIds],
    queryFn: async () => {
      let query = supabase
        .from("construction_repair_records")
        .select(`
          *,
          item_master:construction_item_master(*),
          serial_number:construction_serial_numbers(*)
        `)
        .order("repair_date", { ascending: false });

      if (selectedCompany?.id && accessibleIds && accessibleIds.length > 0) {
        query = query.in("company_id", accessibleIds);
      } else if (selectedCompany?.id) {
        query = query.eq("company_id", selectedCompany.id);
      }

      if (status) {
        query = query.eq("status", status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ConstructionRepairRecord[];
    },
    staleTime: 0,
    refetchOnMount: "always",
  });
}

// ==================== TRANSACTIONS (Audit Log) ====================

export function useTransactions(limit: number = 50) {
  const { selectedCompany } = useCompany();
  const { data: accessibleIds } = useAccessibleCompanyIds();

  return useQuery({
    queryKey: ["construction-transactions", selectedCompany?.id, limit, accessibleIds],
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

      if (selectedCompany?.id && accessibleIds && accessibleIds.length > 0) {
        query = query.in("company_id", accessibleIds);
      } else if (selectedCompany?.id) {
        query = query.eq("company_id", selectedCompany.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    staleTime: 0,
    refetchOnMount: "always",
  });
}

export function useDashboardStats(locationId?: string | null) {
  const { selectedCompany } = useCompany();
  const { data: accessibleIds } = useAccessibleCompanyIds();

  return useQuery({
    queryKey: ["construction-dashboard-stats", selectedCompany?.id, accessibleIds, locationId],
    queryFn: async () => {
      // Build queries based on company filter
      let itemsQuery = supabase
        .from("construction_item_master")
        .select("category, is_serial_tracked");
      
      let transfersQuery = supabase
        .from("construction_inventory_transfers")
        .select("status");
      
      let repairsQuery = supabase
        .from("construction_repair_records")
        .select("status");

      // Apply company filter - use accessible IDs for cross-company visibility
      if (selectedCompany?.id && accessibleIds && accessibleIds.length > 0) {
        itemsQuery = itemsQuery.in("company_id", accessibleIds);
        transfersQuery = transfersQuery.in("company_id", accessibleIds);
        repairsQuery = repairsQuery.in("company_id", accessibleIds);
      } else if (selectedCompany?.id) {
        itemsQuery = itemsQuery.eq("company_id", selectedCompany.id);
        transfersQuery = transfersQuery.eq("company_id", selectedCompany.id);
        repairsQuery = repairsQuery.eq("company_id", selectedCompany.id);
      }

      // When filtering by location, also fetch serials/stocks with item_master_id to resolve categories
      let serialsWithItemQuery = supabase
        .from("construction_serial_numbers")
        .select("condition, availability, item_master_id, current_location_id");
      let stocksWithItemQuery = supabase
        .from("construction_inventory_stock")
        .select("quantity, reserved_quantity, item_master_id, location_id");

      // Apply same company filters to these queries
      if (selectedCompany?.id && accessibleIds && accessibleIds.length > 0) {
        serialsWithItemQuery = serialsWithItemQuery.in("company_id", accessibleIds);
        stocksWithItemQuery = stocksWithItemQuery.in("company_id", accessibleIds);
      } else if (selectedCompany?.id) {
        serialsWithItemQuery = serialsWithItemQuery.eq("company_id", selectedCompany.id);
        stocksWithItemQuery = stocksWithItemQuery.eq("company_id", selectedCompany.id);
      }

      if (locationId) {
        serialsWithItemQuery = serialsWithItemQuery.eq("current_location_id", locationId);
        stocksWithItemQuery = stocksWithItemQuery.eq("location_id", locationId);
      }

      // Execute all queries
      const [itemsResult, serialsResult, stocksResult, transfersResult, repairsResult] = await Promise.all([
        itemsQuery,
        serialsWithItemQuery,
        stocksWithItemQuery,
        transfersQuery,
        repairsQuery,
      ]);

      const items = itemsResult.data;
      const serials = serialsResult.data;
      const stocks = stocksResult.data;
      const transfers = transfersResult.data;
      const repairs = repairsResult.data;

      // When location is selected, derive item counts from serials/stocks at that location
      let totalItems: number;
      let categoryCount: Record<string, number>;

      if (locationId) {
        // Get unique item_master_ids present at this location
        const itemIdsAtLocation = new Set<string>();
        serials?.forEach(s => { if (s.item_master_id) itemIdsAtLocation.add(s.item_master_id); });
        stocks?.forEach(s => { if (s.item_master_id) itemIdsAtLocation.add(s.item_master_id); });

        // Filter items to only those present at this location
        const locationItems = items?.filter(item => {
          // items don't have id in the select, so we need to fetch with id
          return true; // We'll use a different approach
        });

        // Fetch item categories for items at this location
        if (itemIdsAtLocation.size > 0) {
          const { data: locationItemDetails } = await supabase
            .from("construction_item_master")
            .select("id, category")
            .in("id", Array.from(itemIdsAtLocation));

          totalItems = locationItemDetails?.length || 0;
          categoryCount = locationItemDetails?.reduce((acc, item) => {
            acc[item.category] = (acc[item.category] || 0) + 1;
            return acc;
          }, {} as Record<string, number>) || {};
        } else {
          totalItems = 0;
          categoryCount = {};
        }
      } else {
        totalItems = items?.length || 0;
        categoryCount = items?.reduce((acc, item) => {
          acc[item.category] = (acc[item.category] || 0) + 1;
          return acc;
        }, {} as Record<string, number>) || {};
      }

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
        totalItems,
        categoryCount,
        serialStats,
        stockStats,
        transferStats,
        repairStats,
      };
    },
    staleTime: 0, // Always consider data stale
    refetchOnMount: "always", // Always refetch when component mounts
    refetchOnWindowFocus: true, // Refetch when window regains focus
  });
}

// ==================== LOCATIONS (from existing warehouse_locations) ====================

export function useLocations() {
  const { selectedCompany } = useCompany();
  const { data: accessibleIds } = useAccessibleCompanyIds();

  return useQuery({
    queryKey: ["warehouse-locations-with-inventory", selectedCompany?.id, accessibleIds],
    queryFn: async () => {
      const companyIds = (selectedCompany?.id && accessibleIds && accessibleIds.length > 0)
        ? accessibleIds
        : (selectedCompany?.id ? [selectedCompany.id] : []);

      // First, get all locations (either matching companies or NULL company_id)
      let locationsQuery = supabase
        .from("warehouse_locations")
        .select("id, name, type")
        .order("name", { ascending: true });

      if (companyIds.length > 0) {
        const orFilter = companyIds.map(id => `company_id.eq.${id}`).join(",");
        locationsQuery = locationsQuery.or(`${orFilter},company_id.is.null`);
      }

      const { data: locations, error: locError } = await locationsQuery;
      if (locError) throw locError;

      // Also fetch locations that have serials/stocks for accessible companies
      if (companyIds.length > 0) {
        const { data: serialLocations } = await supabase
          .from("construction_serial_numbers")
          .select("current_location_id")
          .in("company_id", companyIds)
          .not("current_location_id", "is", null);

        const { data: stockLocations } = await supabase
          .from("construction_inventory_stock")
          .select("location_id")
          .in("company_id", companyIds)
          .not("location_id", "is", null);

        const inventoryLocationIds = new Set<string>();
        serialLocations?.forEach(s => {
          if (s.current_location_id) inventoryLocationIds.add(s.current_location_id);
        });
        stockLocations?.forEach(s => {
          if (s.location_id) inventoryLocationIds.add(s.location_id);
        });

        const existingLocationIds = new Set(locations?.map(l => l.id) || []);
        const missingLocationIds = Array.from(inventoryLocationIds).filter(id => !existingLocationIds.has(id));

        if (missingLocationIds.length > 0) {
          const { data: additionalLocations } = await supabase
            .from("warehouse_locations")
            .select("id, name, type")
            .in("id", missingLocationIds);

          if (additionalLocations) {
            locations?.push(...additionalLocations);
          }
        }
      }

      return (locations || []).sort((a, b) => a.name.localeCompare(b.name));
    },
    staleTime: 0,
    refetchOnMount: "always",
  });
}

// ==================== BULK CREATE ITEM MASTER ====================

export interface BulkCreateItemMasterData {
  items: CreateItemMasterData[];
}

export function useBulkCreateItemMaster() {
  const queryClient = useQueryClient();
  const { selectedCompany } = useCompany();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: BulkCreateItemMasterData) => {
      const { data: user } = await supabase.auth.getUser();

      const itemsWithMeta = data.items.map(item => ({
        ...item,
        company_id: selectedCompany?.id,
        created_by: user.user?.id,
      }));

      const { data: result, error } = await supabase
        .from("construction_item_master")
        .insert(itemsWithMeta)
        .select();

      if (error) throw error;
      return result;
    },
    onSuccess: (result) => {
      // Invalidate all related queries to update allocation views
      queryClient.invalidateQueries({ queryKey: ["construction-item-master"] });
      queryClient.invalidateQueries({ queryKey: ["construction-dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["construction-serial-numbers"] });
      queryClient.invalidateQueries({ queryKey: ["construction-inventory-stock"] });
      toast({ title: `${result.length} items imported successfully` });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to import items", description: error.message, variant: "destructive" });
    },
  });
}

// ==================== BULK CREATE ITEM MASTER WITH SERIALS (for machines) ====================

export interface BulkCreateItemWithSerialData extends CreateItemMasterWithSerialData {}

export interface BulkCreateItemMasterWithSerialsData {
  items: BulkCreateItemWithSerialData[];
}

export function useBulkCreateItemMasterWithSerials() {
  const queryClient = useQueryClient();
  const { selectedCompany } = useCompany();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: BulkCreateItemMasterWithSerialsData) => {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      
      // Validate authentication
      if (authError || !authData.user) {
        throw new Error("You must be logged in to import items. Please sign in and try again.");
      }

      // Validate company selection
      if (!selectedCompany?.id) {
        throw new Error("No company selected. Please select a company first.");
      }

      const results: { item: any; serial: any }[] = [];
      const errors: string[] = [];

      for (const itemData of data.items) {
        const { serial_number, current_location_id, condition, availability, warranty_expiry, asset_value, ...baseItemData } = itemData;

        try {
          // Create item master
          const { data: itemResult, error: itemError } = await supabase
            .from("construction_item_master")
            .insert({
              ...baseItemData,
              company_id: selectedCompany.id,
              created_by: authData.user.id,
            })
            .select()
            .single();

          if (itemError) {
            console.error("Item insert error:", itemError);
            errors.push(`Failed to create ${itemData.item_name}: ${itemError.message}`);
            continue;
          }

          let serialResult = null;

          // If serial number provided (for machines), create serial number record
          if (serial_number && baseItemData.is_serial_tracked) {
            const { data: serial, error: serialError } = await supabase
              .from("construction_serial_numbers")
              .insert({
                item_master_id: itemResult.id,
                serial_number,
                current_location_id: current_location_id || null,
                condition: condition || "working",
                availability: availability || "available",
                warranty_expiry: warranty_expiry || null,
                asset_value: asset_value || null,
                company_id: selectedCompany.id,
                created_by: authData.user.id,
              })
              .select()
              .single();

            if (serialError) {
              console.error("Serial insert error:", serialError);
              errors.push(`Failed to create serial for ${itemData.item_name}: ${serialError.message}`);
            } else {
              serialResult = serial;

              // Log transaction
              const { error: txError } = await supabase.from("construction_inventory_transactions").insert({
                item_master_id: itemResult.id,
                serial_number_id: serial.id,
                transaction_type: "stock_in",
                quantity_change: 1,
                location_id: current_location_id || null,
                notes: `Machine imported with serial number ${serial_number}`,
                company_id: selectedCompany.id,
                performed_by: authData.user.id,
              });

              if (txError) {
                console.error("Transaction log error:", txError);
              }
            }
          }

          results.push({ item: itemResult, serial: serialResult });
        } catch (err: any) {
          console.error("Unexpected error for item:", itemData.item_name, err);
          errors.push(`Unexpected error for ${itemData.item_name}: ${err.message}`);
        }
      }

      // If all items failed, throw error
      if (results.length === 0 && errors.length > 0) {
        throw new Error(`Import failed: ${errors.join("; ")}`);
      }

      return { results, errors };
    },
    onSuccess: ({ results, errors }) => {
      // Invalidate all related queries to update allocation views
      queryClient.invalidateQueries({ queryKey: ["construction-item-master"] });
      queryClient.invalidateQueries({ queryKey: ["construction-dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["construction-serial-numbers"] });
      queryClient.invalidateQueries({ queryKey: ["construction-inventory-stock"] });
      queryClient.invalidateQueries({ queryKey: ["construction-transactions"] });
      
      if (errors.length > 0) {
        toast({ 
          title: `${results.length} items imported with ${errors.length} errors`, 
          description: errors.slice(0, 2).join("; "),
          variant: "destructive" 
        });
      } else {
        toast({ title: `${results.length} items imported successfully` });
      }
    },
    onError: (error: Error) => {
      console.error("Bulk import mutation error:", error);
      toast({ title: "Failed to import items", description: error.message, variant: "destructive" });
    },
  });
}

// ==================== BULK CREATE ITEM MASTER WITH STOCK (for bulk categories) ====================

export interface BulkCreateItemWithStockData extends CreateItemMasterWithStockData {}

export interface BulkCreateItemMasterWithStockData {
  items: BulkCreateItemWithStockData[];
}

export function useBulkCreateItemMasterWithStock() {
  const queryClient = useQueryClient();
  const { selectedCompany } = useCompany();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: BulkCreateItemMasterWithStockData) => {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      
      // Validate authentication
      if (authError || !authData.user) {
        throw new Error("You must be logged in to import items. Please sign in and try again.");
      }

      // Validate company selection
      if (!selectedCompany?.id) {
        throw new Error("No company selected. Please select a company first.");
      }

      const results: { item: any; stock: any }[] = [];
      const errors: string[] = [];

      for (const itemData of data.items) {
        const { initial_quantity, location_id, ...baseItemData } = itemData;

        try {
          // Create item master (ensure is_serial_tracked is false)
          const { data: itemResult, error: itemError } = await supabase
            .from("construction_item_master")
            .insert({
              ...baseItemData,
              is_serial_tracked: false,
              company_id: selectedCompany.id,
              created_by: authData.user.id,
            })
            .select()
            .single();

          if (itemError) {
            console.error("Item insert error:", itemError);
            errors.push(`Failed to create ${itemData.item_name}: ${itemError.message}`);
            continue;
          }

          let stockResult = null;

          // If initial quantity and location provided, create stock record
          if (initial_quantity && initial_quantity > 0 && location_id) {
            const { data: stock, error: stockError } = await supabase
              .from("construction_inventory_stock")
              .insert({
                item_master_id: itemResult.id,
                location_id,
                quantity: initial_quantity,
                company_id: selectedCompany.id,
              })
              .select()
              .single();

            if (stockError) {
              console.error("Stock insert error:", stockError);
              errors.push(`Failed to create stock for ${itemData.item_name}: ${stockError.message}`);
            } else {
              stockResult = stock;

              // Log transaction
              const { error: txError } = await supabase.from("construction_inventory_transactions").insert({
                item_master_id: itemResult.id,
                transaction_type: "initial_stock",
                quantity_change: initial_quantity,
                location_id,
                notes: `Initial stock of ${initial_quantity} units imported`,
                company_id: selectedCompany.id,
                performed_by: authData.user.id,
              });

              if (txError) {
                console.error("Transaction log error:", txError);
              }
            }
          }

          results.push({ item: itemResult, stock: stockResult });
        } catch (err: any) {
          console.error("Unexpected error for item:", itemData.item_name, err);
          errors.push(`Unexpected error for ${itemData.item_name}: ${err.message}`);
        }
      }

      // If all items failed, throw error
      if (results.length === 0 && errors.length > 0) {
        throw new Error(`Import failed: ${errors.join("; ")}`);
      }

      return { results, errors };
    },
    onSuccess: ({ results, errors }) => {
      // Invalidate all related queries to update allocation views
      queryClient.invalidateQueries({ queryKey: ["construction-item-master"] });
      queryClient.invalidateQueries({ queryKey: ["construction-dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["construction-inventory-stock"] });
      queryClient.invalidateQueries({ queryKey: ["construction-transactions"] });
      
      if (errors.length > 0) {
        toast({ 
          title: `${results.length} items imported with ${errors.length} errors`, 
          description: errors.slice(0, 2).join("; "),
          variant: "destructive" 
        });
      } else {
        toast({ title: `${results.length} items imported successfully with initial stock` });
      }
    },
    onError: (error: Error) => {
      console.error("Bulk import with stock mutation error:", error);
      toast({ title: "Failed to import items", description: error.message, variant: "destructive" });
    },
  });
}

// ==================== DELETE SERIAL NUMBER ====================

export function useDeleteSerialNumber() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (serialId: string) => {
      // Delete related records first to avoid FK constraint violations
      const { error: txError } = await supabase
        .from("construction_inventory_transactions")
        .delete()
        .eq("serial_number_id", serialId);
      if (txError) throw txError;

      const { error: transferError } = await supabase
        .from("construction_transfer_items")
        .delete()
        .eq("serial_number_id", serialId);
      if (transferError) throw transferError;

      const { error: repairError } = await supabase
        .from("construction_repair_records")
        .delete()
        .eq("serial_number_id", serialId);
      if (repairError) throw repairError;

      const { error } = await supabase
        .from("construction_serial_numbers")
        .delete()
        .eq("id", serialId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["construction-serial-numbers"] });
      queryClient.invalidateQueries({ queryKey: ["construction-inventory-stock"] });
      queryClient.invalidateQueries({ queryKey: ["construction-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["construction-transfers"] });
      toast({ title: "Serial number and related records deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to delete serial number", description: error.message, variant: "destructive" });
    },
  });
}

// ==================== DELETE INVENTORY STOCK ====================

export function useDeleteInventoryStock() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (stockId: string) => {
      const { error } = await supabase
        .from("construction_inventory_stock")
        .delete()
        .eq("id", stockId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["construction-inventory-stock"] });
      toast({ title: "Stock record deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to delete stock record", description: error.message, variant: "destructive" });
    },
  });
}
