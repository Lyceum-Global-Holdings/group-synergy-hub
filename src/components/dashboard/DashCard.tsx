import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

// Brand gradients. Fixed colours (not theme tokens) so the white text on them
// reads the same in light and dark mode — matches the login page panel.
export const HERO_GRADIENT =
  "bg-[linear-gradient(145deg,hsl(213_94%_46%)_0%,hsl(216_90%_38%)_50%,hsl(224_85%_26%)_100%)]";
export const NIGHT_GRADIENT =
  "bg-[linear-gradient(150deg,hsl(222_47%_13%)_0%,hsl(221_60%_19%)_55%,hsl(215_80%_29%)_100%)]";

// Fine film grain overlaid on the gradient cards.
export const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E" +
  "%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' " +
  "stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

// Diagonal hatching for empty/zero values (bars, gauge remainder).
export const HATCH =
  "repeating-linear-gradient(135deg, hsl(var(--muted-foreground) / 0.28) 0 2px, transparent 2px 7px)";

export const chartTooltipStyle = {
  background: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 12,
  boxShadow: "var(--shadow-md)",
  fontSize: 12,
  padding: "8px 12px",
};

export function GrainOverlay() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 opacity-[0.14] mix-blend-overlay"
      style={{ backgroundImage: GRAIN }}
    />
  );
}

export function DashCard({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "relative rounded-3xl border border-border/60 bg-card p-5 shadow-[var(--shadow-xs)]",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function DashCardHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 flex items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <h3 className="text-base font-semibold tracking-tight text-foreground">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/** Round ↗ button that opens the module behind a card. */
export function CircleLink({
  to,
  label,
  tone = "default",
}: {
  to: string;
  label: string;
  tone?: "default" | "onDark";
}) {
  return (
    <Link
      to={to}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        tone === "onDark"
          ? "bg-white text-[hsl(213_94%_40%)] hover:scale-105"
          : "border border-border bg-card text-foreground hover:border-primary hover:bg-primary hover:text-primary-foreground",
      )}
    >
      <ArrowUpRight className="h-4 w-4" />
    </Link>
  );
}

/** Small outlined pill link used in card headers ("View all", "Inventory"). */
export function PillLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="inline-flex h-8 items-center gap-1 rounded-full border border-border px-3 text-xs font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
    >
      {children}
    </Link>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-muted", className)} />;
}
