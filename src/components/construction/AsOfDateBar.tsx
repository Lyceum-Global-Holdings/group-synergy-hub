import { format, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { CalendarIcon, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useResourceDate } from "@/contexts/ResourceDateContext";
import { isSameLocalDay } from "@/lib/construction/dateEffective";

interface AsOfDateBarProps {
  /** Optional label to clarify what the date filters (default: "resources"). */
  noun?: string;
  className?: string;
}

/**
 * Date filter bar for resource allocation views.
 * Defaults to today on every page entry and exposes quick presets aligned
 * with PMI PMBOK / ISO 21500 time-phased resource availability conventions.
 */
export function AsOfDateBar({ noun = "resources", className }: AsOfDateBarProps) {
  const { asOfDate, setAsOfDate, resetToToday, isToday } = useResourceDate();

  const today = new Date();
  const presets: Array<{ label: string; date: Date }> = [
    { label: "Yesterday", date: addDays(today, -1) },
    { label: "Today", date: today },
    { label: "Tomorrow", date: addDays(today, 1) },
  ];

  const isPresetActive = (d: Date) => isSameLocalDay(d, asOfDate);

  return (
    <div
      className={cn(
        "flex flex-col gap-3 p-3 rounded-lg border bg-card sm:flex-row sm:items-center sm:flex-wrap",
        className
      )}
      aria-label="Resource allocation as-of date"
    >
      <div className="flex items-center gap-2">
        <CalendarIcon className="h-5 w-5 text-primary shrink-0" />
        <span className="text-sm font-medium text-muted-foreground">As of:</span>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "min-w-[200px] justify-start text-left font-normal",
                !asOfDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {format(asOfDate, "EEE, dd MMM yyyy")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={asOfDate}
              onSelect={(d) => d && setAsOfDate(d)}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="flex items-center gap-1 flex-wrap">
        {presets.map((p) => (
          <Button
            key={p.label}
            variant={isPresetActive(p.date) ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setAsOfDate(p.date)}
            className="h-8"
          >
            {p.label}
          </Button>
        ))}
        <Button
          variant={isPresetActive(startOfWeek(today, { weekStartsOn: 1 })) ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setAsOfDate(endOfWeek(today, { weekStartsOn: 1 }))}
          className="h-8 hidden md:inline-flex"
          title="End of this week"
        >
          End of Week
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setAsOfDate(endOfMonth(today))}
          className="h-8 hidden md:inline-flex"
          title="End of this month"
        >
          End of Month
        </Button>
      </div>

      <div className="flex items-center gap-2 sm:ml-auto">
        {!isToday && (
          <Button variant="outline" size="sm" onClick={resetToToday} className="h-8 gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" />
            Reset to Today
          </Button>
        )}
        <Badge variant={isToday ? "default" : "secondary"} className="whitespace-nowrap">
          {isToday ? "Live" : "Historical view"} · {noun} active on{" "}
          {format(asOfDate, "dd MMM yyyy")}
        </Badge>
      </div>
    </div>
  );
}
