import { Building2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useCompanyContext } from "@/contexts/CompanyContext";

export function CompanySelector() {
  const { selectedCompany, setSelectedCompany, companies } = useCompanyContext();

  return (
    <div className="flex items-center gap-2">
      <Building2 className="h-4 w-4 text-muted-foreground" />
      <Select 
        value={selectedCompany?.id} 
        onValueChange={(value) => {
          const company = companies.find(c => c.id === value);
          setSelectedCompany(company || null);
        }}
      >
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Select company" />
        </SelectTrigger>
        <SelectContent>
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