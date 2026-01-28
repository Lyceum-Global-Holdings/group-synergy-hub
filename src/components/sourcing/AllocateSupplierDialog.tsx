import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSuppliers } from "@/hooks/useSuppliers";
import { useAllocateSupplier, useCompanySuppliers } from "@/hooks/useCompanySuppliers";
import { toast } from "sonner";

interface AllocateSupplierDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
}

export function AllocateSupplierDialog({ open, onOpenChange, companyId }: AllocateSupplierDialogProps) {
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [isPreferred, setIsPreferred] = useState(false);

  const { data: allSuppliers = [] } = useSuppliers();
  const { data: existingAllocations = [] } = useCompanySuppliers(companyId);
  const allocateSupplier = useAllocateSupplier();

  // Filter out suppliers already allocated to this company
  const allocatedSupplierIds = existingAllocations.map((a) => a.supplier_id);
  const availableSuppliers = allSuppliers.filter(
    (supplier) => !allocatedSupplierIds.includes(supplier.id)
  );

  const handleSubmit = () => {
    if (!selectedSupplierId) {
      toast.error("Please select a supplier");
      return;
    }

    allocateSupplier.mutate(
      {
        company_id: companyId,
        supplier_id: selectedSupplierId,
        notes,
        is_preferred: isPreferred,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          setSelectedSupplierId("");
          setNotes("");
          setIsPreferred(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-screen h-screen max-w-none max-h-none rounded-none p-6 overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Allocate Supplier to Company</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="supplier">Select Supplier</Label>
            <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
              <SelectTrigger id="supplier">
                <SelectValue placeholder="Choose a supplier..." />
              </SelectTrigger>
              <SelectContent>
                {availableSuppliers.length === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground text-center">
                    All suppliers are already allocated
                  </div>
                ) : (
                  availableSuppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name} ({supplier.supplier_code})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any notes about this allocation..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="preferred"
              checked={isPreferred}
              onCheckedChange={(checked) => setIsPreferred(checked as boolean)}
            />
            <Label htmlFor="preferred" className="cursor-pointer">
              Mark as preferred supplier
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={allocateSupplier.isPending}>
            {allocateSupplier.isPending ? "Allocating..." : "Allocate Supplier"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
