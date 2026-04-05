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
  const NO_LOCATION_ACCESS = "__no_location_access__";
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

  // Strict filtering: show only explicitly permitted locations unless View All is granted.
  const locations = useMemo(() => {
    if (permissionsLoading) return [];
    if (!permissions) return [];
    if (canViewAll) return companyLocations;

    const permittedIds = new Set([
      ...permissions.viewLocationIds,
      ...permissions.editLocationIds,
    ]);

    if (permittedIds.size === 0) return [];
    return companyLocations.filter((loc) => permittedIds.has(loc.id));
  }, [companyLocations, permissions, permissionsLoading, canViewAll]);

  useEffect(() => {
    if (canViewAll) {
      if (globalLocationId && !locations.some((loc) => loc.id === globalLocationId)) {
        setGlobalLocationId(null);
      }
      return;
    }

    if (locations.length === 0) {
      if (globalLocationId !== NO_LOCATION_ACCESS) setGlobalLocationId(NO_LOCATION_ACCESS);
      return;
    }

    if (!globalLocationId || !locations.some((loc) => loc.id === globalLocationId)) {
      setGlobalLocationId(locations[0].id);
    }
  }, [canViewAll, globalLocationId, locations, setGlobalLocationId]);

  const selectValue = canViewAll
    ? (globalLocationId ?? "all")
    : (globalLocationId ?? locations[0]?.id);

  return (
    <div className="flex items-center gap-2 shrink-0">
      <MapPin className="h-4 w-4 text-muted-foreground" />
      <Select
        value={selectValue}
        onValueChange={(value) => setGlobalLocationId(canViewAll ? (value === "all" ? null : value) : value)}
      >
        <SelectTrigger className="w-[160px] shrink-0" disabled={!canViewAll && locations.length === 0}>
          <SelectValue placeholder={canViewAll ? "All Locations" : "No Location Access"} />
        </SelectTrigger>
        <SelectContent>
          {canViewAll && <SelectItem value="all">All Locations</SelectItem>}
          {locations.map((loc) => (
            <SelectItem key={loc.id} value={loc.id}>
              {loc.name}
            </SelectItem>
          ))}
          {!canViewAll && locations.length === 0 && (
            <SelectItem value={NO_LOCATION_ACCESS} disabled>
              No permitted locations
            </SelectItem>
          )}
        </SelectContent>
      </Select>
    </div>
  );
}

