import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToolBinAllocations } from "@/hooks/useToolBinAllocations";
import type { WarehouseTool } from "@/types/toolManagement";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tool: WarehouseTool | null;
}

export function AllocateToolToBinDialog({ open, onOpenChange, tool }: Props) {
  const [binId, setBinId] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(1);
  const [notes, setNotes] = useState<string>("");

  const { allocate, isAllocating } = useToolBinAllocations(tool?.id);

  // Fetch bins available for this tool's location
  const binsQuery = useQuery({
    queryKey: ["bins-for-location", tool?.location_id],
    enabled: open && !!tool?.location_id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "list_bins_for_location_inherited",
        { p_location_id: tool!.location_id! },
      );
      if (error) throw error;
      return (data || []).filter((b: any) => (b.status ?? "active") === "active");
    },
  });

  useEffect(() => {
    if (!open) {
      setBinId("");
      setQuantity(1);
      setNotes("");
    }
  }, [open]);

  const bins = binsQuery.data || [];
  const noLocation = !tool?.location_id;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tool || !binId || quantity <= 0) return;
    allocate(
      { tool_id: tool.id, bin_id: binId, allocated_quantity: quantity, notes: notes || undefined },
      { onSuccess: () => onOpenChange(false) }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Allocate to bin</DialogTitle>
          <DialogDescription>
            {tool ? `${tool.tool_code} — ${tool.name}` : ""}
          </DialogDescription>
        </DialogHeader>

        {noLocation ? (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            This tool has no location assigned. Edit the tool and set a location before allocating to bins.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Bin *</Label>
              <Select value={binId} onValueChange={setBinId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a bin at this location" />
                </SelectTrigger>
                <SelectContent>
                  {bins.length === 0 ? (
                    <div className="px-2 py-3 text-sm text-muted-foreground">
                      No active bins at this location.
                    </div>
                  ) : (
                    bins.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        <span className="font-mono text-xs mr-2">{b.bin_code}</span>
                        {b.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Quantity *</Label>
              <Input
                type="number"
                min={1}
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isAllocating || !binId || quantity <= 0}>
                {isAllocating ? "Allocating..." : "Allocate"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
