import { Building2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useCompany } from "@/contexts/CompanyContext";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";

export function CompanySelector() {
  const { selectedCompany, setSelectedCompany, companies, isViewingAllCompanies } = useCompany();
  const { data: isSuperAdmin } = useSuperAdmin();

  // If user has only one company, don't show selector at all
  if (companies.length === 1 && !isSuperAdmin) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg">
        <Building2 className="h-4 w-4 text-primary" />
        <div>
          <div className="text-sm font-medium">{companies[0].name}</div>
          <div className="text-xs text-muted-foreground">{companies[0].code}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Building2 className="h-4 w-4 text-muted-foreground" />
      <Select value={isViewingAllCompanies ? "all" : (selectedCompany?.id || "")} onValueChange={(value) => {
        if (value === "all") {
          setSelectedCompany(null);
        } else {
          const company = companies.find(c => c.id === value);
          setSelectedCompany(company || null);
        }
      }}>
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Select company">
            {isViewingAllCompanies ? "All Companies" : selectedCompany?.name}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {/* Only show "All Companies" option for super admins */}
          {isSuperAdmin && (
            <SelectItem value="all">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                <span className="font-medium">All Companies</span>
              </div>
            </SelectItem>
          )}
          {companies.map((company) => (
            <SelectItem key={company.id} value={company.id}>
              <div className="flex items-center justify-between w-full">
                <span>{company.name}</span>
                <Badge
                  variant={company.status === "active" ? "default" : "secondary"}
                  className="ml-2 text-xs"
                >
                  {company.status}
                </Badge>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}