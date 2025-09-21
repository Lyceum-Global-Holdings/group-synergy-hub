import { useState } from "react";
import { Building2, ChevronDown } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

// Mock companies data
const companies = [
  { id: "1", name: "Acme Corporation", code: "ACME", status: "active" },
  { id: "2", name: "Global Industries", code: "GLOB", status: "active" },
  { id: "3", name: "Tech Solutions Ltd", code: "TECH", status: "active" },
  { id: "4", name: "Manufacturing Co", code: "MFG", status: "inactive" },
];

export function CompanySelector() {
  const [selectedCompany, setSelectedCompany] = useState("1");

  const currentCompany = companies.find((c) => c.id === selectedCompany);

  return (
    <div className="flex items-center gap-2">
      <Building2 className="h-4 w-4 text-muted-foreground" />
      <Select value={selectedCompany} onValueChange={setSelectedCompany}>
        <SelectTrigger className="w-[200px]">
          <SelectValue />
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