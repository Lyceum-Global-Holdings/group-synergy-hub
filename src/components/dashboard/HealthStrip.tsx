import { TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle2, Clock, PackageCheck, FileSearch, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { HealthStrip as HealthStripData } from "@/hooks/useDashboardPulse";
import { CircleLink, GrainOverlay, HERO_GRADIENT, Skeleton } from "./DashCard";

interface HealthStripProps {
  data: HealthStripData | undefined;
  loading: boolean;
}

type Tone = "neutral" | "good" | "bad";

interface Tile {
  label: string;
  value: number;
  href: string;
  note: { text: string; icon: LucideIcon; tone: Tone };
  alert?: boolean;
  hero?: boolean;
}

const noteTone: Record<Tone, string> = {
  neutral: "text-muted-foreground border-border",
  good: "text-success border-success/30",
  bad: "text-destructive border-destructive/30",
};

function poNote(data?: HealthStripData): Tile["note"] {
  if (!data) return { text: "vs yesterday", icon: Minus, tone: "neutral" };
  const diff = data.po_today - data.po_yesterday;
  if (diff === 0) return { text: "Same as yesterday", icon: Minus, tone: "neutral" };
  return {
    text: `${diff > 0 ? "+" : ""}${diff} vs yesterday`,
    icon: diff > 0 ? TrendingUp : TrendingDown,
    tone: "neutral", // more or fewer POs isn't good or bad by itself
  };
}

export function HealthStrip({ data, loading }: HealthStripProps) {
  const approvals = data?.approvals_pending ?? 0;
  const lowStock = data?.low_stock ?? 0;

  const tiles: Tile[] = [
    {
      label: "Pending Approvals",
      value: approvals,
      href: "/management/approvals",
      note: approvals > 0
        ? { text: "Awaiting sign-off", icon: Clock, tone: "neutral" }
        : { text: "Nothing waiting", icon: CheckCircle2, tone: "neutral" },
      hero: true,
    },
    {
      label: "Purchase Orders Today",
      value: data?.po_today ?? 0,
      href: "/procurement/purchase-order",
      note: poNote(data),
    },
    {
      label: "GRNs Pending",
      value: data?.grn_pending ?? 0,
      href: "/warehouse/grn",
      note: { text: "Awaiting receipt", icon: PackageCheck, tone: "neutral" },
    },
    {
      label: "Stock Alerts",
      value: lowStock,
      href: "/warehouse/inventory",
      note: lowStock > 0
        ? { text: "Needs reorder", icon: AlertTriangle, tone: "bad" }
        : { text: "All stock healthy", icon: CheckCircle2, tone: "good" },
      alert: lowStock > 0,
    },
    {
      label: "Open RFQs",
      value: data?.rfqs_open ?? 0,
      href: "/sourcing/rfq-management",
      note: { text: "Collecting quotes", icon: FileSearch, tone: "neutral" },
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
      {tiles.map((t) => (
        <div
          key={t.label}
          className={cn(
            "relative flex min-h-[148px] flex-col overflow-hidden rounded-3xl p-4 transition-shadow sm:min-h-[156px] sm:p-5",
            t.hero
              ? cn(HERO_GRADIENT, "col-span-2 text-white shadow-lg shadow-primary/20 md:col-span-1")
              : "border border-border/60 bg-card shadow-[var(--shadow-xs)] hover:shadow-[var(--shadow-md)]",
          )}
        >
          {t.hero && (
            <>
              <GrainOverlay />
              <div aria-hidden className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-sky-300/25 blur-2xl" />
            </>
          )}
          <div className="relative flex items-start justify-between gap-2">
            <p className={cn("text-sm font-medium leading-snug", t.hero ? "text-white/90" : "text-foreground")}>
              {t.label}
            </p>
            <CircleLink to={t.href} label={`Open ${t.label}`} tone={t.hero ? "onDark" : "default"} />
          </div>

          <div className="relative mt-auto pt-3">
            {loading ? (
              <Skeleton className={cn("h-10 w-16", t.hero && "bg-white/20")} />
            ) : (
              <div
                className={cn(
                  "text-[2rem] font-semibold leading-none tracking-tight tabular-nums sm:text-[2.5rem]",
                  t.alert && "text-destructive",
                )}
              >
                {t.value.toLocaleString()}
              </div>
            )}
            <div
              className={cn(
                "mt-3 inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-[11px] font-medium",
                t.hero ? "border-white/25 text-white/85" : noteTone[t.note.tone],
              )}
            >
              <t.note.icon className="h-3 w-3" />
              {t.note.text}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
