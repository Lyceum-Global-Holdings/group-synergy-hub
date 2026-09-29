import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ActionListEditor } from "./ActionListEditor";
import { type ActionDraft, actionsPayload, useQhseStep } from "@/hooks/construction/useQhseWorkflow";

type Open = { open: boolean; onOpenChange: (open: boolean) => void };
const today = () => new Date().toISOString().slice(0, 10);

/** Pass, conditional pass (with actions) or fail (findings and actions). */
export function RecordQualityResultDialog({ open, onOpenChange, inspection }: Open & { inspection: { id: string; inspection_number: string; title: string } | null }) {
  const step = useQhseStep();
  const [result, setResult] = useState<"pass" | "conditional_pass" | "fail">("pass");
  const [findings, setFindings] = useState("");
  const [actions, setActions] = useState<ActionDraft[]>([]);
  useEffect(() => { if (open) { setResult("pass"); setFindings(""); setActions([]); } }, [open]);

  const needsActions = result !== "pass";
  const missing = needsActions && (!findings.trim() || actionsPayload(actions).length === 0);
  const save = () =>
    inspection && step.mutate(
      { fn: "record_quality_result", args: { p_id: inspection.id, p_result: result, p_findings: findings, p_actions: actionsPayload(actions) },
        done: result === "fail" ? "Recorded as failed; re-inspect once the actions are done" : "Result recorded" },
      { onSuccess: () => onOpenChange(false) },
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record result · {inspection?.inspection_number}</DialogTitle>
          <DialogDescription>{inspection?.title}. A conditional pass or a fail needs the findings and at least one corrective action.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Result *</Label>
            <Select value={result} onValueChange={(v) => setResult(v as typeof result)}>
              <SelectTrigger aria-label="Result"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pass">Pass</SelectItem>
                <SelectItem value="conditional_pass">Conditional pass</SelectItem>
                <SelectItem value="fail">Fail</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="qi-findings">Findings{needsActions ? " *" : ""}</Label>
            <Textarea id="qi-findings" rows={3} value={findings} onChange={(e) => setFindings(e.target.value)} />
          </div>
          <ActionListEditor value={actions} onChange={setActions} required={needsActions} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={missing || step.isPending}>
            {step.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Record result
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ReinspectDialog({ open, onOpenChange, inspection }: Open & { inspection: { id: string; inspection_number: string } | null }) {
  const step = useQhseStep();
  const [date, setDate] = useState(today());
  useEffect(() => { if (open) setDate(today()); }, [open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Re-inspect {inspection?.inspection_number}</DialogTitle>
          <DialogDescription>Schedules a new inspection of the same work, linked to this one.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          <Label htmlFor="reinspect-date">Inspection date *</Label>
          <Input id="reinspect-date" type="date" min={today()} value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!date || step.isPending}
            onClick={() => inspection && step.mutate({ fn: "schedule_reinspection", args: { p_id: inspection.id, p_date: date }, done: "Re-inspection scheduled" },
              { onSuccess: () => onOpenChange(false) })}>
            Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Closing needs the root cause and no action still open; serious incidents are closed by a manager. */
export function CloseIncidentDialog({ open, onOpenChange, incident }: Open & {
  incident: { id: string; incident_number: string; title: string; root_cause?: string | null; preventive_actions?: string | null } | null;
}) {
  const step = useQhseStep();
  const [rootCause, setRootCause] = useState("");
  const [preventive, setPreventive] = useState("");
  const [note, setNote] = useState("");
  useEffect(() => {
    if (open) { setRootCause(incident?.root_cause ?? ""); setPreventive(incident?.preventive_actions ?? ""); setNote(""); }
  }, [open, incident]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Close {incident?.incident_number}</DialogTitle>
          <DialogDescription>
            {incident?.title}. Its corrective actions must be done first; a high or critical, lost-time or fatal incident is closed by the
            project manager, a manager or an admin.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="inc-root">Root cause *</Label>
            <Textarea id="inc-root" rows={3} value={rootCause} onChange={(e) => setRootCause(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="inc-prev">Preventive measures</Label>
            <Textarea id="inc-prev" rows={2} value={preventive} onChange={(e) => setPreventive(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="inc-note">Closing note</Label>
            <Input id="inc-note" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!rootCause.trim() || step.isPending}
            onClick={() => incident && step.mutate(
              { fn: "close_safety_incident", args: { p_id: incident.id, p_root_cause: rootCause, p_preventive_actions: preventive, p_note: note }, done: "Incident closed" },
              { onSuccess: () => onOpenChange(false) })}>
            Close incident
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Score, findings and hazards; hazards found need at least one action. */
export function CompleteSafetyInspectionDialog({ open, onOpenChange, inspection }: Open & { inspection: { id: string; inspection_number: string } | null }) {
  const step = useQhseStep();
  const [score, setScore] = useState("");
  const [findings, setFindings] = useState("");
  const [hazards, setHazards] = useState("");
  const [actions, setActions] = useState<ActionDraft[]>([]);
  useEffect(() => { if (open) { setScore(""); setFindings(""); setHazards(""); setActions([]); } }, [open]);
  const scoreNum = Number(score);
  const badScore = score === "" || Number.isNaN(scoreNum) || scoreNum < 0 || scoreNum > 100;
  const needsActions = !!hazards.trim();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Complete {inspection?.inspection_number}</DialogTitle>
          <DialogDescription>Hazards found need at least one corrective action; the follow-up date tracks them.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="si-score">Score (0–100) *</Label>
            <Input id="si-score" type="number" min={0} max={100} value={score} onChange={(e) => setScore(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="si-findings">Findings</Label>
            <Textarea id="si-findings" rows={2} value={findings} onChange={(e) => setFindings(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="si-hazards">Hazards identified</Label>
            <Textarea id="si-hazards" rows={2} value={hazards} onChange={(e) => setHazards(e.target.value)} />
          </div>
          <ActionListEditor value={actions} onChange={setActions} required={needsActions} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={badScore || (needsActions && actionsPayload(actions).length === 0) || step.isPending}
            onClick={() => inspection && step.mutate(
              { fn: "complete_safety_inspection",
                args: { p_id: inspection.id, p_score: scoreNum, p_findings: findings, p_hazards: hazards, p_actions: actionsPayload(actions) },
                done: "Inspection completed" },
              { onSuccess: () => onOpenChange(false) })}>
            Complete inspection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
