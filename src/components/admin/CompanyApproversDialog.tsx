import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  APPROVAL_LEVELS,
  type ApprovalLevel,
  type CompanyApproverRow,
  useCompanyApprovalSetup,
  useRemoveCompanyApprover,
  useSaveCompanyApprovalSettings,
  useSaveCompanyApprover,
} from "@/hooks/useCompanyApprovers";

const money = (n: number) => `LKR ${Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
const levelOf = (v: string) => APPROVAL_LEVELS.find((l) => l.value === v);
const parseAmount = (v: string) => (v.trim() === "" ? null : Number(v));

interface Draft {
  id?: string;
  userId: string;
  level: ApprovalLevel;
  limit: string;
  department: string;
  isPrimary: boolean;
}

const EMPTY: Draft = { userId: "", level: "hod", limit: "", department: "", isPrimary: false };

/** Admin › Companies › Approvers & limits. The database enforces every rule shown here. */
export function CompanyApproversDialog({
  company,
  onOpenChange,
}: {
  company: { id: string; name: string };
  onOpenChange: (open: boolean) => void;
}) {
  const { data: setup, isLoading, error } = useCompanyApprovalSetup(company.id);
  const saveApprover = useSaveCompanyApprover();
  const removeApprover = useRemoveCompanyApprover();
  const saveSettings = useSaveCompanyApprovalSettings();

  const [threshold, setThreshold] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  useEffect(() => {
    if (setup) setThreshold(setup.pr_final_approval_above == null ? "" : String(setup.pr_final_approval_above));
  }, [setup]);

  const thresholdValue = parseAmount(threshold);
  const thresholdInvalid = thresholdValue !== null && (!Number.isFinite(thresholdValue) || thresholdValue < 0);
  const thresholdChanged = setup && thresholdValue !== (setup.pr_final_approval_above == null ? null : Number(setup.pr_final_approval_above));

  const limitValue = draft ? parseAmount(draft.limit) : null;
  const draftInvalid = !draft?.userId || (limitValue !== null && (!Number.isFinite(limitValue) || limitValue < 0));

  const edit = (a: CompanyApproverRow) =>
    setDraft({
      id: a.id,
      userId: a.user_id,
      level: a.approval_level,
      limit: a.can_approve_up_to_amount == null ? "" : String(a.can_approve_up_to_amount),
      department: a.department ?? "",
      isPrimary: a.is_primary,
    });

  const save = () => {
    if (!draft || draftInvalid) return;
    saveApprover.mutate(
      {
        id: draft.id,
        companyId: company.id,
        userId: draft.userId,
        level: draft.level,
        limit: limitValue,
        department: draft.department,
        isPrimary: draft.isPrimary,
      },
      { onSuccess: () => setDraft(null) },
    );
  };

  // The person being edited stays selectable even if they have since left.
  const people = [...(setup?.candidates ?? [])];
  if (draft?.id && setup && !people.some((p) => p.user_id === draft.userId)) {
    const current = setup.approvers.find((a) => a.id === draft.id);
    if (current) people.unshift({ user_id: current.user_id, full_name: current.full_name, email: current.email });
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Approvers &amp; limits: {company.name}</DialogTitle>
          <DialogDescription>
            Who can approve requisitions and purchase orders for this company, and up to what amount.
          </DialogDescription>
        </DialogHeader>

        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {error && <p className="text-sm text-destructive">Couldn't load approvers: {(error as Error).message}</p>}

        {setup && (
          <div className="space-y-6 text-sm">
            <section className="space-y-2">
              <h3 className="font-semibold">Requisitions</h3>
              <div className="flex flex-wrap items-end gap-2">
                <div className="space-y-1">
                  <Label htmlFor="pr-threshold">Final approval needed above (LKR)</Label>
                  <Input
                    id="pr-threshold"
                    type="number"
                    min={0}
                    className="w-48"
                    placeholder="No second level"
                    value={threshold}
                    onChange={(e) => setThreshold(e.target.value)}
                  />
                </div>
                <Button
                  size="sm"
                  onClick={() => saveSettings.mutate({ companyId: company.id, prFinalApprovalAbove: thresholdValue })}
                  disabled={!thresholdChanged || thresholdInvalid || saveSettings.isPending}
                >
                  Save
                </Button>
              </div>
              <p className="text-muted-foreground">
                {thresholdValue === null || thresholdInvalid
                  ? "A department head's approval is enough for any requisition."
                  : `Requisitions above ${money(thresholdValue)} need a department head's approval and then a final approval from a manager or finance approver (or the company manager).`}
              </p>
            </section>

            <section className="space-y-2">
              <h3 className="font-semibold">Set on the company</h3>
              <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1">
                <dt className="text-muted-foreground">Head of department</dt>
                <dd>{setup.hod?.full_name ?? setup.hod?.email ?? "Not set"} <span className="text-muted-foreground">· requisitions, PO final approval</span></dd>
                <dt className="text-muted-foreground">Manager</dt>
                <dd>{setup.manager?.full_name ?? setup.manager?.email ?? "Not set"} <span className="text-muted-foreground">· requisition final approval</span></dd>
              </dl>
              <p className="text-muted-foreground">Change these in Edit Company. Neither has an amount limit.</p>
            </section>

            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Company approvers</h3>
                {!draft && (
                  <Button size="sm" variant="outline" onClick={() => setDraft({ ...EMPTY })}>
                    <Plus className="mr-2 h-4 w-4" /> Add approver
                  </Button>
                )}
              </div>

              {setup.approvers.length === 0 ? (
                <p className="text-muted-foreground">No company approvers yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Person</TableHead>
                      <TableHead>Level</TableHead>
                      <TableHead>Limit</TableHead>
                      <TableHead className="w-24" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {setup.approvers.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>
                          <div className="font-medium">{a.full_name ?? a.email ?? "Unknown user"}</div>
                          <div className="text-xs text-muted-foreground">{a.email}{a.department ? ` · ${a.department}` : ""}</div>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {a.is_primary && <Badge variant="secondary">Primary</Badge>}
                            {a.deactivated && <Badge variant="destructive">Deactivated</Badge>}
                            {!a.deactivated && !a.in_company && <Badge variant="destructive">No longer in this company</Badge>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>{levelOf(a.approval_level)?.label ?? a.approval_level}</div>
                          <div className="text-xs text-muted-foreground">{levelOf(a.approval_level)?.approves}</div>
                        </TableCell>
                        <TableCell>{a.can_approve_up_to_amount == null ? "No limit" : money(a.can_approve_up_to_amount)}</TableCell>
                        <TableCell className="text-right">
                          {confirmRemove === a.id ? (
                            <div className="flex justify-end gap-1">
                              <Button size="sm" variant="destructive" onClick={() => removeApprover.mutate({ id: a.id, companyId: company.id }, { onSuccess: () => setConfirmRemove(null) })}>
                                Remove
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setConfirmRemove(null)}>Keep</Button>
                            </div>
                          ) : (
                            <div className="flex justify-end gap-1">
                              <Button size="icon" variant="ghost" aria-label={`Edit ${a.full_name ?? "approver"}`} onClick={() => edit(a)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" aria-label={`Remove ${a.full_name ?? "approver"}`} onClick={() => setConfirmRemove(a.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              {draft && (
                <div className="space-y-3 rounded-md border p-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <Label>Person</Label>
                      <Select value={draft.userId || undefined} onValueChange={(v) => setDraft({ ...draft, userId: v })}>
                        <SelectTrigger aria-label="Person"><SelectValue placeholder="Choose a user of this company" /></SelectTrigger>
                        <SelectContent>
                          {people.map((p) => (
                            <SelectItem key={p.user_id} value={p.user_id}>{p.full_name ?? p.email}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Level</Label>
                      <Select value={draft.level} onValueChange={(v) => setDraft({ ...draft, level: v as ApprovalLevel })}>
                        <SelectTrigger aria-label="Level"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {APPROVAL_LEVELS.map((l) => (
                            <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">Can approve: {levelOf(draft.level)?.approves}</p>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="approver-limit">Limit (LKR)</Label>
                      <Input
                        id="approver-limit"
                        type="number"
                        min={0}
                        placeholder="No limit"
                        value={draft.limit}
                        onChange={(e) => setDraft({ ...draft, limit: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground">Requisitions and POs above this need someone else.</p>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="approver-department">Department (optional)</Label>
                      <Input
                        id="approver-department"
                        value={draft.department}
                        onChange={(e) => setDraft({ ...draft, department: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="approver-primary"
                      checked={draft.isPrimary}
                      onCheckedChange={(v) => setDraft({ ...draft, isPrimary: v === true })}
                    />
                    <Label htmlFor="approver-primary" className="font-normal">Primary approver at this level</Label>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={save} disabled={draftInvalid || saveApprover.isPending}>
                      {draft.id ? "Save changes" : "Add approver"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>Cancel</Button>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
