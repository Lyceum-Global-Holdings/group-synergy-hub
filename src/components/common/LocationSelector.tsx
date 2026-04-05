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

  // Fetch locations for selected company (mapped + legacy fallback)
  const { data: companyLocations = [] } = useQuery({
    queryKey: ["header-locations", selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];

      const [{ data: mappedRows, error: mappedError }, { data: legacyRows, error: legacyError }] = await Promise.all([
        supabase
          .from("warehouse_location_companies")
          .select("warehouse_locations!inner(id, name, type)")
          .eq("company_id", selectedCompany.id)
          .eq("warehouse_locations.type", "location"),
        supabase
          .from("warehouse_locations")
          .select("id, name, type")
          .eq("company_id", selectedCompany.id)
          .eq("type", "location"),
      ]);

      if (mappedError) throw mappedError;
      if (legacyError) throw legacyError;

      const merged = new Map<string, { id: string; name: string; type: string }>();

      (mappedRows || []).forEach((row: any) => {
        const location = row.warehouse_locations;
        if (location?.id) merged.set(location.id, location);
      });

      (legacyRows || []).forEach((location: any) => {
        if (location?.id) merged.set(location.id, location);
      });

      const result = Array.from(merged.values()).sort((a, b) => a.name.localeCompare(b.name));

      // Fallback: if no locations mapped to this company, show all locations
      if (result.length === 0) {
        const { data: allLocations, error: allError } = await supabase
          .from("warehouse_locations")
          .select("id, name, type")
          .eq("type", "location")
          .order("name");
        if (allError) throw allError;
        return allLocations ?? [];
      }

      return result;
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
          {locations.map((loc) => (
            <SelectItem key={loc.id} value={loc.id}>
              {loc.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

