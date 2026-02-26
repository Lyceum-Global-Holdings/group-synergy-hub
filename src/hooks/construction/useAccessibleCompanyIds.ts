import { useMemo } from "react";
import { useCompany } from "@/contexts/CompanyContext";

/**
 * Returns all company IDs currently available in the company selector,
 * plus the actively selected company as a safety fallback.
 *
 * This keeps Construction Inventory cross-company visibility aligned with
 * actual UI access and avoids DB/RPC edge-case failures.
 */
export function useAccessibleCompanyIds() {
  const { selectedCompany, companies } = useCompany();

  const companyIdsKey = useMemo(
    () => (companies ?? []).map((company) => company.id).sort().join("|"),
    [companies]
  );

  const accessibleCompanyIds = useMemo(() => {
    const ids = new Set<string>();

    if (selectedCompany?.id) {
      ids.add(selectedCompany.id);
    }

    (companies ?? []).forEach((company) => {
      if (company?.id) {
        ids.add(company.id);
      }
    });

    return Array.from(ids);
  }, [selectedCompany?.id, companyIdsKey]);

  return {
    data: accessibleCompanyIds,
    isLoading: false,
    error: null,
  };
}

