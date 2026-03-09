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
  const currentPath = location.pathname;

  const isActive = (path: string) => currentPath === path;
  const isGroupActive = (items: { url: string }[]) =>
    items.some((item) => currentPath.startsWith(item.url));

  // Get all unique modules when viewing all companies
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

  // Get companies that use a specific module
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

  // Filter modules based on selected company or show all when viewing all companies
  // Super admins see all modules only when viewing "All Companies"
  // When a specific company is selected, show only that company's modules
  const companyModules = isViewingAllCompanies
    ? (isSuperAdmin ? Object.keys(moduleConfig) : getAllUniqueModules())
    : selectedCompany
      ? Object.keys(normalizeCompanyModules(selectedCompany.modules))
      : [];

  // Filter by user permissions (unless super admin)
  // Super admins always get "administration" even when viewing a specific company
  const availableModules = isSuperAdmin 
    ? (companyModules.includes("administration") ? companyModules : [...companyModules, "administration"])
    : companyModules.filter(moduleKey => 
        userEffectiveModules?.availableModules?.includes(moduleKey)
      );
    
  // Ensure availableModules is always an array
  const safeAvailableModules = Array.isArray(availableModules) ? availableModules : [];
    
  const departments: ModuleWithCompanies[] = safeAvailableModules
    .map(moduleKey => {
      const config = moduleConfig[moduleKey];
      if (!config) return null;
      
      // Start from configured sub-modules
      let enabledItems: SidebarItem[] = config.subModules.map(sub => ({
        title: sub.name,
        url: sub.url,
        key: sub.key,
        children: sub.children
      }));

      // Add super-admin-only Backend Monitor under Administration
      if (moduleKey === "administration" && isSuperAdmin) {
        enabledItems.push({
          title: "Backend Monitor",
          url: "/admin/backend",
          key: "backend-monitor"
        });
      }

      // When viewing a specific company, filter sub-modules based on company settings
      // Keep backend-monitor visible for super admins even if not part of company module config
      if (!isViewingAllCompanies && selectedCompany) {
        const companyModules = normalizeCompanyModules(selectedCompany.modules);
        const enabledSubModules = companyModules[moduleKey] || [];
        enabledItems = enabledItems.filter(item => 
          enabledSubModules.includes(item.key) || (isSuperAdmin && item.key === "backend-monitor")
        );
      }

      // Further filter by user permissions (unless super admin)
      if (!isSuperAdmin && userEffectiveModules?.moduleSubModules) {
        const userSubModules = userEffectiveModules.moduleSubModules[moduleKey] || [];
        enabledItems = enabledItems.filter(item =>
          userSubModules.includes(item.key)
        );
      }

      // Skip modules with no enabled items for the user
      if (enabledItems.length === 0) return null;
      
      // Add companies using this module when viewing all companies
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

  return (
    <Sidebar className="border-r">
      <SidebarContent>
        {/* Company Header */}
        <SidebarGroup className="pb-2">
          <div className="px-3 py-2 bg-muted/50 rounded-lg mx-2 mb-2">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">
                  {isViewingAllCompanies ? "All Companies" : selectedCompany?.name}
                </div>
                <div className="text-xs text-muted-foreground">
                  {isViewingAllCompanies 
                    ? `${companies.length} companies` 
                    : selectedCompany?.code
                  }
                </div>
              </div>
              <Badge variant="secondary" className="text-xs">
                {safeAvailableModules.length}
              </Badge>
            </div>
          </div>
        </SidebarGroup>

        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={currentPath === "/"}>
                  <NavLink to="/" className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    <span>Dashboard</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Super Admin Tools (always visible for super admins) */}
        {isSuperAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Super Admin Tools</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={currentPath.startsWith("/admin/backend")}>
                    <NavLink to="/admin/backend" className="flex items-center gap-2">
                      <Database className="h-4 w-4" />
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
            <SidebarGroupLabel>
              {isViewingAllCompanies ? "All Available Modules" : `${selectedCompany?.name} Modules`}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {departments.map((dept) => (
                  <Collapsible
                    key={dept.title}
                    defaultOpen={isGroupActive(dept.items)}
                    className="group/collapsible"
                  >
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton
                          isActive={isGroupActive(dept.items)}
                          className="w-full"
                        >
                          <dept.icon className="h-4 w-4" />
                          <div className="flex-1 flex items-center justify-between">
                            <span>{dept.title}</span>
                            {isViewingAllCompanies && dept.companiesUsing && (
                              <Badge variant="outline" className="text-xs ml-2">
                                {dept.companiesUsing.length}
                              </Badge>
                            )}
                          </div>
                          <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {dept.items.map((item) => (
                            item.children && item.children.length > 0 ? (
                              <Collapsible
                                key={item.url}
                                defaultOpen={item.children.some(child => currentPath.startsWith(child.url))}
                                className="group/nested"
                              >
                                <SidebarMenuSubItem>
                                  <CollapsibleTrigger asChild>
                                    <SidebarMenuSubButton
                                      className="w-full justify-between cursor-pointer"
                                      isActive={isActive(item.url) || item.children.some(child => currentPath.startsWith(child.url))}
                                    >
                                      <span>{item.title}</span>
                                      <ChevronDown className="h-3 w-3 transition-transform group-data-[state=open]/nested:rotate-180" />
                                    </SidebarMenuSubButton>
                                  </CollapsibleTrigger>
                                  <CollapsibleContent>
                                    <div className="ml-4 mt-1 space-y-1 border-l border-border pl-2">
                                      {item.children.map((child) => (
                                        <NavLink
                                          key={child.url}
                                          to={child.url}
                                          className={`block text-xs py-1 px-2 rounded-sm transition-colors ${
                                            isActive(child.url)
                                              ? 'bg-primary/10 text-primary font-medium'
                                              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                                          }`}
                                        >
                                          {child.name}
                                        </NavLink>
                                      ))}
                                    </div>
                                  </CollapsibleContent>
                                </SidebarMenuSubItem>
                              </Collapsible>
                            ) : (
                              <SidebarMenuSubItem key={item.url}>
                                <SidebarMenuSubButton
                                  asChild
                                  isActive={isActive(item.url)}
                                >
                                  <NavLink to={item.url}>{item.title}</NavLink>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            )
                          ))}
                          {isViewingAllCompanies && dept.companiesUsing && dept.companiesUsing.length > 0 && (
                            <SidebarMenuSubItem>
                              <div className="px-3 py-1">
                                <div className="text-xs text-muted-foreground mb-1">Used by:</div>
                                <div className="flex flex-wrap gap-1">
                                  {dept.companiesUsing.map((company) => (
                                    <Badge key={company.id} variant="secondary" className="text-xs">
                                      {company.code}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            </SidebarMenuSubItem>
                          )}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

      </SidebarContent>
    </Sidebar>
  );
}