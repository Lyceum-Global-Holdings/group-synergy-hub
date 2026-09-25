import { ReactNode } from "react";
import { Search, X, type LucideIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Shared building blocks for the Item & Bin Master module so every tab
// (items, bins, categories, units) has the same modern look.

export const thClass =
  "h-11 whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";

/** Header sort buttons: Tailwind's reset drops text-transform on buttons. */
export const thButton = "inline-flex items-center uppercase hover:text-foreground";

export const iconBtn =
  "inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40";

/** Solid row colours so a pinned (sticky) cell can match the row behind it. */
export const ROW_HOVER = "hover:bg-[hsl(220_20%_98.3%)]";
export const ROW_SELECTED = "data-[state=selected]:bg-[hsl(213_70%_97%)]";
export const STICKY_TD =
  "sticky right-0 bg-card shadow-[inset_1px_0_0_hsl(var(--border)/0.6)] group-hover:bg-[hsl(220_20%_98.3%)] group-data-[state=selected]:bg-[hsl(213_70%_97%)]";
export const STICKY_TH =
  "sticky right-0 z-20 bg-[hsl(var(--surface-2))] shadow-[inset_1px_0_0_hsl(var(--border))]";

export const pillTrigger = (active: boolean) =>
  cn(
    "h-9 w-auto min-w-[140px] gap-2 rounded-full border-border/70 bg-background px-3.5 text-sm shadow-none",
    active && "border-primary/40 bg-primary/5 font-medium text-primary",
  );

export const pillButton = "h-9 rounded-full border-border/70 px-3.5";

export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-3 rounded-2xl border border-border/60 bg-card p-3 shadow-[var(--shadow-xs)]", className)}>
      {children}
    </div>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <div className={cn("relative min-w-[220px] max-w-md flex-1", className)}>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        placeholder={placeholder}
        aria-label={placeholder.replace(/…$/, "")}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 rounded-full border-transparent bg-muted/60 pl-10 pr-9 focus-visible:bg-background"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap rounded-full bg-muted p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all",
            value === o.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
          {o.count !== undefined && <span className="tabular-nums text-muted-foreground">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function StatTile({
  icon: Icon,
  label,
  value,
  hint,
  tone = "default",
  loading,
  onClick,
  active,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "default" | "alert" | "good";
  loading?: boolean;
  onClick?: () => void;
  active?: boolean;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      {...(onClick ? { type: "button" as const, onClick, "aria-pressed": !!active } : {})}
      title={hint}
      className={cn(
        "flex min-w-0 items-center gap-2.5 rounded-2xl border border-border/60 bg-card p-3 text-left shadow-[var(--shadow-xs)] transition-all sm:gap-3 sm:p-4",
        onClick && "hover:border-primary/40 hover:shadow-[var(--shadow-sm)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active && "border-primary/50 ring-2 ring-primary/15",
      )}
    >
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl sm:h-10 sm:w-10",
          tone === "alert" ? "bg-destructive/10 text-destructive" : tone === "good" ? "bg-emerald-500/10 text-emerald-600" : "bg-primary/10 text-primary",
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs text-muted-foreground">{label}</span>
        {loading ? (
          <span className="mt-1 block h-6 w-14 animate-pulse rounded-md bg-muted" />
        ) : (
          <span className={cn("block truncate text-lg font-semibold tabular-nums tracking-tight sm:text-xl", tone === "alert" && "text-destructive")}>
            {value}
          </span>
        )}
      </span>
    </Tag>
  );
}

const STATUS: Record<string, { dot: string; pill: string }> = {
  active: { dot: "bg-emerald-500", pill: "bg-emerald-50 text-emerald-700 ring-emerald-600/15" },
  inactive: { dot: "bg-slate-400", pill: "bg-slate-100 text-slate-600 ring-slate-500/15" },
  discontinued: { dot: "bg-red-500", pill: "bg-red-50 text-red-700 ring-red-600/15" },
  maintenance: { dot: "bg-amber-500", pill: "bg-amber-50 text-amber-700 ring-amber-600/20" },
  full: { dot: "bg-red-500", pill: "bg-red-50 text-red-700 ring-red-600/15" },
};

export function StatusPill({ status }: { status: string }) {
  const s = STATUS[status] ?? STATUS.inactive;
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium capitalize ring-1 ring-inset", s.pill)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
      {status}
    </span>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <Icon className="h-6 w-6" />
      </span>
      <div>
        <div className="text-sm font-medium text-foreground">{title}</div>
        {description && <div className="mt-1 max-w-md text-sm text-muted-foreground">{description}</div>}
      </div>
      {action}
    </div>
  );
}

/** Rounded card that holds a table; optional footer strip. */
export function DataCard({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-[var(--shadow-xs)]">
      {children}
      {footer && <div className="border-t border-border/50 px-4 py-2.5 text-xs text-muted-foreground">{footer}</div>}
    </div>
  );
}

/** Code-style chip for item / bin / category codes. */
export function CodeChip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground/80", className)}>
      {children}
    </span>
  );
}
