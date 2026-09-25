import { cn } from "@/lib/utils";
import type { NavBadge } from "./useNavBadges";

// ---------------------------------------------------------------------------
// Sidebar visual primitives (shared by CompanySidebar and PinnedSubmodulesGroup)
// ---------------------------------------------------------------------------

export const rowClass = (active: boolean) =>
  cn(
    "group/row flex h-9 w-full items-center gap-2.5 rounded-xl px-2.5 text-sm transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
    active
      ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground shadow-[0_1px_2px_hsl(220_25%_10%/0.06)]"
      : "font-medium text-sidebar-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",
  );

export const leafClass = (active: boolean) =>
  cn(
    "flex h-8 min-w-0 flex-1 items-center rounded-lg px-2 text-[13px] transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
    active
      ? "bg-sidebar-accent font-semibold text-sidebar-primary shadow-[0_1px_2px_hsl(220_25%_10%/0.06)]"
      : "text-sidebar-foreground/85 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",
  );

/** A tree branch: vertical guide line with a rounded elbow into each row. */
export function TreeItem({ last, children, className }: { last: boolean; children: React.ReactNode; className?: string }) {
  return (
    <li className={cn("relative pl-4", className)}>
      <span aria-hidden className="pointer-events-none absolute left-0 top-0 h-4 w-3 rounded-bl-lg border-b border-l border-sidebar-border" />
      {!last && <span aria-hidden className="pointer-events-none absolute bottom-0 left-0 top-4 border-l border-sidebar-border" />}
      {children}
    </li>
  );
}

export function CountPill({ badge, className }: { badge: Pick<NavBadge, "count" | "tone" | "label">; className?: string }) {
  return (
    <span
      title={badge.label}
      aria-label={badge.label}
      className={cn(
        "inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-md px-1 text-[10px] font-semibold tabular-nums",
        badge.tone === "alert" ? "bg-destructive text-white" : "bg-sidebar-primary/10 text-sidebar-primary",
        className,
      )}
    >
      {badge.count > 99 ? "99+" : badge.count}
    </span>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="px-2.5 pb-1 pt-4 text-[11px] font-semibold text-sidebar-muted">{children}</div>;
}

