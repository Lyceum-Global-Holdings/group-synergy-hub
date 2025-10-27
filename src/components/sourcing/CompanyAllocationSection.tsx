import { useState, useEffect } from 'react';
import { useCompanies } from '@/hooks/useCompanies';
import { useSuperAdmin } from '@/hooks/useSuperAdmin';
import { useSupplierCompanyAllocations } from '@/hooks/useCompanySuppliers';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PAYMENT_TERMS } from '@/types/supplier';
import { Building2, Star, Trash2 } from 'lucide-react';

export interface AllocationSettings {
  is_preferred: boolean;
  payment_terms?: string;
  credit_limit?: number;
  notes?: string;
  auto_approve: boolean;
  existing_id?: string;
  existing_status?: 'pending' | 'approved' | 'rejected' | 'suspended';
}

interface CompanyAllocationSectionProps {
  mode: 'create' | 'edit';
  supplierId?: string;
  selectedCompanyIds: string[];
  onCompanySelectionChange: (companyIds: string[]) => void;
  allocationSettings: Map<string, AllocationSettings>;
  onAllocationSettingsChange: (settings: Map<string, AllocationSettings>) => void;
}

export function CompanyAllocationSection({
  mode,
  supplierId,
  selectedCompanyIds,
  onCompanySelectionChange,
  allocationSettings,
  onAllocationSettingsChange,
}: CompanyAllocationSectionProps) {
  const { companies } = useCompanies();
  const { data: isSuperAdmin } = useSuperAdmin();
  const { data: existingAllocations } = useSupplierCompanyAllocations(supplierId);
  const [autoApproveAll, setAutoApproveAll] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load existing allocations in edit mode - only once
  useEffect(() => {
    if (mode === 'edit' && existingAllocations && existingAllocations.length > 0 && !isInitialized) {
      const newSettings = new Map<string, AllocationSettings>();
      const selectedIds: string[] = [];

      existingAllocations.forEach((allocation) => {
        selectedIds.push(allocation.company_id);
        newSettings.set(allocation.company_id, {
          is_preferred: allocation.is_preferred,
          payment_terms: allocation.payment_terms,
          credit_limit: allocation.credit_limit,
          notes: allocation.notes,
          auto_approve: allocation.status === 'approved',
          existing_id: allocation.id,
          existing_status: allocation.status,
        });
      });

      onCompanySelectionChange(selectedIds);
      onAllocationSettingsChange(newSettings);
      setIsInitialized(true);
    }
  }, [mode, existingAllocations, isInitialized]);

  const handleCompanyToggle = (companyId: string, checked: boolean) => {
    const newSelectedIds = checked
      ? [...selectedCompanyIds, companyId]
      : selectedCompanyIds.filter((id) => id !== companyId);
    
    onCompanySelectionChange(newSelectedIds);

    if (checked) {
      const newSettings = new Map(allocationSettings);
      newSettings.set(companyId, {
        is_preferred: false,
        auto_approve: autoApproveAll && isSuperAdmin,
      });
      onAllocationSettingsChange(newSettings);
    } else {
      const newSettings = new Map(allocationSettings);
      newSettings.delete(companyId);
      onAllocationSettingsChange(newSettings);
    }
  };

  const updateSetting = (companyId: string, key: keyof AllocationSettings, value: any) => {
    const newSettings = new Map(allocationSettings);
    const current = newSettings.get(companyId) || {
      is_preferred: false,
      auto_approve: false,
    };
    newSettings.set(companyId, { ...current, [key]: value });
    onAllocationSettingsChange(newSettings);
  };

  const handleAutoApproveAllToggle = (checked: boolean) => {
    setAutoApproveAll(checked);
    if (isSuperAdmin) {
      const newSettings = new Map(allocationSettings);
      selectedCompanyIds.forEach((companyId) => {
        const current = newSettings.get(companyId) || { is_preferred: false, auto_approve: false };
        newSettings.set(companyId, { ...current, auto_approve: checked });
      });
      onAllocationSettingsChange(newSettings);
    }
  };

  const availableCompanies = companies || [];
  const existingCompanyIds = existingAllocations?.map((a) => a.company_id) || [];
  const newCompanies = availableCompanies.filter((c) => !existingCompanyIds.includes(c.id));

  return (
    <div className="space-y-6">
      {mode === 'edit' && existingAllocations && existingAllocations.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold">Current Allocations</h3>
          </div>
          <div className="space-y-4">
            {existingAllocations.map((allocation) => {
              const settings = allocationSettings.get(allocation.company_id);
              const isSelected = selectedCompanyIds.includes(allocation.company_id);

              return (
                <div
                  key={allocation.id}
                  className="border rounded-lg p-4 space-y-3 bg-muted/30"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        id={`company-${allocation.company_id}`}
                        checked={isSelected}
                        onCheckedChange={(checked) =>
                          handleCompanyToggle(allocation.company_id, checked as boolean)
                        }
                      />
                      <div>
                        <Label
                          htmlFor={`company-${allocation.company_id}`}
                          className="font-medium cursor-pointer"
                        >
                          {allocation.company?.name}
                        </Label>
                        <div className="flex gap-2 mt-1">
                          <Badge variant={allocation.status === 'approved' ? 'default' : 'secondary'}>
                            {allocation.status}
                          </Badge>
                          {allocation.is_preferred && (
                            <Badge variant="outline" className="gap-1">
                              <Star className="h-3 w-3 fill-current" />
                              Preferred
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    {isSelected && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCompanyToggle(allocation.company_id, false)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  {isSelected && settings && (
                    <div className="grid gap-3 pl-7">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={`preferred-${allocation.company_id}`}
                          checked={settings.is_preferred}
                          onCheckedChange={(checked) =>
                            updateSetting(allocation.company_id, 'is_preferred', checked)
                          }
                        />
                        <Label htmlFor={`preferred-${allocation.company_id}`} className="cursor-pointer">
                          Preferred Supplier
                        </Label>
                      </div>

                      <div className="grid gap-2">
                        <Label>Payment Terms</Label>
                        <Select
                          value={settings.payment_terms || undefined}
                          onValueChange={(value) =>
                            updateSetting(allocation.company_id, 'payment_terms', value || undefined)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Inherit from supplier" />
                          </SelectTrigger>
                          <SelectContent>
                            {PAYMENT_TERMS.map((term) => (
                              <SelectItem key={term.value} value={term.value}>
                                {term.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid gap-2">
                        <Label>Credit Limit (Optional)</Label>
                        <Input
                          type="number"
                          placeholder="Enter credit limit"
                          value={settings.credit_limit || ''}
                          onChange={(e) =>
                            updateSetting(
                              allocation.company_id,
                              'credit_limit',
                              e.target.value ? parseFloat(e.target.value) : undefined
                            )
                          }
                        />
                      </div>

                      <div className="grid gap-2">
                        <Label>Notes (Optional)</Label>
                        <Textarea
                          placeholder="Allocation notes..."
                          value={settings.notes || ''}
                          onChange={(e) => updateSetting(allocation.company_id, 'notes', e.target.value)}
                          rows={2}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {(mode === 'create' || (mode === 'edit' && newCompanies.length > 0)) && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold">
                {mode === 'edit' ? 'Add New Allocations' : 'Company Allocation'}
              </h3>
            </div>
            {isSuperAdmin && mode === 'create' && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="auto-approve-all"
                  checked={autoApproveAll}
                  onCheckedChange={(checked) => handleAutoApproveAllToggle(checked as boolean)}
                />
                <Label htmlFor="auto-approve-all" className="cursor-pointer text-sm">
                  Auto-approve all
                </Label>
              </div>
            )}
          </div>

          <div className="text-sm text-muted-foreground">
            Select companies to allocate this supplier
          </div>

          <div className="space-y-4">
            {(mode === 'create' ? availableCompanies : newCompanies).map((company) => {
              const isSelected = selectedCompanyIds.includes(company.id);
              const settings = allocationSettings.get(company.id);

              return (
                <div key={company.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id={`company-${company.id}`}
                      checked={isSelected}
                      onCheckedChange={(checked) => handleCompanyToggle(company.id, checked as boolean)}
                    />
                    <Label htmlFor={`company-${company.id}`} className="font-medium cursor-pointer">
                      {company.name}
                      <span className="text-sm text-muted-foreground ml-2">({company.code})</span>
                    </Label>
                  </div>

                  {isSelected && settings && (
                    <div className="grid gap-3 pl-7">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={`preferred-${company.id}`}
                          checked={settings.is_preferred}
                          onCheckedChange={(checked) =>
                            updateSetting(company.id, 'is_preferred', checked)
                          }
                        />
                        <Label htmlFor={`preferred-${company.id}`} className="cursor-pointer">
                          Preferred Supplier
                        </Label>
                      </div>

                      <div className="grid gap-2">
                        <Label>Payment Terms</Label>
                        <Select
                          value={settings.payment_terms || undefined}
                          onValueChange={(value) =>
                            updateSetting(company.id, 'payment_terms', value || undefined)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Inherit from supplier" />
                          </SelectTrigger>
                          <SelectContent>
                            {PAYMENT_TERMS.map((term) => (
                              <SelectItem key={term.value} value={term.value}>
                                {term.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid gap-2">
                        <Label>Credit Limit (Optional)</Label>
                        <Input
                          type="number"
                          placeholder="Enter credit limit"
                          value={settings.credit_limit || ''}
                          onChange={(e) =>
                            updateSetting(
                              company.id,
                              'credit_limit',
                              e.target.value ? parseFloat(e.target.value) : undefined
                            )
                          }
                        />
                      </div>

                      <div className="grid gap-2">
                        <Label>Notes (Optional)</Label>
                        <Textarea
                          placeholder="Allocation notes..."
                          value={settings.notes || ''}
                          onChange={(e) => updateSetting(company.id, 'notes', e.target.value)}
                          rows={2}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {selectedCompanyIds.length === 0 && mode === 'create' && (
        <div className="text-sm text-destructive">
          Please select at least one company to allocate this supplier.
        </div>
      )}
    </div>
  );
}
