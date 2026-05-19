import { cn } from "@/lib/utils";

interface LivePulseIndicatorProps {
  live: boolean;
}

export function LivePulseIndicator({ live }: LivePulseIndicatorProps) {
  return (
    <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border bg-card text-xs font-medium">
      <span className="relative inline-flex h-2 w-2">
        <span
          className={cn(
            "absolute inline-flex h-full w-full rounded-full opacity-75",
            live ? "bg-success animate-ping" : "bg-muted-foreground/30",
          )}
        />
        <span
          className={cn(
            "relative inline-flex rounded-full h-2 w-2",
            live ? "bg-success" : "bg-muted-foreground/50",
          )}
        />
      </span>
      {live ? "Live update" : "Live"}
    </div>
  );
}
