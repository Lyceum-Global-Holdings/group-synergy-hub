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
      if (selectedCompany?.id) {
        // Get locations linked to this company via junction table
        const { data, error } = await supabase
          .from('warehouse_location_companies')
          .select('location_id, warehouse_locations!inner(id, name, type)')
          .eq('company_id', selectedCompany.id)
          .eq('warehouse_locations.type', 'location');
        if (error) throw error;
        return (data || [])
          .map((d: any) => d.warehouse_locations)
          .filter(Boolean)
          .sort((a: any, b: any) => a.name.localeCompare(b.name));
      } else {
        const { data, error } = await supabase
          .from('warehouse_locations')
          .select('id, name')
          .eq('type', 'location')
          .order('name');
        if (error) throw error;
        return data;
      }
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
