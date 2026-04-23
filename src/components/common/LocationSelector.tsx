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
import { useCurrentUserLocationPermissions } from "@/hooks/useCurrentUserLocationPermissions";
import { useEffect, useMemo } from "react";

export function LocationSelector() {
  const { globalLocationId, setGlobalLocationId } = useLocationFilter();
  const { selectedCompany } = useCompany();
  const { data: permissions, isLoading: permissionsLoading } = useCurrentUserLocationPermissions();

  // Fetch effective locations for selected company (resolves inherited sub-locations)
  const { data: companyLocations = [] } = useQuery({
    queryKey: ["header-locations", selectedCompany?.id],
    queryFn: async (): Promise<Array<{ id: string; name: string; type: string; parent_id: string | null }>> => {
      if (!selectedCompany?.id) return [];

      const { data, error } = await supabase.rpc(
        "get_effective_locations_for_company" as any,
        { p_company_id: selectedCompany.id }
      );
      if (error) throw error;

      const rows = (data as any[]) || [];

      // Fallback: if nothing resolved for this company, show all top-level locations
      if (rows.length === 0) {
        const { data: allLocations, error: allError } = await supabase
          .from("warehouse_locations")
          .select("id, name, type, parent_id")
          .eq("type", "location")
          .order("name");
        if (allError) throw allError;
        return (allLocations ?? []) as any;
      }

      return rows;
    },
    enabled: !!selectedCompany?.id,
  });

  const canViewAll = permissions?.viewAllLocations === true;

  // Fail-open visibility: if user has no explicit location permissions, show all company locations
  const locations = useMemo(() => {
    if (permissionsLoading) return [];
    if (!permissions) return [];
    if (canViewAll) return companyLocations;

    const permittedIds = new Set([
      ...permissions.viewLocationIds,
      ...permissions.editLocationIds,
    ]);

    // Fail-open: no explicit permissions means unrestricted visibility
    if (permittedIds.size === 0) return companyLocations;
    return companyLocations.filter((loc) => permittedIds.has(loc.id));
  }, [companyLocations, permissions, permissionsLoading, canViewAll]);

  // Determine if user should see "All Locations" option
  const showAllOption = canViewAll || (permissions && permissions.viewLocationIds.length === 0 && permissions.editLocationIds.length === 0);

  useEffect(() => {
    if (permissionsLoading) return;

    if (showAllOption) {
      // Reset to null (All Locations) if current selection is invalid
      if (globalLocationId && !locations.some((loc) => loc.id === globalLocationId)) {
        setGlobalLocationId(null);
      }
      return;
    }

    // User has explicit permissions — auto-select first permitted location
    if (locations.length === 0) {
      if (globalLocationId !== null) setGlobalLocationId(null);
      return;
    }

    if (!globalLocationId || !locations.some((loc) => loc.id === globalLocationId)) {
      setGlobalLocationId(locations[0].id);
    }
  }, [showAllOption, permissionsLoading, globalLocationId, locations, setGlobalLocationId]);

  const selectValue = showAllOption
    ? (globalLocationId ?? "all")
    : (globalLocationId ?? locations[0]?.id);

  return (
    <div className="flex items-center gap-2 shrink-0">
      <MapPin className="h-4 w-4 text-muted-foreground" />
      <Select
        value={selectValue}
        onValueChange={(value) => setGlobalLocationId(showAllOption ? (value === "all" ? null : value) : value)}
      >
        <SelectTrigger className="w-[160px] shrink-0" disabled={locations.length === 0}>
          <SelectValue placeholder={showAllOption ? "All Locations" : "Select Location"} />
        </SelectTrigger>
        <SelectContent>
          {showAllOption && <SelectItem value="all">All Locations</SelectItem>}
          {locations.map((loc: any) => (
            <SelectItem key={loc.id} value={loc.id}>
              {loc.parent_id ? `↳ ${loc.name}` : loc.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

