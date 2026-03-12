import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { useAddStageCost, useDeleteStageCost } from "@/hooks/useProduction";

interface Props {
  stageId: string;
  costs: any[];
}

export default function StageCostBreakdown({ stageId, costs }: Props) {
  const addCost = useAddStageCost();
  const deleteCost = useDeleteStageCost();
  const [showAdd, setShowAdd] = useState(false);
  const [newItem, setNewItem] = useState({ item_name: "", unit_cost: "", quantity_used: "", unit_of_measure: "pcs" });

  const totalCost = costs.reduce((sum: number, c: any) => sum + (Number(c.total_cost) || 0), 0);

  const handleAdd = () => {
    const unitCost = parseFloat(newItem.unit_cost) || 0;
    const qty = parseFloat(newItem.quantity_used) || 0;
    addCost.mutate({
      stage_id: stageId,
      item_name: newItem.item_name,
      unit_cost: unitCost,
      quantity_used: qty,
      total_cost: unitCost * qty,
      unit_of_measure: newItem.unit_of_measure,
      source: "manual",
    });
    setNewItem({ item_name: "", unit_cost: "", quantity_used: "", unit_of_measure: "pcs" });
    setShowAdd(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold">Material Costs</h4>
        <Button variant="ghost" size="sm" onClick={() => setShowAdd(!showAdd)}>
          <Plus className="mr-1 h-3 w-3" /> Add Cost Item
        </Button>
      </div>

      {costs.length > 0 || showAdd ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="text-right">Unit Cost</TableHead>
                <TableHead className="text-right">Qty Used</TableHead>
                <TableHead>UOM</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="w-[40px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {costs.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.item_name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={c.source === "bom" ? "bg-blue-50 text-blue-700" : "bg-muted"}>
                      {c.source === "bom" ? "BOM" : "Manual"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{Number(c.unit_cost).toFixed(2)}</TableCell>
                  <TableCell className="text-right">{Number(c.quantity_used).toFixed(2)}</TableCell>
                  <TableCell>{c.unit_of_measure}</TableCell>
                  <TableCell className="text-right font-medium">{Number(c.total_cost).toFixed(2)}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteCost.mutate(c.id)}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}

              {showAdd && (
                <TableRow>
                  <TableCell>
                    <Input placeholder="Item name" value={newItem.item_name} onChange={(e) => setNewItem({ ...newItem, item_name: e.target.value })} className="h-8" />
                  </TableCell>
                  <TableCell><Badge variant="outline" className="bg-muted">Manual</Badge></TableCell>
                  <TableCell>
                    <Input type="number" placeholder="0.00" value={newItem.unit_cost} onChange={(e) => setNewItem({ ...newItem, unit_cost: e.target.value })} className="h-8 text-right" />
                  </TableCell>
                  <TableCell>
                    <Input type="number" placeholder="0" value={newItem.quantity_used} onChange={(e) => setNewItem({ ...newItem, quantity_used: e.target.value })} className="h-8 text-right" />
                  </TableCell>
                  <TableCell>
                    <Input value={newItem.unit_of_measure} onChange={(e) => setNewItem({ ...newItem, unit_of_measure: e.target.value })} className="h-8 w-16" />
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {((parseFloat(newItem.unit_cost) || 0) * (parseFloat(newItem.quantity_used) || 0)).toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <Button size="sm" className="h-7" onClick={handleAdd} disabled={!newItem.item_name || addCost.isPending}>
                      {addCost.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Add"}
                    </Button>
                  </TableCell>
                </TableRow>
              )}

              {/* Total row */}
              <TableRow className="bg-muted/30">
                <TableCell colSpan={5} className="font-semibold text-right">Stage Total</TableCell>
                <TableCell className="text-right font-bold">{totalCost.toFixed(2)}</TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No cost items added yet</p>
      )}
    </div>
  );
}
