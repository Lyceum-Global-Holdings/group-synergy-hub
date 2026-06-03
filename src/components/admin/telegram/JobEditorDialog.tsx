import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Plus } from "lucide-react";
import {
  REPORT_TYPE_LABELS,
  type JobUpsert,
  type TelegramReportType,
  type TelegramFrequency,
  type TelegramScheduledJob,
} from "@/hooks/useTelegramJobs";
import { useEffectiveLocationsForCompany } from "@/hooks/useWarehouseLocations";
import { useCompany } from "@/contexts/CompanyContext";

const TIMEZONES = [
  "UTC", "Asia/Dubai", "Asia/Kolkata", "Asia/Colombo", "Asia/Singapore", "Asia/Tokyo",
  "Europe/London", "Europe/Paris", "America/New_York", "America/Los_Angeles",
];
const WEEKDAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

const LOCATION_AWARE: TelegramReportType[] = ["warehouse_stock_daily", "tool_management_daily", "stock_transfer_daily"];
const PDF_CAPABLE: TelegramReportType[] = ["warehouse_stock_daily"];

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  job: TelegramScheduledJob | null;
  onSave: (data: JobUpsert) => void;
}

export function JobEditorDialog({ open, onOpenChange, job, onSave }: Props) {
  const { selectedCompany } = useCompany();
  // Use effective (company-scoped) locations — warehouse_locations has no company_id column;
  // access is resolved via the company_locations / inherit_parent chain server-side.
  const { data: effectiveLocations = [] } = useEffectiveLocationsForCompany(selectedCompany?.id);
  const locations = useMemo(
    () => [...effectiveLocations].sort((a, b) => (a.name || "").localeCompare(b.name || "")),
    [effectiveLocations],
  );

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
  const [locationIds, setLocationIds] = useState<string[]>([]);
  const [format, setFormat] = useState<"pdf" | "text">("pdf");
  const [currency, setCurrency] = useState<string>("AED");

  useEffect(() => {
    if (!open) return;
    const f = (job?.filters ?? {}) as { location_ids?: string[]; format?: "pdf" | "text"; currency?: string };
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
      setLocationIds(Array.isArray(f.location_ids) ? f.location_ids : []);
      setFormat(f.format ?? (PDF_CAPABLE.includes(job.report_type) ? "pdf" : "text"));
      setCurrency(f.currency ?? "AED");
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
      setLocationIds([]);
      setFormat("pdf");
      setCurrency("AED");
    }
  }, [open, job]);

  const addChatId = () => {
    const t = newChatId.trim();
    if (!t) return;
    // Validate: @channelusername OR numeric (optionally negative)
    const isUsername = /^@[A-Za-z0-9_]{4,}$/.test(t);
    const isNumeric = /^-?\d+$/.test(t);
    if (!isUsername && !isNumeric) {
      // eslint-disable-next-line no-alert
      alert("Chat ID must be a numeric ID (e.g. 123456789 or -1001234567890) or a @channelusername.");
      return;
    }
    // Warn if it looks like a short group ID missing the -100 supergroup prefix.
    if (isNumeric && t.startsWith("-") && !t.startsWith("-100") && t.length < 14) {
      // eslint-disable-next-line no-alert
      const ok = confirm(
        `"${t}" looks like a group ID missing the "-100" supergroup prefix.\n\n` +
        `Telegram supergroups/channels need the full ID (e.g. -1001234567890).\n\n` +
        `Add it anyway? The dispatcher will auto-retry with the -100 prefix if sending fails.`
      );
      if (!ok) return;
    }
    if (!chatIds.includes(t)) setChatIds([...chatIds, t]);
    setNewChatId("");
  };


  const toggleLocation = (id: string) => {
    setLocationIds(locationIds.includes(id) ? locationIds.filter((x) => x !== id) : [...locationIds, id]);
  };

  const handleSave = () => {
    if (!name.trim()) return;
    const filters: Record<string, unknown> = {};
    if (LOCATION_AWARE.includes(reportType)) filters.location_ids = locationIds;
    if (PDF_CAPABLE.includes(reportType)) {
      filters.format = format;
      if (currency.trim()) filters.currency = currency.trim().toUpperCase();
    }
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
      filters,
    });
  };

  const showLocation = LOCATION_AWARE.includes(reportType);
  const showFormat = PDF_CAPABLE.includes(reportType);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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

          {showFormat && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Delivery Format</Label>
                <Select value={format} onValueChange={(v) => setFormat(v as "pdf" | "text")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pdf">PDF Attachment (Stock Movement Ledger)</SelectItem>
                    <SelectItem value="text">Text Summary</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Currency</Label>
                <Input value={currency} onChange={(e) => setCurrency(e.target.value)} maxLength={6} placeholder="AED" />
              </div>
            </div>
          )}

          {showLocation && (
            <div>
              <Label>Warehouse Locations {locationIds.length === 0 && <span className="text-muted-foreground text-xs">(empty = all)</span>}</Label>
              <ScrollArea className="h-40 rounded border border-border p-2 mt-1">
                {locations.length === 0 && <p className="text-xs text-muted-foreground">No locations available for this company.</p>}
                <div className="space-y-1">
                  {locations.map((l: any) => (
                    <label key={l.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox checked={locationIds.includes(l.id)} onCheckedChange={() => toggleLocation(l.id)} />
                      <span>{l.name}</span>
                    </label>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

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
