import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Loader2 } from "lucide-react";
import { useCompanies } from "@/hooks/useCompanies";
import { Company } from "@/types/company";
import { moduleConfig, normalizeCompanyModules, getModuleSelectionState } from "@/constants/moduleConfig";
import { toast } from "sonner";
import { useSuperAdmin, useIsAdmin } from "@/hooks/useSuperAdmin";

export default function ModuleAllocation() {
  const { companies, updateCompany, isUpdating } = useCompanies();
  const [searchParams] = useSearchParams();
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [moduleChanges, setModuleChanges] = useState<Record<string, string[]>>({});
  
  const { data: isSuperAdmin, isLoading: superAdminLoading } = useSuperAdmin();
  const { data: isAdmin, isLoading: adminLoading } = useIsAdmin();

  // Check permissions
  const hasAccess = isSuperAdmin || isAdmin;
  const checkingPermissions = superAdminLoading || adminLoading;

  // Auto-select company from URL parameter
  useEffect(() => {
    const companyId = searchParams.get('company');
    if (companyId && companies.length > 0) {
      const company = companies.find(c => c.id === companyId);
      if (company) {
        handleCompanySelect(company);
      }
    }
  }, [searchParams, companies]);

  const handleCompanySelect = (company: Company) => {
    setSelectedCompany(company);
    setModuleChanges(normalizeCompanyModules(company.modules));
  };

  const handleModuleToggle = (moduleKey: string, enable: boolean) => {
    const config = moduleConfig[moduleKey];
    if (!config) return;

    setModuleChanges(prev => {
      const newModules = { ...prev };
      if (enable) {
        // Enable all sub-modules when main module is enabled
        newModules[moduleKey] = config.subModules.map(sub => sub.key);
      } else {
        // Remove the module entirely when disabled
        delete newModules[moduleKey];
      }
      return newModules;
    });
  };

  const handleSubModuleToggle = (moduleKey: string, subModuleKey: string, enable: boolean) => {
    setModuleChanges(prev => {
      const newModules = { ...prev };
      if (!newModules[moduleKey]) {
        newModules[moduleKey] = [];
      }

      if (enable) {
        if (!newModules[moduleKey].includes(subModuleKey)) {
          newModules[moduleKey] = [...newModules[moduleKey], subModuleKey];
        }
      } else {
        newModules[moduleKey] = newModules[moduleKey].filter(key => key !== subModuleKey);
        // Remove the module entirely if no sub-modules are left
        if (newModules[moduleKey].length === 0) {
          delete newModules[moduleKey];
        }
      }
      return newModules;
    });
  };

  const handleSaveChanges = async () => {
    if (!selectedCompany) return;

    try {
      await updateCompany({
        id: selectedCompany.id,
        modules: moduleChanges
      });
      
      // Update local state
      setSelectedCompany(prev => prev ? { ...prev, modules: moduleChanges } : null);
      
      toast.success("Module allocation updated successfully");
    } catch (error) {
      toast.error("Failed to update module allocation");
    }
  };

  const hasChanges = selectedCompany && 
    JSON.stringify(moduleChanges) !== JSON.stringify(normalizeCompanyModules(selectedCompany.modules));

  if (checkingPermissions) {
    return (
      <div className="flex justify-center items-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Access Denied</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground">
            You need administrator privileges to access module allocation.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Module Allocation</h1>
        <p className="text-muted-foreground">
          Assign modules to companies to control which features are available.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Company List */}
        <Card>
          <CardHeader>
            <CardTitle>Companies</CardTitle>
            <CardDescription>
              Select a company to manage its module allocation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {companies.map((company) => (
              <div
                key={company.id}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedCompany?.id === company.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-muted/50'
                }`}
                onClick={() => handleCompanySelect(company)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">{company.name}</h3>
                    <p className="text-sm text-muted-foreground">{company.code}</p>
                  </div>
                  <Badge variant={company.status === 'active' ? "default" : "secondary"}>
                    {company.status}
                  </Badge>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {(() => {
                    const companyModules = normalizeCompanyModules(company.modules);
                    const moduleKeys = Object.keys(companyModules);
                    
                    // Ensure moduleKeys is always an array
                    const safeModuleKeys = Array.isArray(moduleKeys) ? moduleKeys : [];
                    
                    return safeModuleKeys.length > 0 ? (
                      safeModuleKeys.map((moduleKey) => (
                        <Badge key={moduleKey} variant="outline" className="text-xs">
                          {moduleConfig[moduleKey]?.name || moduleKey}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">No modules</span>
                    );
                  })()}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Module Assignment */}
        <Card>
          <CardHeader>
            <CardTitle>Module Assignment</CardTitle>
            <CardDescription>
              {selectedCompany 
                ? `Configure modules for ${selectedCompany.name}`
                : 'Select a company to manage modules'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedCompany ? (
              <div className="space-y-4">
                <div className="space-y-4">
                  {Object.values(moduleConfig).map((module) => {
                    const selectionState = getModuleSelectionState(moduleChanges, module.key);
                    const isMainChecked = selectionState === 'all';
                    const isIndeterminate = selectionState === 'partial';
                    
                    return (
                      <Collapsible key={module.key} defaultOpen={selectionState !== 'none'}>
                        <div className="space-y-3">
                          {/* Main Module */}
                          <div className="flex items-start space-x-3">
                            <Checkbox
                              id={module.key}
                              checked={isMainChecked}
                              className={isIndeterminate ? "data-[state=checked]:bg-primary data-[state=checked]:border-primary [&>svg]:opacity-50" : ""}
                              onCheckedChange={(checked) => handleModuleToggle(module.key, checked === true)}
                            />
                            <div className="flex-1 flex items-center justify-between">
                              <div className="flex-1">
                                <label 
                                  htmlFor={module.key}
                                  className="text-sm font-medium cursor-pointer flex items-center gap-2"
                                >
                                  <module.icon className="h-4 w-4" />
                                  {module.name}
                                  {isIndeterminate && (
                                    <Badge variant="secondary" className="text-xs">
                                      Partial
                                    </Badge>
                                  )}
                                </label>
                                <p className="text-xs text-muted-foreground">
                                  {module.description}
                                </p>
                              </div>
                              <CollapsibleTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-auto p-1">
                                  <ChevronDown className="h-4 w-4" />
                                </Button>
                              </CollapsibleTrigger>
                            </div>
                          </div>

                          {/* Sub Modules */}
                          <CollapsibleContent>
                            <div className="ml-6 space-y-2 border-l pl-4">
                              {module.subModules.map((subModule) => (
                                <div key={subModule.key} className="flex items-start space-x-3">
                                  <Checkbox
                                    id={`${module.key}-${subModule.key}`}
                                    checked={moduleChanges[module.key]?.includes(subModule.key) || false}
                                    onCheckedChange={(checked) => handleSubModuleToggle(module.key, subModule.key, checked === true)}
                                  />
                                  <div className="flex-1">
                                    <label 
                                      htmlFor={`${module.key}-${subModule.key}`}
                                      className="text-sm cursor-pointer"
                                    >
                                      {subModule.name}
                                    </label>
                                    <p className="text-xs text-muted-foreground">
                                      {subModule.description}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    );
                  })}
                </div>

                {hasChanges && (
                  <div className="pt-4 border-t">
                    <Button 
                      onClick={handleSaveChanges}
                      disabled={isUpdating}
                      className="w-full"
                    >
                      {isUpdating ? 'Saving...' : 'Save Changes'}
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Select a company from the list to manage its modules
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}