import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Building2,
  BarChart3,
  Settings,
  ChevronDown,
  Database,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useCompany } from "@/contexts/CompanyContext";
import { Badge } from "@/components/ui/badge";
import { Company } from "@/types/company";
import { moduleConfig, normalizeCompanyModules } from "@/constants/moduleConfig";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { useAuth } from "@/contexts/AuthContext";
import { useUserEffectiveModules } from "@/hooks/useModuleAccess";
import { useUserPins } from "@/hooks/useSidebarPins";
import { PinnedSubmodulesGroup } from "./PinnedSubmodulesGroup";
import { SidebarPinButton } from "./SidebarPinButton";
import { TooltipProvider } from "@/components/ui/tooltip";

type SubModuleChild = {
  key: string;
  name: string;
  url: string;
};

type SidebarItem = {
  title: string;
  url: string;
  key: string;
  children?: SubModuleChild[];
};

type ModuleWithCompanies = {
  key: string;
  title: string;
  icon: any;
  items: SidebarItem[];
  companiesUsing?: Company[];
};


export function CompanySidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const { selectedCompany, companies, isViewingAllCompanies } = useCompany();
  const { data: isSuperAdmin } = useSuperAdmin();
  const { user } = useAuth();
  const { data: userEffectiveModules } = useUserEffectiveModules(user?.id);
  const { data: allPins } = useUserPins();
  const currentPath = location.pathname;

  const isActive = (path: string) => currentPath === path;
  const isGroupActive = (items: { url: string }[]) =>
    items.some((item) => currentPath.startsWith(item.url));

  const getAllUniqueModules = () => {
    const allModules = new Set<string>();
    companies.forEach(company => {
      try {
        const companyModules = normalizeCompanyModules(company.modules);
        Object.keys(companyModules).forEach(moduleKey => allModules.add(moduleKey));
      } catch (error) {
        console.warn('Error processing company modules:', error, company);
      }
    });
    return Array.from(allModules);
  };

  const getCompaniesUsingModule = (moduleKey: string) => {
    return companies.filter(company => {
      try {
        const companyModules = normalizeCompanyModules(company.modules);
        return Object.hasOwnProperty.call(companyModules, moduleKey);
      } catch (error) {
        console.warn('Error processing company modules:', error, company);
        return false;
      }
    });
  };

  const companyModules = isViewingAllCompanies
    ? (isSuperAdmin ? Object.keys(moduleConfig) : getAllUniqueModules())
    : selectedCompany
      ? Object.keys(normalizeCompanyModules(selectedCompany.modules))
      : [];

  const availableModules = isSuperAdmin 
    ? (companyModules.includes("administration") ? companyModules : [...companyModules, "administration"])
    : companyModules.filter(moduleKey => 
        userEffectiveModules?.availableModules?.includes(moduleKey)
      );
    
  const safeAvailableModules = Array.isArray(availableModules) ? availableModules : [];
    
  const departments: ModuleWithCompanies[] = safeAvailableModules
    .map(moduleKey => {
      const config = moduleConfig[moduleKey];
      if (!config) return null;
      
      let enabledItems: SidebarItem[] = config.subModules.map(sub => ({
        title: sub.name,
        url: sub.url,
        key: sub.key,
        children: sub.children
      }));

      if (moduleKey === "administration" && isSuperAdmin) {
        enabledItems.push({
          title: "Backend Monitor",
          url: "/admin/backend",
          key: "backend-monitor"
        });
      }

      if (!isViewingAllCompanies && selectedCompany) {
        const companyModules = normalizeCompanyModules(selectedCompany.modules);
        const enabledSubModules = companyModules[moduleKey] || [];
        enabledItems = enabledItems.filter(item => 
          enabledSubModules.includes(item.key) || (isSuperAdmin && item.key === "backend-monitor")
        );
      }

      if (!isSuperAdmin && userEffectiveModules?.moduleSubModules) {
        const userSubModules = userEffectiveModules.moduleSubModules[moduleKey] || [];
        enabledItems = enabledItems.filter(item =>
          userSubModules.includes(item.key)
        );
      }

      if (enabledItems.length === 0) return null;
      
      if (isViewingAllCompanies) {
        return {
          key: moduleKey,
          title: config.name,
          icon: config.icon,
          items: enabledItems,
          companiesUsing: getCompaniesUsingModule(moduleKey)
        };
      }
      
      return {
        key: moduleKey,
        title: config.name,
        icon: config.icon,
        items: enabledItems
      };
    })
    .filter(Boolean) as ModuleWithCompanies[];

  // ===== Pinned sub-modules =====
  const allowedKeys = new Set<string>();
  departments.forEach((dept) => {
    dept.items.forEach((item) => {
      allowedKeys.add(`${dept.key}|${item.key}`);
      item.children?.forEach((child) =>
        allowedKeys.add(`${dept.key}|${child.key}`)
      );
    });
  });

  const accessibleCompanyIds = new Set(companies.map((c) => c.id));
  const visiblePinsAll = (allPins ?? []).filter(
    (p) =>
      accessibleCompanyIds.has(p.company_id) &&
      allowedKeys.has(`${p.module_key}|${p.submodule_key}`)
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

  const isItemPinned = (moduleKey: string, submoduleKey: string) =>
    !!selectedCompany &&
    visiblePinsAll.some(
      (p) =>
        p.company_id === selectedCompany.id &&
        p.module_key === moduleKey &&
        p.submodule_key === submoduleKey
    );

  return (
    <TooltipProvider delayDuration={300}>
    <Sidebar className="border-r-0 shadow-[var(--shadow-md)]">
      <SidebarContent className="bg-sidebar">
        {/* Company Header */}
        <SidebarGroup className="pb-2">
          <div className="px-3 py-3 mx-2 mb-1">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-sidebar-primary/20 flex items-center justify-center shrink-0">
                <Building2 className="h-4 w-4 text-sidebar-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-sidebar-accent-foreground truncate">
                  {isViewingAllCompanies ? "All Companies" : selectedCompany?.name}
                </div>
                <div className="text-xs text-sidebar-muted">
                  {isViewingAllCompanies 
                    ? `${companies.length} companies` 
                    : selectedCompany?.code
                  }
                </div>
              </div>
              <Badge variant="secondary" className="text-xs bg-sidebar-accent text-sidebar-accent-foreground border-0">
                {safeAvailableModules.length}
              </Badge>
            </div>
          </div>
        </SidebarGroup>

        {/* Pinned Sub-Modules (per-user, per-company) */}
        <PinnedSubmodulesGroup
          pins={visiblePins}
          reorderDisabled={isViewingAllCompanies}
          showCompanyBadge={isViewingAllCompanies}
        />

        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.1em] font-semibold text-sidebar-muted px-4">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={currentPath === "/"}
                  className={currentPath === "/" ? "border-l-[3px] border-l-sidebar-primary bg-sidebar-accent/60 text-sidebar-accent-foreground font-medium" : "border-l-[3px] border-l-transparent"}
                >
                  <NavLink to="/" className="flex items-center gap-2">
                    <BarChart3 className="h-[18px] w-[18px]" />
                    <span>Dashboard</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Super Admin Tools */}
        {isSuperAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.1em] font-semibold text-sidebar-muted px-4">
              Super Admin Tools
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={currentPath.startsWith("/admin/backend")}
                    className={currentPath.startsWith("/admin/backend") ? "border-l-[3px] border-l-sidebar-primary bg-sidebar-accent/60 text-sidebar-accent-foreground font-medium" : "border-l-[3px] border-l-transparent"}
                  >
                    <NavLink to="/admin/backend" className="flex items-center gap-2">
                      <Database className="h-[18px] w-[18px]" />
                      <span>Backend Monitor</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Company Modules */}
        {departments.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.1em] font-semibold text-sidebar-muted px-4">
              {isViewingAllCompanies ? "All Modules" : "Modules"}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {departments.map((dept) => (
                  <DepartmentCollapsible
                    key={dept.title}
                    dept={dept}
                    currentPath={currentPath}
                    isViewingAllCompanies={isViewingAllCompanies}
                    selectedCompany={selectedCompany}
                    isItemPinned={isItemPinned}
                    isActive={isActive}
                    isGroupActive={isGroupActive}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

      </SidebarContent>
    </Sidebar>
    </TooltipProvider>
  );
}
