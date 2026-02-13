import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useSuppliers } from "@/hooks/useSuppliers";
import { useSupplierBlacklist } from "@/hooks/useSupplierBlacklist";
import { useCompany } from "@/contexts/CompanyContext";
import type { BlacklistStatus } from "@/types/supplierRisk";

interface BlacklistSupplierDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BlacklistSupplierDialog({ open, onOpenChange }: BlacklistSupplierDialogProps) {
  const { selectedCompany } = useCompany();
  const { data: suppliers } = useSuppliers();
  const { createBlacklist } = useSupplierBlacklist();
  
  const [supplierId, setSupplierId] = useState("");
  const [status, setStatus] = useState<BlacklistStatus>("blacklisted");
  const [reason, setReason] = useState("");
  const [permanent, setPermanent] = useState(false);
  const [reviewRequired, setReviewRequired] = useState(true);
  const [reviewFrequency, setReviewFrequency] = useState("90");

  const handleSubmit = async () => {
    if (!supplierId || !reason) {
      return;
    }

    await createBlacklist.mutateAsync({
      supplier_id: supplierId,
      status,
      blacklist_reason: reason,
      permanent,
      review_required: reviewRequired,
      review_frequency_days: parseInt(reviewFrequency),
      company_id: selectedCompany?.id,
    });

    onOpenChange(false);
    resetForm();
  };

  const resetForm = () => {
    setSupplierId("");
    setStatus("blacklisted");
    setReason("");
    setPermanent(false);
    setReviewRequired(true);
    setReviewFrequency("90");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Supplier to Blacklist</DialogTitle>
          <DialogDescription>
            Blacklist or add a supplier to the watchlist with detailed reasoning
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="supplier">Supplier *</Label>
            <Select value={supplierId} onValueChange={setSupplierId}>
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

          <div className="space-y-2">
            <Label htmlFor="status">Status *</Label>
            <Select value={status} onValueChange={(value: BlacklistStatus) => setStatus(value)}>
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="blacklisted">Blacklisted</SelectItem>
                <SelectItem value="watchlist">Watchlist</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason for Blacklisting *</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Provide detailed reasoning for this action..."
              rows={4}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="permanent">Permanent Blacklist</Label>
              <p className="text-sm text-muted-foreground">Cannot be cleared without admin approval</p>
            </div>
            <Switch
              id="permanent"
              checked={permanent}
              onCheckedChange={setPermanent}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="review-required">Periodic Review Required</Label>
              <p className="text-sm text-muted-foreground">Schedule regular reviews of this entry</p>
            </div>
            <Switch
              id="review-required"
              checked={reviewRequired}
              onCheckedChange={setReviewRequired}
            />
          </div>

          {reviewRequired && (
            <div className="space-y-2">
              <Label htmlFor="frequency">Review Frequency (days)</Label>
              <Select value={reviewFrequency} onValueChange={setReviewFrequency}>
                <SelectTrigger id="frequency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="60">60 days</SelectItem>
                  <SelectItem value="90">90 days</SelectItem>
                  <SelectItem value="180">180 days</SelectItem>
                  <SelectItem value="365">365 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!supplierId || !reason || createBlacklist.isPending}
          >
            {createBlacklist.isPending ? "Adding..." : "Add to Blacklist"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
