import { useCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/contexts/AuthContext";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { useUserEffectiveModules } from "@/hooks/useModuleAccess";
import { useUserPins, type PinnedSubmodule } from "@/hooks/useSidebarPins";
import { moduleConfig, normalizeCompanyModules } from "@/constants/moduleConfig";
import { resolveModuleRoute } from "@/components/layout/moduleRoutes";
import type { Company } from "@/types/company";
import type { LucideIcon } from "lucide-react";

export type NavChild = { key: string; name: string; url: string };

export type NavItem = {
  title: string;
  url: string;
  key: string;
  children?: NavChild[];
};

export type NavModule = {
  key: string;
  title: string;
  icon: LucideIcon;
  items: NavItem[];
  /** Only in "All Companies" view: companies that have this module enabled. */
  companiesUsing?: Company[];
};

/**
 * Modules / sub-modules the current user can open for the active company
 * scope, plus their sidebar pins. Shared by the sidebar, global search and
 * quick-create menu so all three always agree on what is accessible.
 *
 * Access rules (unchanged from the original sidebar):
 *  - super admin: every module of the scope (+ administration, Backend Monitor)
 *  - others: company modules ∩ the user's effective module/sub-module grants
 */
export function useAccessibleNav() {
  const { selectedCompany, companies, isViewingAllCompanies, isLoading: companiesLoading } = useCompany();
  const superAdminQuery = useSuperAdmin();
  const isSuperAdmin = superAdminQuery.data;
  const { user } = useAuth();
  const effectiveModulesQuery = useUserEffectiveModules(user?.id);
  const userEffectiveModules = effectiveModulesQuery.data;
  const { data: allPins } = useUserPins();

  const modulesOf = (company: Company) => {
    try {
      return normalizeCompanyModules(company.modules);
    } catch (error) {
      console.warn("Error processing company modules:", error, company);
      return {} as Record<string, string[]>;
    }
  };

  const allUniqueModules = () => {
    const keys = new Set<string>();
    companies.forEach((c) => Object.keys(modulesOf(c)).forEach((k) => keys.add(k)));
    return Array.from(keys);
  };

  const scopeModules = isViewingAllCompanies
    ? isSuperAdmin
      ? Object.keys(moduleConfig)
      : allUniqueModules()
    : selectedCompany
      ? Object.keys(modulesOf(selectedCompany))
      : [];

  const availableModuleKeys: string[] = isSuperAdmin
    ? scopeModules.includes("administration")
      ? scopeModules
      : [...scopeModules, "administration"]
    : scopeModules.filter((k) => userEffectiveModules?.availableModules?.includes(k));

  const modules: NavModule[] = availableModuleKeys
    .map((moduleKey) => {
      const config = moduleConfig[moduleKey];
      if (!config) return null;

      let items: NavItem[] = config.subModules.map((sub) => ({
        title: sub.name,
        url: sub.url,
        key: sub.key,
        children: sub.children,
      }));

      if (moduleKey === "administration" && isSuperAdmin) {
        items.push({ title: "Backend Monitor", url: "/admin/backend", key: "backend-monitor" });
      }

      if (!isViewingAllCompanies && selectedCompany) {
        const enabled = modulesOf(selectedCompany)[moduleKey] || [];
        items = items.filter(
          (item) => enabled.includes(item.key) || (isSuperAdmin && item.key === "backend-monitor"),
        );
      }

      if (!isSuperAdmin && userEffectiveModules?.moduleSubModules) {
        const granted = userEffectiveModules.moduleSubModules[moduleKey] || [];
        items = items.filter((item) => granted.includes(item.key));
      }

      if (items.length === 0) return null;

      return {
        key: moduleKey,
        title: config.name,
        icon: config.icon,
        items,
        companiesUsing: isViewingAllCompanies
          ? companies.filter((c) => Object.hasOwnProperty.call(modulesOf(c), moduleKey))
          : undefined,
      } satisfies NavModule;
    })
    .filter(Boolean) as NavModule[];

  // ---- Pins (per user, per company) ----
  const allowedKeys = new Set<string>();
  modules.forEach((m) =>
    m.items.forEach((item) => {
      allowedKeys.add(`${m.key}|${item.key}`);
      item.children?.forEach((child) => allowedKeys.add(`${m.key}|${child.key}`));
    }),
  );

  const accessibleCompanyIds = new Set(companies.map((c) => c.id));
  const visiblePinsAll: PinnedSubmodule[] = (allPins ?? []).filter(
    (p) => accessibleCompanyIds.has(p.company_id) && allowedKeys.has(`${p.module_key}|${p.submodule_key}`),
  );

  const visiblePins = isViewingAllCompanies
    ? [...visiblePinsAll].sort((a, b) => {
        const ca = companies.find((c) => c.id === a.company_id)?.name ?? "";
        const cb = companies.find((c) => c.id === b.company_id)?.name ?? "";
        return ca.localeCompare(cb) || a.position - b.position;
      })
    : visiblePinsAll
        .filter((p) => p.company_id === selectedCompany?.id)
        .sort((a, b) => a.position - b.position);

  const pinTargetCompany: Company | null = selectedCompany ?? companies[0] ?? null;

  const isItemPinned = (moduleKey: string, submoduleKey: string) => {
    const pinCompanyId = selectedCompany?.id ?? pinTargetCompany?.id;
    if (!pinCompanyId) return false;
    return visiblePinsAll.some(
      (p) => p.company_id === pinCompanyId && p.module_key === moduleKey && p.submodule_key === submoduleKey,
    );
  };

  /** True when the user can open this module → sub-module in the current scope. */
  const canOpen = (moduleKey: string, submoduleKey: string) => allowedKeys.has(`${moduleKey}|${submoduleKey}`);

  /** Access has resolved (a failed lookup counts as resolved, with no access). */
  const isReady =
    !companiesLoading &&
    (superAdminQuery.data !== undefined || superAdminQuery.isError) &&
    (isSuperAdmin === true || userEffectiveModules !== undefined || effectiveModulesQuery.isError);

  /** A company (or the super-admin "All Companies" view) is selected. */
  const hasCompanyScope = isViewingAllCompanies || !!selectedCompany;

  /**
   * True when the user may open this URL. Pages outside the module catalogue
   * (dashboard, account) are always allowed; administration pages keep their
   * own admin guards.
   */
  const canOpenPath = (path: string) => {
    const route = resolveModuleRoute(path);
    if (!route || route.moduleKey === "administration" || isSuperAdmin) return true;
    return canOpen(route.moduleKey, route.submoduleKey);
  };

  return {
    modules,
    moduleCount: availableModuleKeys.length,
    visiblePins,
    pinTargetCompany,
    isItemPinned,
    canOpen,
    canOpenPath,
    isReady,
    hasCompanyScope,
    isSuperAdmin: !!isSuperAdmin,
    isViewingAllCompanies,
  };
}
