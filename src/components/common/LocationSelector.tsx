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
import { useEffectiveLocationsForCompany, type EffectiveLocation } from "@/hooks/useWarehouseLocations";
import { useCurrentUserLocationPermissions } from "@/hooks/useCurrentUserLocationPermissions";
import { useEffect, useMemo } from "react";

export function LocationSelector() {
  const { globalLocationId, setGlobalLocationId } = useLocationFilter();
  const { selectedCompany } = useCompany();
  const { data: permissions, isLoading: permissionsLoading } = useCurrentUserLocationPermissions();

  // Canonical company-scoped effective-location resolver (server-side hierarchy).
  const {
    data: companyLocations = [],
    isLoading: locationsLoading,
    isError: locationsError,
  } = useEffectiveLocationsForCompany(selectedCompany?.id);

  const canViewAll = permissions?.viewAllLocations === true;

  // Expand explicit permitted ids to include their descendants in the loaded tree
  // so users with parent-level access still see inherited child locations.
  const permittedIdSet = useMemo(() => {
    if (!permissions) return new Set<string>();
    const ids = new Set<string>([
      ...permissions.viewLocationIds,
      ...permissions.editLocationIds,
    ]);
    if (ids.size === 0) return ids;

    const childrenByParent = new Map<string, string[]>();
    for (const loc of companyLocations as EffectiveLocation[]) {
      if (loc.parent_id) {
        const arr = childrenByParent.get(loc.parent_id) ?? [];
        arr.push(loc.id);
        childrenByParent.set(loc.parent_id, arr);
      }
    }
    const expanded = new Set<string>(ids);
    const queue = [...ids];
    while (queue.length) {
      const next = queue.shift()!;
      const kids = childrenByParent.get(next) ?? [];
      for (const k of kids) {
        if (!expanded.has(k)) {
          expanded.add(k);
          queue.push(k);
        }
      }
    }
    return expanded;
  }, [companyLocations, permissions]);

  // Visibility: admin sees all; users with no explicit grants are fail-open;
  // users with explicit grants see only the (hierarchically expanded) permitted set.
  const locations = useMemo(() => {
    if (permissionsLoading) return [] as EffectiveLocation[];
    if (!permissions) return [] as EffectiveLocation[];
    if (canViewAll) return companyLocations as EffectiveLocation[];
    if (permittedIdSet.size === 0) return companyLocations as EffectiveLocation[];
    return (companyLocations as EffectiveLocation[]).filter((loc) => permittedIdSet.has(loc.id));
  }, [companyLocations, permissions, permissionsLoading, canViewAll, permittedIdSet]);

  const showAllOption =
    canViewAll ||
    (permissions &&
      permissions.viewLocationIds.length === 0 &&
      permissions.editLocationIds.length === 0);

  useEffect(() => {
    if (permissionsLoading) return;

    if (showAllOption) {
      if (globalLocationId && !locations.some((loc) => loc.id === globalLocationId)) {
        setGlobalLocationId(null);
      }
      return;
    }

    if (locations.length === 0) {
      if (globalLocationId !== null) setGlobalLocationId(null);
      return;
    }

    if (!globalLocationId || !locations.some((loc) => loc.id === globalLocationId)) {
      setGlobalLocationId(locations[0].id);
    }
  }, [showAllOption, permissionsLoading, globalLocationId, locations, setGlobalLocationId]);

  const isLoading = permissionsLoading || (!!selectedCompany?.id && locationsLoading);

  let placeholder = showAllOption ? "All Locations" : "Select Location";
  if (!selectedCompany?.id) placeholder = "Select a company";
  else if (isLoading) placeholder = "Loading locations…";
  else if (locationsError) placeholder = "Failed to load locations";
  else if (locations.length === 0) placeholder = "No locations for this company";

  return (
    <div className="flex items-center gap-2 shrink-0">
      <MapPin className="h-4 w-4 text-muted-foreground" />
      <Select
        value={selectValue}
        onValueChange={(value) =>
          setGlobalLocationId(showAllOption ? (value === "all" ? null : value) : value)
        }
        disabled={isLoading || !selectedCompany?.id}
      >
        <SelectTrigger className="w-[200px] shrink-0">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {locationsError && (
            <SelectItem value="__error" disabled>
              Failed to load locations
            </SelectItem>
          )}
          {!locationsError && !isLoading && locations.length === 0 && selectedCompany?.id && (
            <SelectItem value="__empty" disabled>
              No locations mapped to this company
            </SelectItem>
          )}
          {showAllOption && locations.length > 0 && (
            <SelectItem value="all">All Locations</SelectItem>
          )}
          {locations.map((loc) => (
            <SelectItem key={loc.id} value={loc.id}>
              {loc.parent_id ? `↳ ${loc.name}` : loc.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

