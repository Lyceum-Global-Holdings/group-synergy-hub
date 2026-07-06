// Costume unit lifecycle metadata — status labels, badge variants and the
// allowed manual transitions. Mirrors the state-machine enforced server-side by
// change_costume_unit_status() so the UI never offers an illegal move.
import type { UnitStatus, UnitCondition, UnitMaintenanceType } from "@/types/costumeRental";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

export const STATUS_META: Record<UnitStatus, { label: string; variant: BadgeVariant; hint: string }> = {
  available:   { label: "Available",   variant: "default",     hint: "In stock and rentable" },
  reserved:    { label: "Reserved",    variant: "secondary",   hint: "Soft-held for a preferred-unit booking" },
  out:         { label: "On rent",     variant: "secondary",   hint: "Checked out on a rental order" },
  cleaning:    { label: "Cleaning",    variant: "outline",     hint: "Laundry / dry-clean before it returns to stock" },
  maintenance: { label: "Maintenance", variant: "outline",     hint: "Under repair or alteration" },
  retired:     { label: "Retired",     variant: "destructive", hint: "Disposed / decommissioned (terminal)" },
  lost:        { label: "Lost",        variant: "destructive", hint: "Lost or stolen" },
};

// Targets offered in the per-unit "Change status" menu. Retirement goes through
// the dedicated Dispose action; 'out' is owned by checkout/return.
export const QUICK_TRANSITIONS: Record<UnitStatus, UnitStatus[]> = {
  available:   ["cleaning", "maintenance", "lost"],
  reserved:    ["available", "cleaning", "maintenance", "lost"],
  out:         ["lost"],
  cleaning:    ["available", "maintenance", "lost"],
  maintenance: ["available", "cleaning", "lost"],
  lost:        ["available"],
  retired:     [],
};

export const canDispose = (status: UnitStatus) => status !== "out" && status !== "retired";
export const isActiveStock = (status: UnitStatus) => status !== "retired" && status !== "lost";

export const CONDITIONS: UnitCondition[] = ["new", "good", "fair", "needs_repair", "retired"];
export const MAINTENANCE_TYPES: UnitMaintenanceType[] = ["cleaning", "repair", "alteration", "inspection"];

export const conditionLabel = (c: UnitCondition) => c.replace("_", " ");
