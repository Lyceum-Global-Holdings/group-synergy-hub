import { differenceInCalendarDays, format, parseISO } from "date-fns";
import type { Contract, RenewalType } from "@/types/contracts";

// What happens when a contract reaches its expiry date. The nightly job
// (run_contract_lifecycle, migration 20260928120000) acts on auto_renew /
// renewal_type; these helpers keep the screens saying the same thing.

export type RenewalPolicy = "auto" | "review" | "renegotiate" | "none";

export const RENEWAL_POLICIES: { value: RenewalPolicy; label: string; hint: string }[] = [
  { value: "auto", label: "Renew automatically", hint: "Extended for another term on its expiry date, up to the renewal limit." },
  { value: "review", label: "Review before renewing", hint: "The owner is reminded before it expires; it expires unless someone renews it." },
  { value: "renegotiate", label: "Renegotiate", hint: "The owner is reminded to renegotiate; it expires unless someone renews it." },
  { value: "none", label: "Let it expire", hint: "It expires on its expiry date. The owner is still reminded beforehand." },
];

type RenewalFields = Pick<Contract, "auto_renew" | "renewal_type">;

export function renewalPolicyOf(c: Partial<RenewalFields>): RenewalPolicy {
  if (c.auto_renew || c.renewal_type === "auto_renewal") return "auto";
  if (c.renewal_type === "manual_review") return "review";
  if (c.renewal_type === "renegotiation_required") return "renegotiate";
  return "none";
}

export function policyFields(policy: RenewalPolicy | undefined): { auto_renew: boolean; renewal_type: RenewalType | null } {
  switch (policy) {
    case "auto": return { auto_renew: true, renewal_type: "auto_renewal" };
    case "review": return { auto_renew: false, renewal_type: "manual_review" };
    case "renegotiate": return { auto_renew: false, renewal_type: "renegotiation_required" };
    default: return { auto_renew: false, renewal_type: null };
  }
}

const toDate = (d: string | Date) => (typeof d === "string" ? parseISO(d) : d);
const iso = (d: Date) => format(d, "yyyy-MM-dd");
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** Adds months the way Postgres does: a missing day falls back to the month's last day. */
function addMonthsClamped(d: Date, months: number) {
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return new Date(target.getFullYear(), target.getMonth(), Math.min(d.getDate(), lastDay));
}

/** Term length in whole months (at least 1); same rule as contract_term_months(). */
export function contractTermMonths(effective: string, expiry: string): number {
  const start = toDate(effective);
  const end = addDays(toDate(expiry), 1);
  let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  if (end.getDate() < start.getDate()) months -= 1;
  const days = differenceInCalendarDays(end, addMonthsClamped(start, months));
  return Math.max(1, months + (days >= 15 ? 1 : 0));
}

/** Last day of the next term; same rule as contract_extend(). */
export function nextExpiry(expiry: string, months: number): string {
  return iso(addDays(addMonthsClamped(addDays(toDate(expiry), 1), months), -1));
}

export function renewalTermOf(c: Pick<Contract, "effective_date" | "expiry_date"> & { renewal_term_months?: number | null }): number | null {
  if (c.renewal_term_months) return c.renewal_term_months;
  return c.expiry_date ? contractTermMonths(c.effective_date, c.expiry_date) : null;
}

const months = (n: number) => `${n} month${n === 1 ? "" : "s"}`;
const pretty = (d: string) => format(toDate(d), "d MMM yyyy");

export interface RenewalSummary {
  tone: "ok" | "soon" | "overdue" | "muted";
  label: string;
  detail?: string;
}

type SummaryInput = Pick<Contract, "status" | "effective_date" | "expiry_date" | "auto_renew" | "renewal_type" | "renewal_notice_days" | "max_renewal_count" | "renewal_count"> & {
  renewal_term_months?: number | null;
};

/** One line for tables and the details dialog. */
export function renewalSummary(c: SummaryInput, today: Date = new Date()): RenewalSummary {
  if (["terminated", "closed"].includes(c.status)) return { tone: "muted", label: "Ended" };
  if (c.status === "expired") return { tone: "overdue", label: c.expiry_date ? `Expired ${pretty(c.expiry_date)}` : "Expired" };
  if (!c.expiry_date) return { tone: "muted", label: "No expiry date" };

  const daysLeft = differenceInCalendarDays(toDate(c.expiry_date), today);
  const policy = renewalPolicyOf(c);
  const limitReached = c.max_renewal_count != null && (c.renewal_count ?? 0) >= c.max_renewal_count;
  const term = renewalTermOf(c);

  if (policy === "auto" && !limitReached) {
    return {
      tone: "ok",
      label: `Renews ${pretty(c.expiry_date)}`,
      detail: `Automatically, for ${months(term ?? 12)}${c.max_renewal_count != null ? ` (renewal ${(c.renewal_count ?? 0) + 1} of ${c.max_renewal_count})` : ""}`,
    };
  }
  const notice = c.renewal_notice_days ?? 30;
  const when = daysLeft < 0 ? "Expiry passed" : daysLeft === 0 ? "Expires today" : `Expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`;
  const why = limitReached ? "Renewal limit reached" : policy === "renegotiate" ? "Renegotiate before then" : policy === "review" ? "Needs a renewal decision" : undefined;
  if (daysLeft <= notice) return { tone: "soon", label: when, detail: why };
  return { tone: "muted", label: `Expires ${pretty(c.expiry_date)}`, detail: why };
}

/** Active contracts inside their reminder window that won't renew by themselves. */
export function needsRenewalDecision(c: SummaryInput, today: Date = new Date()): boolean {
  if (!["active", "renewed", "approved"].includes(c.status) || !c.expiry_date) return false;
  return renewalSummary(c, today).tone === "soon";
}
