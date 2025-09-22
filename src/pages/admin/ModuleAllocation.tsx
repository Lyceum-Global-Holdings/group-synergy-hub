import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useCompanies } from "@/hooks/useCompanies";
import { Company } from "@/types/company";
import { toast } from "sonner";

const availableModules = [
  { key: 'finance', name: 'Finance', description: 'Financial management and reporting' },
  { key: 'warehouse', name: 'Warehouse', description: 'Inventory and asset management' },
  { key: 'sourcing', name: 'Sourcing', description: 'Supplier and vendor management' },
  { key: 'procurement', name: 'Procurement', description: 'Purchase orders and requisitions' },
  { key: 'management', name: 'Management', description: 'User and role management' },
  { key: 'bom', name: 'Bill of Materials', description: 'Product structure management' }
];

export default function ModuleAllocation() {
  const { companies, updateCompany, isUpdating } = useCompanies();
  const [searchParams] = useSearchParams();
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [moduleChanges, setModuleChanges] = useState<string[]>([]);

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
    setModuleChanges(company.modules || []);
  };

  const handleModuleToggle = (moduleKey: string) => {
    setModuleChanges(prev => 
      prev.includes(moduleKey)
        ? prev.filter(m => m !== moduleKey)
        : [...prev, moduleKey]
    );
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
    JSON.stringify(moduleChanges.sort()) !== JSON.stringify((selectedCompany.modules || []).sort());

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
                  {(company.modules || []).map((module) => (
                    <Badge key={module} variant="outline" className="text-xs">
                      {availableModules.find(m => m.key === module)?.name || module}
                    </Badge>
                  ))}
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
                <div className="space-y-3">
                  {availableModules.map((module) => (
                    <div key={module.key} className="flex items-start space-x-3">
                      <Checkbox
                        id={module.key}
                        checked={moduleChanges.includes(module.key)}
                        onCheckedChange={() => handleModuleToggle(module.key)}
                      />
                      <div className="flex-1">
                        <label 
                          htmlFor={module.key}
                          className="text-sm font-medium cursor-pointer"
                        >
                          {module.name}
                        </label>
                        <p className="text-xs text-muted-foreground">
                          {module.description}
                        </p>
                      </div>
                    </div>
                  ))}
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