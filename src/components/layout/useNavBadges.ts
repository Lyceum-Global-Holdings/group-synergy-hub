import { useCompany } from "@/contexts/CompanyContext";
import { useLocationFilter } from "@/contexts/LocationFilterContext";
import { useHealthStrip } from "@/hooks/useDashboardPulse";

export type NavBadge = { count: number; tone: "alert" | "info"; label: string };

/**
 * Work-queue counts shown as pills in the sidebar. Reuses the dashboard's
 * health-strip RPC (same query key, so it is shared with the dashboard cache
 * and refreshed by its realtime listener).
 * Keyed by `${moduleKey}|${submoduleKey}`.
 */
export function useNavBadges(): Record<string, NavBadge> {
  const { selectedCompany } = useCompany();
  const { globalLocationId } = useLocationFilter();
  const { data } = useHealthStrip(selectedCompany?.id ?? null, globalLocationId);

  const badges: Record<string, NavBadge> = {};
  if (data?.approvals_pending) {
    badges["management|approvals"] = {
      count: data.approvals_pending,
      tone: "alert",
      label: `${data.approvals_pending} awaiting approval`,
    };
  }
  if (data?.grn_pending) {
    badges["warehouse|grn"] = {
      count: data.grn_pending,
      tone: "info",
      label: `${data.grn_pending} GRNs pending`,
    };
  }
  return badges;
}
