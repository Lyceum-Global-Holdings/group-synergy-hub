import { NavLink, useLocation } from "react-router-dom";
import {
  Building2,
  BarChart3,
  Settings,
  ChevronDown,
  Users
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
import { moduleConfig, normalizeCompanyModules, isSubModuleEnabled } from "@/constants/moduleConfig";

type ModuleWithCompanies = {
  key: string;
  title: string;
  icon: any;
  items: { title: string; url: string; key: string }[];
  companiesUsing?: Company[];
};

const adminItems = [
  { title: "Company Management", url: "/admin/companies", icon: Building2 },
  { title: "User & Role Management", url: "/admin/users-roles", icon: Users },
  { title: "Module Allocation", url: "/admin/modules", icon: Settings },
];

export function CompanySidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const { selectedCompany, companies, isViewingAllCompanies } = useCompany();
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
  const availableModules = isViewingAllCompanies 
    ? getAllUniqueModules()
    : Object.keys(normalizeCompanyModules(selectedCompany?.modules));
    
  // Ensure availableModules is always an array
  const safeAvailableModules = Array.isArray(availableModules) ? availableModules : [];
    
  const departments: ModuleWithCompanies[] = safeAvailableModules
    .map(moduleKey => {
      const config = moduleConfig[moduleKey];
      if (!config) return null;
      
      // Filter enabled sub-modules for the selected company
      let enabledItems = config.subModules.map(sub => ({
        title: sub.name,
        url: sub.url,
        key: sub.key
      }));

      // When viewing a single company, filter to only enabled sub-modules
      if (!isViewingAllCompanies && selectedCompany) {
        const companyModules = normalizeCompanyModules(selectedCompany.modules);
        const enabledSubModules = companyModules[moduleKey] || [];
        enabledItems = enabledItems.filter(item => 
          enabledSubModules.includes(item.key)
        );
      }
      
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
                            <SidebarMenuSubItem key={item.url}>
                              <SidebarMenuSubButton
                                asChild
                                isActive={isActive(item.url)}
                              >
                                <NavLink to={item.url}>{item.title}</NavLink>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
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

        {/* Administration */}
        <SidebarGroup>
          <SidebarGroupLabel>Administration</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {adminItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}