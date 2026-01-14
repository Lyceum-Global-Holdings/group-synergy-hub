import React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Building2 } from "lucide-react";

interface Company {
  id: string;
  name: string;
  code: string;
}

interface CompanyAccessSelectorProps {
  companies: Company[];
  primaryCompanyId: string | undefined;
  selectedCompanyIds: string[];
  onSelectionChange: (companyIds: string[]) => void;
  disabled?: boolean;
}

export const CompanyAccessSelector: React.FC<CompanyAccessSelectorProps> = ({
  companies,
  primaryCompanyId,
  selectedCompanyIds,
  onSelectionChange,
  disabled = false,
}) => {
  const handleToggle = (companyId: string) => {
    if (companyId === primaryCompanyId) return; // Can't toggle primary company
    
    if (selectedCompanyIds.includes(companyId)) {
      onSelectionChange(selectedCompanyIds.filter((id) => id !== companyId));
    } else {
      onSelectionChange([...selectedCompanyIds, companyId]);
    }
  };

  const handleSelectAll = () => {
    const allCompanyIds = companies.map((c) => c.id);
    onSelectionChange(allCompanyIds.filter((id) => id !== primaryCompanyId));
  };

  const handleClearAll = () => {
    onSelectionChange([]);
  };

  // Filter out the primary company from the selection options
  const additionalCompanies = companies.filter((c) => c.id !== primaryCompanyId);

  if (additionalCompanies.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-2">
        No additional companies available.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          Select companies to grant access:
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSelectAll}
            disabled={disabled}
            className="text-xs text-primary hover:underline disabled:opacity-50"
          >
            Select All
          </button>
          <span className="text-muted-foreground">|</span>
          <button
            type="button"
            onClick={handleClearAll}
            disabled={disabled}
            className="text-xs text-primary hover:underline disabled:opacity-50"
          >
            Clear All
          </button>
        </div>
      </div>

      <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2 bg-muted/20">
        {additionalCompanies.map((company) => {
          const isSelected = selectedCompanyIds.includes(company.id);
          
          return (
            <div
              key={company.id}
              className="flex items-center gap-3 p-2 rounded hover:bg-muted/50 transition-colors"
            >
              <Checkbox
                id={`company-${company.id}`}
                checked={isSelected}
                onCheckedChange={() => handleToggle(company.id)}
                disabled={disabled}
              />
              <Label
                htmlFor={`company-${company.id}`}
                className="flex items-center gap-2 cursor-pointer flex-1"
              >
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1">{company.name}</span>
                <Badge variant="outline" className="text-xs">
                  {company.code}
                </Badge>
              </Label>
            </div>
          );
        })}
      </div>

      {selectedCompanyIds.length > 0 && (
        <div className="text-sm text-muted-foreground">
          {selectedCompanyIds.length} additional {selectedCompanyIds.length === 1 ? "company" : "companies"} selected
        </div>
      )}
    </div>
  );
};
