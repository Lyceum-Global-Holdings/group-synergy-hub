import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";

export type RepairStatus = 'sent_for_repair' | 'in_repair' | 'repaired' | 'returned' | 'discarded';

export interface RepairRecord {
  id: string;
  company_id: string | null;
  item_id: string;
  item_name: string;
  quantity: number;
  unit: string | null;
  location_id: string | null;
  repair_status: RepairStatus;
  service_provider: string | null;
  remarks: string | null;
  sent_date: string;
  expected_return_date: string | null;
  actual_return_date: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  warehouse_location?: { id: string; name: string } | null;
  profiles?: { full_name: string | null; email: string | null } | null;
  inventory_item?: { image_url: string | null } | null;
}

export interface CreateRepairData {
  item_id: string;
  item_name: string;
  quantity: number;
  unit?: string;
  location_id: string;
  service_provider?: string;
  remarks?: string;
  expected_return_date?: string;
}

export function useRepairRecords() {
  const { selectedCompany } = useCompany();

  return useQuery({
    queryKey: ["construction-repair-records", selectedCompany?.id],
    queryFn: async () => {
      let query = supabase
        .from("construction_repair_records")
        .select(`
          *,
          warehouse_location:warehouse_locations(id, name),
          inventory_item:construction_inventory_master!item_id(image_url)
        `)
        .order("created_at", { ascending: false });

      // Filter by company if selected, otherwise fetch records with null company_id
      if (selectedCompany?.id) {
        query = query.or(`company_id.eq.${selectedCompany.id},company_id.is.null`);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Fetch profile names for updated_by
      const records = data || [];
      const userIds = [...new Set(records.map(r => r.updated_by || r.created_by).filter(Boolean))];
      
      let profilesMap: Record<string, { full_name: string | null; email: string | null }> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", userIds);
        
        profiles?.forEach(p => {
          profilesMap[p.id] = { full_name: p.full_name, email: p.email };
        });
      }

      return records.map(record => ({
        ...record,
        profiles: profilesMap[record.updated_by || record.created_by || ""] || null,
      })) as RepairRecord[];
    },
    enabled: !!selectedCompany?.id,
  });
}

export function useCreateRepairRecord() {
  const queryClient = useQueryClient();
  const { selectedCompany } = useCompany();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateRepairData) => {
      const { data: user } = await supabase.auth.getUser();

      // 1. Get current item details and reduce quantity
      const { data: item, error: itemError } = await supabase
        .from("construction_inventory_master")
        .select("*")
        .eq("id", data.item_id)
        .single();

      if (itemError) throw itemError;

      if (item.quantity < data.quantity) {
        throw new Error(`Insufficient quantity. Available: ${item.quantity}`);
      }

      const newQuantity = item.quantity - data.quantity;

      // 2. Update inventory quantity (remove from available stock)
      const { error: updateError } = await supabase
        .from("construction_inventory_master")
        .update({ quantity: newQuantity })
        .eq("id", data.item_id);

      if (updateError) throw updateError;

      // 3. Create repair record
      const { data: repairRecord, error: repairError } = await supabase
        .from("construction_repair_records")
        .insert({
          item_id: data.item_id,
          item_name: data.item_name,
          quantity: data.quantity,
          unit: data.unit,
          location_id: data.location_id,
          service_provider: data.service_provider || null,
          remarks: data.remarks || null,
          expected_return_date: data.expected_return_date || null,
          repair_status: "sent_for_repair",
          company_id: selectedCompany?.id,
          created_by: user.user?.id,
        })
        .select()
        .single();

      if (repairError) throw repairError;

      // 4. Log the repair_sent transaction
      await supabase
        .from("construction_inventory_transactions")
        .insert({
          item_id: data.item_id,
          transaction_type: "repair_sent",
          quantity_change: -data.quantity,
          quantity_before: item.quantity,
          quantity_after: newQuantity,
          from_location_id: data.location_id,
          notes: `Sent for repair: ${data.item_name}${data.service_provider ? ` to ${data.service_provider}` : ""}`,
          unit: data.unit,
          company_id: selectedCompany?.id,
          created_by: user.user?.id,
        });

      return repairRecord;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["construction-repair-records"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-master"] });
      queryClient.invalidateQueries({ queryKey: ["construction-recent-transactions"] });
      toast({
        title: "Item sent for repair",
        description: "The item has been removed from available inventory and tracked for repair.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create repair record",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useUpdateRepairStatus() {
  const queryClient = useQueryClient();
  const { selectedCompany } = useCompany();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      repairId,
      newStatus,
      remarks,
    }: {
      repairId: string;
      newStatus: RepairStatus;
      remarks?: string;
    }) => {
      const { data: user } = await supabase.auth.getUser();

      // Get current repair record
      const { data: repairRecord, error: fetchError } = await supabase
        .from("construction_repair_records")
        .select("*")
        .eq("id", repairId)
        .single();

      if (fetchError) throw fetchError;

      const updateData: Record<string, unknown> = {
        repair_status: newStatus,
        updated_by: user.user?.id,
        updated_at: new Date().toISOString(),
      };

      if (remarks) {
        updateData.remarks = remarks;
      }

      // If status is "returned", set actual_return_date and add back to inventory
      if (newStatus === "returned") {
        updateData.actual_return_date = new Date().toISOString();

        // Get current inventory item
        const { data: inventoryItem, error: invError } = await supabase
          .from("construction_inventory_master")
          .select("*")
          .eq("id", repairRecord.item_id)
          .single();

        if (invError) throw invError;

        const newQuantity = (inventoryItem?.quantity || 0) + repairRecord.quantity;

        // Add quantity back to inventory
        const { error: updateInvError } = await supabase
          .from("construction_inventory_master")
          .update({ quantity: newQuantity })
          .eq("id", repairRecord.item_id);

        if (updateInvError) throw updateInvError;

        // Log the repair_returned transaction
        await supabase
          .from("construction_inventory_transactions")
          .insert({
            item_id: repairRecord.item_id,
            transaction_type: "repair_returned",
            quantity_change: repairRecord.quantity,
            quantity_before: inventoryItem?.quantity || 0,
            quantity_after: newQuantity,
            to_location_id: repairRecord.location_id,
            notes: `Returned from repair: ${repairRecord.item_name}`,
            unit: repairRecord.unit,
            company_id: selectedCompany?.id,
            created_by: user.user?.id,
          });
      }

      // If status is "discarded", do not add back to inventory
      // The item was already removed when sent for repair

      const { data, error } = await supabase
        .from("construction_repair_records")
        .update(updateData)
        .eq("id", repairId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["construction-repair-records"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-master"] });
      queryClient.invalidateQueries({ queryKey: ["construction-recent-transactions"] });
      toast({
        title: "Status updated",
        description: `Repair status changed to "${variables.newStatus.replace(/_/g, " ")}".`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update status",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
