import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { RentalUnitEvent, RentalUnitMaintenance } from "@/types/costumeRental";

// Append-only event timeline for a single unit.
export function useCostumeUnitEvents(unitId?: string) {
  const { data: events = [], isLoading } = useQuery({
    queryKey: ["costume-unit-events", unitId],
    enabled: !!unitId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("rental_unit_events")
        .select("*")
        .eq("unit_id", unitId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as RentalUnitEvent[];
    },
  });
  return { events, isLoading };
}

// Maintenance / service log for a single unit.
export function useCostumeUnitMaintenance(unitId?: string) {
  const { data: records = [], isLoading } = useQuery({
    queryKey: ["costume-unit-maintenance", unitId],
    enabled: !!unitId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("rental_unit_maintenance")
        .select("*")
        .eq("unit_id", unitId)
        .order("maintenance_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as RentalUnitMaintenance[];
    },
  });
  return { records, isLoading };
}
