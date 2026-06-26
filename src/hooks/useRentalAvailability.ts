import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Live availability of a costume style over [from, to]. excludeOrder lets an
// order being edited ignore its own bookings.
export function useRentalAvailability(
  costumeId: string | undefined,
  from: string | undefined,
  to: string | undefined,
  excludeOrder?: string,
) {
  return useQuery({
    queryKey: ["rental-availability", costumeId, from, to, excludeOrder ?? null],
    enabled: !!costumeId && !!from && !!to,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("rental_costume_available_units", {
        p_costume_id: costumeId,
        p_from: from,
        p_to: to,
        p_exclude_order: excludeOrder ?? null,
      });
      if (error) throw error;
      return Number(data ?? 0);
    },
  });
}

// Imperative one-off availability check (used inside the create dialog).
export async function fetchRentalAvailability(
  costumeId: string, from: string, to: string, excludeOrder?: string,
): Promise<number> {
  const { data, error } = await (supabase as any).rpc("rental_costume_available_units", {
    p_costume_id: costumeId, p_from: from, p_to: to, p_exclude_order: excludeOrder ?? null,
  });
  if (error) throw error;
  return Number(data ?? 0);
}
