import { MapPin } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLocationFilter } from "@/contexts/LocationFilterContext";
import { useCompany } from "@/contexts/CompanyContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function LocationSelector() {
  const { globalLocationId, setGlobalLocationId } = useLocationFilter();
  const { selectedCompany } = useCompany();

  const { data: locations } = useQuery({
    queryKey: ['header-locations', selectedCompany?.id],
    queryFn: async () => {
      let query = supabase
        .from('warehouse_locations')
        .select('id, name')
        .eq('type', 'location')
        .order('name');

      if (selectedCompany?.id) {
        query = query.or(`company_id.eq.${selectedCompany.id},company_id.is.null`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="flex items-center gap-2 shrink-0">
      <MapPin className="h-4 w-4 text-muted-foreground" />
      <Select
        value={globalLocationId || "all"}
        onValueChange={(value) => setGlobalLocationId(value === "all" ? null : value)}
      >
        <SelectTrigger className="w-[160px] shrink-0">
          <SelectValue placeholder="All Locations" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Locations</SelectItem>
          {locations?.map((loc) => (
            <SelectItem key={loc.id} value={loc.id}>
              {loc.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
