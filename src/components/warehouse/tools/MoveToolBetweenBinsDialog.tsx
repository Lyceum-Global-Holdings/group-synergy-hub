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
import type { ToolBinAllocation, WarehouseTool } from "@/types/toolManagement";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tool: WarehouseTool | null;
  allocations: ToolBinAllocation[];
  fromBinId?: string;
}

export function MoveToolBetweenBinsDialog({
  open,
  onOpenChange,
  tool,
  allocations,
  fromBinId,
}: Props) {
  const [from, setFrom] = useState<string>(fromBinId ?? "");
  const [to, setTo] = useState<string>("");
  const [qty, setQty] = useState<number>(1);

  const { move, isMoving } = useToolBinAllocations(tool?.id);

  useEffect(() => {
    if (open) {
      setFrom(fromBinId ?? "");
      setTo("");
      setQty(1);
    }
  }, [open, fromBinId]);

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

  const allBins = binsQuery.data || [];
  const sourceAlloc = allocations.find((a) => a.bin_id === from);
  const maxQty = Number(sourceAlloc?.available_quantity ?? 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tool || !from || !to || from === to || qty <= 0) return;
    move(
      { tool_id: tool.id, from_bin_id: from, to_bin_id: to, quantity: qty },
      { onSuccess: () => onOpenChange(false) }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Move between bins</DialogTitle>
          <DialogDescription>
            {tool ? `${tool.tool_code} — ${tool.name}` : ""}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>From bin *</Label>
            <Select value={from} onValueChange={setFrom}>
              <SelectTrigger>
                <SelectValue placeholder="Pick a source bin" />
              </SelectTrigger>
              <SelectContent>
                {allocations
                  .filter((a) => Number(a.available_quantity ?? 0) > 0)
                  .map((a) => (
                    <SelectItem key={a.bin_id} value={a.bin_id}>
                      <span className="font-mono text-xs mr-2">{a.bin?.bin_code}</span>
                      {a.bin?.name} · {Number(a.available_quantity)} avail
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>To bin *</Label>
            <Select value={to} onValueChange={setTo}>
              <SelectTrigger>
                <SelectValue placeholder="Pick a destination bin" />
              </SelectTrigger>
              <SelectContent>
                {allBins.map((b) => {
                  const sameAsFrom = b.id === from;
                  return (
                    <SelectItem key={b.id} value={b.id} disabled={sameAsFrom}>
                      <span className="font-mono text-xs mr-2">{b.bin_code}</span>
                      {b.name}
                      {sameAsFrom ? " (source)" : ""}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Quantity * (max {maxQty})</Label>
            <Input
              type="number"
              min={1}
              max={maxQty || undefined}
              value={qty}
              onChange={(e) => setQty(parseInt(e.target.value) || 0)}
              required
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isMoving || !from || !to || from === to || qty <= 0 || qty > maxQty}
            >
              {isMoving ? "Moving..." : "Move"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
