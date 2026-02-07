import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "sonner";
import { AlertCircle, Play, Calculator } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

interface RunDepreciationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface DepreciationPreview {
  asset_id: string;
  asset_name: string;
  asset_tag: string | null;
  depreciation_method: string;
  current_value: number;
  depreciation_amount: number;
  new_value: number;
  location: string | null;
}

export function RunDepreciationDialog({ open, onOpenChange }: RunDepreciationDialogProps) {
  const { selectedCompany } = useCompany();
  const queryClient = useQueryClient();
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [postToGL, setPostToGL] = useState(true);
  const [showPreview, setShowPreview] = useState(false);

  const { data: periods } = useQuery({
    queryKey: ["accounting-periods", selectedCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounting_periods")
        .select("*")
        .eq("company_id", selectedCompany?.id)
        .eq("status", "open")
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCompany?.id && open,
  });

  // Get assets with depreciation setup from warehouse_assets
  const { data: assets, isLoading: assetsLoading } = useQuery({
    queryKey: ["depreciable-warehouse-assets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("warehouse_assets")
        .select(`
          *,
          asset_master (
            depreciation_method,
            depreciation_rate,
            useful_life_years,
            salvage_value
          ),
          location:warehouse_locations!warehouse_assets_location_id_fkey (
            name
          )
        `)
        .eq("status", "active");
      if (error) throw error;
      // Filter assets that have depreciation setup (either on asset itself or via asset_master)
      return data.filter(a => {
        const master = a.asset_master as any;
        return a.depreciation_method || master?.depreciation_method;
      });
    },
    enabled: open,
  });

  // Calculate depreciation preview
  const { data: preview, isLoading: previewLoading, refetch: fetchPreview } = useQuery({
    queryKey: ["depreciation-preview", selectedCompany?.id, selectedPeriod],
    queryFn: async () => {
      if (!selectedPeriod || !assets?.length) return [];
      
      const period = periods?.find(p => p.id === selectedPeriod);
      if (!period) return [];

      // Calculate depreciation for each asset
      const results: DepreciationPreview[] = [];
      
      for (const asset of assets) {
        const master = asset.asset_master as any;
        
        // Get depreciation parameters (prefer asset-level, fallback to master)
        const purchasePrice = asset.purchase_price || 0;
        const salvageValue = asset.salvage_value || master?.salvage_value || 0;
        const usefulLife = asset.useful_life_years || master?.useful_life_years || 1;
        const depMethod = asset.depreciation_method || master?.depreciation_method;
        const depRate = asset.depreciation_rate || master?.depreciation_rate;
        
        const accumulatedDep = asset.accumulated_depreciation || 0;
        const currentValue = purchasePrice - accumulatedDep;
        
        // Skip if already fully depreciated
        if (currentValue <= salvageValue) continue;
        
        let depAmount = 0;
        if (depMethod === "straight_line") {
          depAmount = (purchasePrice - salvageValue) / (usefulLife * 12);
        } else if (depMethod === "declining_balance") {
          const rate = depRate || (2 / usefulLife);
          depAmount = currentValue * rate / 12;
        } else {
          // Default to straight line
          depAmount = (purchasePrice - salvageValue) / (usefulLife * 12);
        }
        
        // Don't depreciate below salvage value
        const maxDepreciation = currentValue - salvageValue;
        depAmount = Math.max(0, Math.min(depAmount, maxDepreciation));
        
        if (depAmount > 0) {
          results.push({
            asset_id: asset.id,
            asset_name: asset.name || "Unnamed Asset",
            asset_tag: asset.asset_tag,
            depreciation_method: depMethod || "straight_line",
            current_value: currentValue,
            depreciation_amount: depAmount,
            new_value: currentValue - depAmount,
            location: (asset.location as any)?.name || null,
          });
        }
      }
      
      return results;
    },
    enabled: !!selectedCompany?.id && !!selectedPeriod && showPreview && !!assets?.length,
  });

  const runDepreciationMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPeriod || !preview?.length) {
        throw new Error("No depreciation to post");
      }

      const period = periods?.find(p => p.id === selectedPeriod);
      if (!period) throw new Error("Period not found");

      // Update each asset's accumulated depreciation
      for (const item of preview) {
        const asset = assets?.find(a => a.id === item.asset_id);
        if (!asset) continue;

        const newAccumulatedDep = (asset.accumulated_depreciation || 0) + item.depreciation_amount;
        const newCurrentValue = (asset.purchase_price || 0) - newAccumulatedDep;

        // Update warehouse_assets record
        const { error: updateError } = await supabase
          .from("warehouse_assets")
          .update({
            accumulated_depreciation: newAccumulatedDep,
            current_value: newCurrentValue,
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.asset_id);

        if (updateError) throw updateError;

        // Also update asset_master if linked (for aggregate tracking)
        if (asset.asset_master_id) {
          // Get all warehouse_assets with this asset_master_id to calculate aggregates
          const { data: relatedAssets } = await supabase
            .from("warehouse_assets")
            .select("purchase_price, accumulated_depreciation, current_value")
            .eq("asset_master_id", asset.asset_master_id);

          if (relatedAssets) {
            const totalPurchase = relatedAssets.reduce((sum, a) => sum + (a.purchase_price || 0), 0);
            const totalAccumDep = relatedAssets.reduce((sum, a) => sum + (a.accumulated_depreciation || 0), 0);
            
            await supabase
              .from("asset_master")
              .update({
                purchase_price: totalPurchase,
                accumulated_depreciation: totalAccumDep,
                current_value: totalPurchase - totalAccumDep,
                updated_at: new Date().toISOString(),
              })
              .eq("id", asset.asset_master_id);
          }
        }

        // Create depreciation schedule record with warehouse_asset_id
        const { error: scheduleError } = await supabase
          .from("depreciation_schedule")
          .insert({
            warehouse_asset_id: item.asset_id,
            asset_id: asset.asset_master_id, // Keep for backward compatibility
            period_id: selectedPeriod,
            period_date: period.end_date,
            depreciation_amount: item.depreciation_amount,
            accumulated_depreciation: newAccumulatedDep,
            book_value: newCurrentValue,
            company_id: selectedCompany?.id,
            status: "posted",
          });

        if (scheduleError) throw scheduleError;

        // Create asset transaction record with warehouse_asset_id
        const { error: txnError } = await supabase
          .from("asset_transactions")
          .insert({
            warehouse_asset_id: item.asset_id,
            asset_id: asset.asset_master_id, // Keep for backward compatibility
            transaction_type: "depreciation",
            transaction_date: period.end_date,
            amount: item.depreciation_amount,
            description: `Monthly depreciation for ${period.period_name}`,
            company_id: selectedCompany?.id,
          });

        if (txnError) throw txnError;
      }

      return { count: preview.length };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["warehouse_assets"] });
      queryClient.invalidateQueries({ queryKey: ["asset_master"] });
      queryClient.invalidateQueries({ queryKey: ["depreciation_schedule"] });
      queryClient.invalidateQueries({ queryKey: ["asset_transactions"] });
      queryClient.invalidateQueries({ queryKey: ["depreciable-warehouse-assets"] });
      queryClient.invalidateQueries({ queryKey: ["fixed-assets"] });
      queryClient.invalidateQueries({ queryKey: ["fixed-assets-summary"] });
      toast.success(`Depreciation posted for ${data.count} assets`);
      onOpenChange(false);
      setShowPreview(false);
      setSelectedPeriod("");
    },
    onError: (error: Error) => {
      toast.error(`Failed to post depreciation: ${error.message}`);
    },
  });

  const handleCalculatePreview = () => {
    if (!selectedPeriod) {
      toast.error("Please select an accounting period");
      return;
    }
    setShowPreview(true);
    fetchPreview();
  };

  const handleRunDepreciation = () => {
    runDepreciationMutation.mutate();
  };

  const totalDepreciation = preview?.reduce((sum, item) => sum + item.depreciation_amount, 0) || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Run Depreciation</DialogTitle>
          <DialogDescription>
            Calculate and post depreciation for all active physical assets
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              This will calculate depreciation for {assets?.length || 0} active assets and post journal entries to the General Ledger.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label>Accounting Period</Label>
            <Select value={selectedPeriod} onValueChange={(v) => { setSelectedPeriod(v); setShowPreview(false); }}>
              <SelectTrigger>
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                {periods?.map((period) => (
                  <SelectItem key={period.id} value={period.id}>
                    {period.period_name} ({period.fiscal_year}) - {format(new Date(period.end_date), "MMM yyyy")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="postToGL"
              checked={postToGL}
              onCheckedChange={(checked) => setPostToGL(checked as boolean)}
            />
            <Label htmlFor="postToGL" className="text-sm font-normal">
              Automatically post journal entries to General Ledger
            </Label>
          </div>

          {!showPreview && (
            <Button 
              variant="outline" 
              onClick={handleCalculatePreview}
              disabled={!selectedPeriod}
              className="w-full"
            >
              <Calculator className="h-4 w-4 mr-2" />
              Calculate Preview
            </Button>
          )}

          {showPreview && (
            <div className="border rounded-lg">
              <div className="p-3 bg-muted/50 border-b flex justify-between items-center">
                <span className="font-medium">Depreciation Preview</span>
                <span className="text-sm">
                  Total: <span className="font-mono font-medium">${totalDepreciation.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </span>
              </div>
              {previewLoading ? (
                <div className="p-4 space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : preview && preview.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Asset</TableHead>
                      <TableHead>Tag</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead className="text-right">Current Value</TableHead>
                      <TableHead className="text-right">Depreciation</TableHead>
                      <TableHead className="text-right">New Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.map((item) => (
                      <TableRow key={item.asset_id}>
                        <TableCell className="font-medium">{item.asset_name}</TableCell>
                        <TableCell className="font-mono text-sm text-muted-foreground">
                          {item.asset_tag || "-"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {item.location || "-"}
                        </TableCell>
                        <TableCell className="capitalize text-muted-foreground">
                          {item.depreciation_method?.replace("_", " ")}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          ${item.current_value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right font-mono text-destructive">
                          -${item.depreciation_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          ${item.new_value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="p-4 text-center text-muted-foreground">
                  No assets eligible for depreciation
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={runDepreciationMutation.isPending}>
            Cancel
          </Button>
          <Button 
            onClick={handleRunDepreciation} 
            disabled={!selectedPeriod || !showPreview || !preview?.length || runDepreciationMutation.isPending}
          >
            {runDepreciationMutation.isPending ? (
              <>Processing...</>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Post Depreciation
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
