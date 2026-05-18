import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, Plus } from "lucide-react";
import {
  REPORT_TYPE_LABELS,
  type JobUpsert,
  type TelegramReportType,
  type TelegramFrequency,
  type TelegramScheduledJob,
} from "@/hooks/useTelegramJobs";

const TIMEZONES = [
  "UTC", "Asia/Dubai", "Asia/Kolkata", "Asia/Colombo", "Asia/Singapore", "Asia/Tokyo",
  "Europe/London", "Europe/Paris", "America/New_York", "America/Los_Angeles",
];
const WEEKDAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  job: TelegramScheduledJob | null;
  onSave: (data: JobUpsert) => void;
}

export function JobEditorDialog({ open, onOpenChange, job, onSave }: Props) {
  const [name, setName] = useState("");
  const [reportType, setReportType] = useState<TelegramReportType>("warehouse_stock_daily");
  const [frequency, setFrequency] = useState<TelegramFrequency>("daily");
  const [sendTime, setSendTime] = useState("18:00");
  const [timezone, setTimezone] = useState("UTC");
  const [weekday, setWeekday] = useState<number>(1);
  const [dayOfMonth, setDayOfMonth] = useState<number>(1);
  const [chatIds, setChatIds] = useState<string[]>([]);
  const [newChatId, setNewChatId] = useState("");
  const [isEnabled, setIsEnabled] = useState(true);

  useEffect(() => {
    if (!open) return;
    if (job) {
      setName(job.name);
      setReportType(job.report_type);
      setFrequency(job.frequency);
      setSendTime(job.send_time.slice(0, 5));
      setTimezone(job.timezone);
      setWeekday(job.weekday ?? 1);
      setDayOfMonth(job.day_of_month ?? 1);
      setChatIds(job.chat_ids ?? []);
      setIsEnabled(job.is_enabled);
    } else {
      setName("");
      setReportType("warehouse_stock_daily");
      setFrequency("daily");
      setSendTime("18:00");
      setTimezone("UTC");
      setWeekday(1);
      setDayOfMonth(1);
      setChatIds([]);
      setIsEnabled(true);
    }
  }, [open, job]);

  const addChatId = () => {
    const t = newChatId.trim();
    if (t && !chatIds.includes(t)) setChatIds([...chatIds, t]);
    setNewChatId("");
  };

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      id: job?.id,
      name: name.trim(),
      report_type: reportType,
      frequency,
      send_time: `${sendTime}:00`,
      timezone,
      weekday: frequency === "weekly" ? weekday : null,
      day_of_month: frequency === "monthly" ? dayOfMonth : null,
      chat_ids: chatIds,
      is_enabled: isEnabled,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{job ? "Edit Schedule" : "New Schedule"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Daily Warehouse Stock" />
          </div>
          <div>
            <Label>Report</Label>
            <Select value={reportType} onValueChange={(v) => setReportType(v as TelegramReportType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(REPORT_TYPE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Frequency</Label>
              <Select value={frequency} onValueChange={(v) => setFrequency(v as TelegramFrequency)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Send Time</Label>
              <Input type="time" value={sendTime} onChange={(e) => setSendTime(e.target.value)} />
            </div>
          </div>
          {frequency === "weekly" && (
            <div>
              <Label>Weekday</Label>
              <Select value={String(weekday)} onValueChange={(v) => setWeekday(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {WEEKDAYS.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {frequency === "monthly" && (
            <div>
              <Label>Day of Month (1–28)</Label>
              <Input type="number" min={1} max={28} value={dayOfMonth} onChange={(e) => setDayOfMonth(Number(e.target.value))} />
            </div>
          )}
          <div>
            <Label>Timezone</Label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Recipient Chat IDs (optional — falls back to company defaults)</Label>
            <div className="flex gap-2">
              <Input
                value={newChatId}
                onChange={(e) => setNewChatId(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addChatId())}
                placeholder="e.g. -1001234567890"
              />
              <Button type="button" size="sm" onClick={addChatId}><Plus className="h-4 w-4" /></Button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {chatIds.map((id) => (
                <Badge key={id} variant="secondary" className="gap-1">
                  {id}
                  <button onClick={() => setChatIds(chatIds.filter((x) => x !== id))}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={isEnabled} onCheckedChange={setIsEnabled} id="enabled" />
            <Label htmlFor="enabled">Enabled</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={!name.trim()}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
