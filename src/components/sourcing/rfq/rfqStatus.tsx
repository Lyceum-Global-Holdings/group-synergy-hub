import { cn } from "@/lib/utils";
import type { QuoteStatus, RfqRfpStatus } from "@/types/rfqRfp";

const TONE = {
  slate: "bg-slate-100 text-slate-700 ring-slate-500/15",
  blue: "bg-blue-50 text-blue-700 ring-blue-600/15",
  amber: "bg-amber-50 text-amber-700 ring-amber-600/20",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  red: "bg-red-50 text-red-700 ring-red-600/15",
  indigo: "bg-indigo-50 text-indigo-700 ring-indigo-600/15",
} as const;

export const RFQ_STATUS: Record<RfqRfpStatus, { label: string; tone: keyof typeof TONE }> = {
  draft: { label: "Draft", tone: "slate" },
  published: { label: "Open for quotes", tone: "blue" },
  in_progress: { label: "Open for quotes", tone: "blue" },
  evaluation: { label: "Evaluating", tone: "amber" },
  awarded: { label: "Awarded", tone: "green" },
  cancelled: { label: "Cancelled", tone: "red" },
  closed: { label: "Closed", tone: "slate" },
};

export const QUOTE_STATUS: Record<QuoteStatus, { label: string; tone: keyof typeof TONE }> = {
  draft: { label: "Draft", tone: "slate" },
  submitted: { label: "Submitted", tone: "blue" },
  under_evaluation: { label: "Under evaluation", tone: "amber" },
  shortlisted: { label: "Shortlisted", tone: "indigo" },
  awarded: { label: "Awarded", tone: "green" },
  rejected: { label: "Not selected", tone: "red" },
};

export function StatusChip({ label, tone }: { label: string; tone: keyof typeof TONE }) {
  return (
    <span className={cn("inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", TONE[tone])}>
      {label}
    </span>
  );
}

export const RfqStatusChip = ({ status }: { status: RfqRfpStatus }) => <StatusChip {...(RFQ_STATUS[status] ?? RFQ_STATUS.draft)} />;
export const QuoteStatusChip = ({ status }: { status: QuoteStatus }) => <StatusChip {...(QUOTE_STATUS[status] ?? QUOTE_STATUS.draft)} />;

export const isOpenForQuotes = (status: RfqRfpStatus) => status === "published" || status === "in_progress";

export function formatDeadline(deadline?: string | null) {
  if (!deadline) return "No deadline";
  return new Date(deadline).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/** "3 days left", "5 hours left", "Closed 2 days ago". */
export function deadlineHint(deadline?: string | null) {
  if (!deadline) return "";
  const ms = new Date(deadline).getTime() - Date.now();
  const hours = Math.round(Math.abs(ms) / 3_600_000);
  const span = hours >= 48 ? `${Math.round(hours / 24)} days` : `${Math.max(hours, 1)} hour${hours === 1 ? "" : "s"}`;
  return ms >= 0 ? `${span} left` : `Deadline passed ${span} ago`;
}

export function formatMoney(amount: number | null | undefined, currency?: string | null) {
  if (amount == null) return "—";
  return `${currency ?? "LKR"} ${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
