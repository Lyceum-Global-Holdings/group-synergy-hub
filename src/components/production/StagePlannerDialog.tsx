import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Settings2, Plus, Loader2 } from "lucide-react";
import { useProductionSectors, useStageTemplates } from "@/hooks/useProduction";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export default function StagePlannerDialog() {
  const { data: sectors } = useProductionSectors();
  const { company } = useCompany();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [sectorId, setSectorId] = useState("");
  const [newStage, setNewStage] = useState("");
  const [adding, setAdding] = useState(false);

  const { data: templates, isLoading } = useStageTemplates(sectorId || undefined);

  const handleAddStage = async () => {
    if (!newStage || !sectorId || !company?.id) return;
    setAdding(true);
    const nextOrder = (templates?.length || 0) + 1;
    const { error } = await supabase.from("production_stage_templates").insert({
      sector_id: sectorId,
      company_id: company.id,
      stage_name: newStage,
      sequence_order: nextOrder,
      bom_categories: [],
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Stage added");
      setNewStage("");
      qc.invalidateQueries({ queryKey: ["production-stage-templates"] });
    }
    setAdding(false);
  };

  if (!sectors || sectors.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings2 className="mr-2 h-4 w-4" /> Stage Planner
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Production Stage Planner</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Select Sector</Label>
            <Select value={sectorId} onValueChange={setSectorId}>
              <SelectTrigger><SelectValue placeholder="Choose sector" /></SelectTrigger>
              <SelectContent>
                {sectors.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {sectorId && (
            <>
              {isLoading ? (
                <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Stage Name</TableHead>
                        <TableHead>BOM Categories</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {templates?.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell>{t.sequence_order}</TableCell>
                          <TableCell className="font-medium">{t.stage_name}</TableCell>
                          <TableCell>
                            {(t.bom_categories as string[] || []).length > 0
                              ? (t.bom_categories as string[]).map((c) => (
                                  <Badge key={c} variant="outline" className="mr-1 text-xs">{c}</Badge>
                                ))
                              : <span className="text-xs text-muted-foreground">Manual</span>}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              <div className="flex gap-2">
                <Input placeholder="New stage name" value={newStage} onChange={(e) => setNewStage(e.target.value)} />
                <Button onClick={handleAddStage} disabled={adding || !newStage} size="sm">
                  {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="mr-1 h-4 w-4" /> Add</>}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
