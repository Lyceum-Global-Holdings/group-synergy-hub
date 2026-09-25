import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { CircleLink, GrainOverlay, NIGHT_GRADIENT, Skeleton } from "./DashCard";

interface PillarCardProps {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  /** "night" = dark navy feature card (white text), for the one metric to spotlight. */
  variant?: "default" | "night";
  href?: string;
  cta?: string;
  loading?: boolean;
  children: ReactNode;
}

export function PillarCard({
  title,
  subtitle,
  icon: Icon,
  variant = "default",
  href,
  cta = "View module",
  loading,
  children,
}: PillarCardProps) {
  const night = variant === "night";
  return (
    <section
      className={cn(
        "relative flex h-full flex-col overflow-hidden rounded-3xl p-5",
        night
          ? // `dark` scopes the dark theme tokens to this card, so the shared
            // HeroMetric / SecondaryStat pieces render light-on-navy.
            cn("dark", NIGHT_GRADIENT, "text-foreground shadow-xl shadow-primary/20")
          : "border border-border/60 bg-card shadow-[var(--shadow-xs)] transition-shadow hover:shadow-[var(--shadow-md)]",
      )}
    >
      {night && (
        <>
          <GrainOverlay />
          {/* concentric rings, echoing the swirl on the reference tracker card */}
          <svg aria-hidden className="pointer-events-none absolute -bottom-24 -right-20 h-72 w-72 text-sky-300/15" viewBox="0 0 200 200" fill="none">
            {[30, 45, 60, 75, 90].map((r) => (
              <circle key={r} cx="100" cy="100" r={r} stroke="currentColor" strokeWidth="1.2" />
            ))}
          </svg>
        </>
      )}

      <div className="relative mb-5 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
              night ? "bg-white/10 text-sky-300" : "bg-primary/10 text-primary",
            )}
          >
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold tracking-tight">{title}</h3>
            {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        {href && <CircleLink to={href} label={`${cta}: ${title}`} tone={night ? "onDark" : "default"} />}
      </div>

      <div className="relative flex flex-1 flex-col">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-9 w-36" />
            <Skeleton className="h-3 w-44" />
            <Skeleton className="h-12 w-full" />
            <div className="grid grid-cols-2 gap-2">
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
            </div>
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

interface HeroMetricProps {
  value: ReactNode;
  label: string;
  /** `value` carries its own sign; `positive` means good (green), not "up". */
  delta?: { value: string; positive?: boolean } | null;
}

export function HeroMetric({ value, label, delta }: HeroMetricProps) {
  return (
    <div className="mb-4">
      <div className="text-3xl font-semibold leading-none tracking-tight tabular-nums text-foreground">{value}</div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <p className="text-xs text-muted-foreground">{label}</p>
        {delta && (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] font-medium",
              delta.positive ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive",
            )}
          >
            {delta.value}
          </span>
        )}
      </div>
    </div>
  );
}

/** Wraps SecondaryStat tiles in a two-column grid. */
export function StatGrid({ children, cols = 2 }: { children: ReactNode; cols?: 2 | 3 }) {
  return (
    <div className={cn("mt-auto grid gap-2 pt-4", cols === 3 ? "grid-cols-3" : "grid-cols-2")}>
      {children}
    </div>
  );
}

interface SecondaryStatProps {
  label: string;
  value: ReactNode;
  tone?: "default" | "warning" | "destructive" | "success";
}

export function SecondaryStat({ label, value, tone = "default" }: SecondaryStatProps) {
  const toneMap = {
    default: "text-foreground",
    warning: "text-warning",
    destructive: "text-destructive",
    success: "text-success",
  };
  return (
    <div className="rounded-2xl bg-muted/60 px-3 py-2.5">
      <div className={cn("text-base font-semibold leading-tight tabular-nums", toneMap[tone])}>{value}</div>
      <div className="mt-0.5 truncate text-[11px] text-muted-foreground" title={label}>
        {label}
      </div>
    </div>
  );
}
