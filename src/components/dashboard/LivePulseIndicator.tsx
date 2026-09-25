import { cn } from "@/lib/utils";

interface LivePulseIndicatorProps {
  live: boolean;
}

export function LivePulseIndicator({ live }: LivePulseIndicatorProps) {
  return (
    <div
      className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-medium"
      aria-live="polite"
    >
      <span className="relative inline-flex h-2.5 w-2.5">
        <span
          className={cn(
            "absolute inline-flex h-full w-full rounded-full opacity-75",
            live ? "animate-ping bg-success" : "bg-muted-foreground/30",
          )}
        />
        <span
          className={cn(
            "relative inline-flex h-2.5 w-2.5 rounded-full",
            live ? "bg-success" : "bg-success/70",
          )}
        />
      </span>
      {live ? "Updating…" : "Live"}
    </div>
  );
}
