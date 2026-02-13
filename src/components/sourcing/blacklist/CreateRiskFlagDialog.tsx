import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSuppliers } from "@/hooks/useSuppliers";
import { useSupplierRiskFlags } from "@/hooks/useSupplierRiskFlags";
import { useCompany } from "@/contexts/CompanyContext";
import { RISK_CATEGORIES, RISK_SEVERITIES } from "@/types/supplierRisk";
import type { RiskCategory, RiskSeverity } from "@/types/supplierRisk";

interface CreateRiskFlagDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplierId?: string;
}

export function CreateRiskFlagDialog({ open, onOpenChange, supplierId }: CreateRiskFlagDialogProps) {
  const { selectedCompany } = useCompany();
  const { data: suppliers } = useSuppliers();
  const { createRiskFlag } = useSupplierRiskFlags();
  
  const [selectedSupplierId, setSelectedSupplierId] = useState(supplierId || "");
  const [category, setCategory] = useState<RiskCategory>("quality");
  const [severity, setSeverity] = useState<RiskSeverity>("medium");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [financialImpact, setFinancialImpact] = useState("");

  const handleSubmit = async () => {
    if (!selectedSupplierId || !title) return;

    await createRiskFlag.mutateAsync({
      supplier_id: selectedSupplierId,
      risk_category: category,
      risk_severity: severity,
      title,
      description,
      financial_impact: financialImpact ? parseFloat(financialImpact) : undefined,
      company_id: selectedCompany?.id,
    });

    onOpenChange(false);
    resetForm();
  };

  const resetForm = () => {
    if (!supplierId) setSelectedSupplierId("");
    setCategory("quality");
    setSeverity("medium");
    setTitle("");
    setDescription("");
    setFinancialImpact("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Flag Supplier Risk</DialogTitle>
          <DialogDescription>
            Document a risk concern for a supplier
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="supplier">Supplier *</Label>
            <Select 
              value={selectedSupplierId} 
              onValueChange={setSelectedSupplierId}
              disabled={!!supplierId}
            >
              <SelectTrigger id="supplier">
                <SelectValue placeholder="Select supplier" />
              </SelectTrigger>
              <SelectContent>
                {suppliers?.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">Risk Category *</Label>
              <Select value={category} onValueChange={(value: RiskCategory) => setCategory(value)}>
                <SelectTrigger id="category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RISK_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="severity">Severity Level *</Label>
              <Select value={severity} onValueChange={(value: RiskSeverity) => setSeverity(value)}>
                <SelectTrigger id="severity">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RISK_SEVERITIES.map((sev) => (
                    <SelectItem key={sev.value} value={sev.value}>
                      {sev.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Risk Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Brief description of the risk"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Detailed Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide full details about this risk..."
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="financial-impact">Estimated Financial Impact</Label>
            <Input
              id="financial-impact"
              type="number"
              value={financialImpact}
              onChange={(e) => setFinancialImpact(e.target.value)}
              placeholder="0.00"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!selectedSupplierId || !title || createRiskFlag.isPending}
          >
            {createRiskFlag.isPending ? "Creating..." : "Create Risk Flag"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
