import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Wrench, Ban, ArrowRightLeft, History, Sparkles } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useCostumeUnits } from "@/hooks/useCostumeUnits";
import { useCostumeUnitEvents, useCostumeUnitMaintenance } from "@/hooks/useCostumeUnitHistory";
import type { CostumeUnit, UnitCondition, UnitStatus, UnitMaintenanceType } from "@/types/costumeRental";
import {
  STATUS_META, QUICK_TRANSITIONS, CONDITIONS, MAINTENANCE_TYPES, canDispose, conditionLabel,
} from "./unitLifecycle";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unit: CostumeUnit | null;
  costumeName?: string;
}

const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "";

export function UnitLifecycleDialog({ open, onOpenChange, unit, costumeName }: Props) {
  const { changeStatus, disposeUnit, recordMaintenance } = useCostumeUnits(unit?.costume_id);
  const { events } = useCostumeUnitEvents(open ? unit?.id : undefined);
  const { records } = useCostumeUnitMaintenance(open ? unit?.id : undefined);

  // Change-status form
  const [newStatus, setNewStatus] = useState<UnitStatus | "">("");
  const [statusCond, setStatusCond] = useState<UnitCondition | "keep">("keep");
  const [statusReason, setStatusReason] = useState("");

  // Service form
  const [svcType, setSvcType] = useState<UnitMaintenanceType>("cleaning");
  const [svcProvider, setSvcProvider] = useState("");
  const [svcBy, setSvcBy] = useState("");
  const [svcCost, setSvcCost] = useState("0");
  const [svcDesc, setSvcDesc] = useState("");
  const [svcReturn, setSvcReturn] = useState(false); // return to available after service

  // Dispose form
  const [dispReason, setDispReason] = useState("");
  const [dispMethod, setDispMethod] = useState("");
  const [dispValue, setDispValue] = useState("");

  useEffect(() => {
    if (open) {
      setNewStatus(""); setStatusCond("keep"); setStatusReason("");
      setSvcType("cleaning"); setSvcProvider(""); setSvcBy(""); setSvcCost("0"); setSvcDesc(""); setSvcReturn(false);
      setDispReason(""); setDispMethod(""); setDispValue("");
    }
  }, [open, unit?.id]);

  if (!unit) return null;
  const meta = STATUS_META[unit.status];
  const targets = QUICK_TRANSITIONS[unit.status];

  const submitStatus = async () => {
    if (!newStatus) return;
    await changeStatus.mutateAsync({
      unitId: unit.id, status: newStatus,
      condition: statusCond === "keep" ? null : statusCond,
      reason: statusReason.trim() || null,
    });
    onOpenChange(false);
  };

  const submitService = async () => {
    await recordMaintenance.mutateAsync({
      unitId: unit.id, type: svcType,
      performedBy: svcBy.trim() || null, provider: svcProvider.trim() || null,
      cost: Number(svcCost) || 0, description: svcDesc.trim() || null,
      newStatus: svcReturn ? "available" : (svcType === "cleaning" ? "cleaning" : "maintenance"),
    });
    onOpenChange(false);
  };

  const submitDispose = async () => {
    if (!dispReason.trim()) return;
    await disposeUnit.mutateAsync({
      unitId: unit.id, reason: dispReason.trim(),
      method: dispMethod.trim() || null,
      value: dispValue ? Number(dispValue) : null,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="font-mono">{unit.unit_code}</span>
            {unit.size ? <Badge variant="outline">{unit.size}</Badge> : null}
            <Badge variant={meta.variant} className="capitalize">{meta.label}</Badge>
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground -mt-2">
          {costumeName} · condition {conditionLabel(unit.condition)} · {meta.hint}
        </p>

        <Tabs defaultValue="actions">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="actions">Actions</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          {/* ── Actions ─────────────────────────────────────────── */}
          <TabsContent value="actions" className="space-y-4 pt-2">
            {unit.status === "retired" ? (
              <p className="text-sm text-muted-foreground rounded-md border p-3">
                This unit is retired/disposed — a terminal state. No further changes are possible.
              </p>
            ) : (
              <>
                {/* Change status */}
                <div className="rounded-lg border p-3 space-y-2">
                  <p className="text-sm font-medium flex items-center gap-2"><ArrowRightLeft className="h-4 w-4" /> Change status</p>
                  {targets.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No manual transitions from “{meta.label}”.</p>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">New status</Label>
                          <Select value={newStatus} onValueChange={(v) => setNewStatus(v as UnitStatus)}>
                            <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                            <SelectContent>
                              {targets.map((s) => (
                                <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Condition</Label>
                          <Select value={statusCond} onValueChange={(v) => setStatusCond(v as UnitCondition | "keep")}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="keep">Keep ({conditionLabel(unit.condition)})</SelectItem>
                              {CONDITIONS.map((c) => (
                                <SelectItem key={c} value={c} className="capitalize">{conditionLabel(c)}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <Input placeholder="Reason / note (optional)" value={statusReason} onChange={(e) => setStatusReason(e.target.value)} />
                      <Button size="sm" onClick={submitStatus} disabled={!newStatus || changeStatus.isPending}>
                        Update status
                      </Button>
                    </>
                  )}
                </div>

                {/* Record service */}
                <div className="rounded-lg border p-3 space-y-2">
                  <p className="text-sm font-medium flex items-center gap-2"><Wrench className="h-4 w-4" /> Record service</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Type</Label>
                      <Select value={svcType} onValueChange={(v) => setSvcType(v as UnitMaintenanceType)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {MAINTENANCE_TYPES.map((t) => (
                            <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Cost (LKR)</Label>
                      <Input type="number" min="0" step="0.01" value={svcCost} onChange={(e) => setSvcCost(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Provider</Label>
                      <Input value={svcProvider} onChange={(e) => setSvcProvider(e.target.value)} placeholder="e.g. City Dry-clean" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Performed by</Label>
                      <Input value={svcBy} onChange={(e) => setSvcBy(e.target.value)} placeholder="Staff / vendor" />
                    </div>
                  </div>
                  <Textarea rows={2} placeholder="Description" value={svcDesc} onChange={(e) => setSvcDesc(e.target.value)} />
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input type="checkbox" checked={svcReturn} onChange={(e) => setSvcReturn(e.target.checked)} />
                    Mark available (back in service) when done
                  </label>
                  <Button size="sm" variant="secondary" onClick={submitService} disabled={recordMaintenance.isPending}>
                    <Sparkles className="h-4 w-4 mr-1" /> Log service
                  </Button>
                </div>

                {/* Dispose */}
                {canDispose(unit.status) && (
                  <div className="rounded-lg border border-destructive/40 p-3 space-y-2">
                    <p className="text-sm font-medium flex items-center gap-2 text-destructive"><Ban className="h-4 w-4" /> Dispose / retire</p>
                    <div className="grid grid-cols-2 gap-2">
                      <Input placeholder="Method (donated, sold…)" value={dispMethod} onChange={(e) => setDispMethod(e.target.value)} />
                      <Input type="number" min="0" step="0.01" placeholder="Residual value (LKR)" value={dispValue} onChange={(e) => setDispValue(e.target.value)} />
                    </div>
                    <Input placeholder="Reason (required)" value={dispReason} onChange={(e) => setDispReason(e.target.value)} />
                    <Button size="sm" variant="destructive" onClick={submitDispose} disabled={!dispReason.trim() || disposeUnit.isPending}>
                      Retire this unit
                    </Button>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* ── History ─────────────────────────────────────────── */}
          <TabsContent value="history" className="space-y-4 pt-2">
            <div>
              <p className="text-sm font-medium flex items-center gap-2 mb-2"><History className="h-4 w-4" /> Event timeline</p>
              {events.length === 0 && <p className="text-xs text-muted-foreground">No events yet.</p>}
              <ol className="space-y-2">
                {events.map((e) => (
                  <li key={e.id} className="text-xs border-l-2 pl-3 pb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium capitalize">{e.event_type.replace("_", " ")}</span>
                      {e.from_value && <span className="text-muted-foreground">{e.from_value} → {e.to_value}</span>}
                      {!e.from_value && e.to_value && <span className="text-muted-foreground capitalize">{e.to_value}</span>}
                    </div>
                    {e.notes && <p className="text-muted-foreground">{e.notes}</p>}
                    <p className="text-muted-foreground/70">{fmtDate(e.created_at)}</p>
                  </li>
                ))}
              </ol>
            </div>
            <Separator />
            <div>
              <p className="text-sm font-medium flex items-center gap-2 mb-2"><Wrench className="h-4 w-4" /> Maintenance log</p>
              {records.length === 0 && <p className="text-xs text-muted-foreground">No service records yet.</p>}
              <ul className="space-y-2">
                {records.map((r) => (
                  <li key={r.id} className="text-xs rounded-md border p-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium capitalize">{r.maintenance_type}</span>
                      <span>{formatCurrency(r.cost)}</span>
                    </div>
                    {r.description && <p className="text-muted-foreground">{r.description}</p>}
                    <p className="text-muted-foreground/70">
                      {new Date(r.maintenance_date).toLocaleDateString()}{r.provider ? ` · ${r.provider}` : ""}{r.performed_by ? ` · ${r.performed_by}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
