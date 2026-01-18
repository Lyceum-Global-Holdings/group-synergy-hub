import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "sonner";
import { AlertCircle, Play } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface RunDepreciationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RunDepreciationDialog({ open, onOpenChange }: RunDepreciationDialogProps) {
  const { selectedCompany } = useCompany();
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [postToGL, setPostToGL] = useState(true);
  const [isRunning, setIsRunning] = useState(false);

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

  const handleRunDepreciation = async () => {
    if (!selectedPeriod) {
      toast.error("Please select an accounting period");
      return;
    }

    setIsRunning(true);
    try {
      // In production, this would call an edge function to calculate and post depreciation
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Simulate processing
      
      toast.success("Depreciation run completed successfully");
      onOpenChange(false);
    } catch (error) {
      toast.error("Failed to run depreciation");
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Run Depreciation</DialogTitle>
          <DialogDescription>
            Calculate and post depreciation for all active fixed assets
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              This will calculate depreciation for all active assets based on their depreciation method and post journal entries to the General Ledger.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label>Accounting Period</Label>
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger>
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                {periods?.map((period) => (
                  <SelectItem key={period.id} value={period.id}>
                    {period.period_name} ({period.fiscal_year})
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isRunning}>
            Cancel
          </Button>
          <Button onClick={handleRunDepreciation} disabled={!selectedPeriod || isRunning}>
            {isRunning ? (
              <>Processing...</>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Run Depreciation
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
