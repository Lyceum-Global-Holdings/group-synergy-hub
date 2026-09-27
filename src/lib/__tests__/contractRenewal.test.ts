import { describe, it, expect } from "vitest";
import {
  contractTermMonths, needsRenewalDecision, nextExpiry, policyFields, renewalPolicyOf, renewalSummary,
} from "@/lib/contractRenewal";
import { checkRenewal, renewalPayload } from "@/components/contracts/contractRenewalForm";
import { z } from "zod";

const today = new Date(2026, 8, 28); // 28 Sep 2026
const base = {
  status: "active" as const, effective_date: "2025-10-01", expiry_date: "2026-09-30", auto_renew: false, renewal_type: null,
  renewal_notice_days: 30, max_renewal_count: null, renewal_count: 0, renewal_term_months: null,
};

describe("dates follow the database rules", () => {
  it("measures the term in whole months", () => {
    expect(contractTermMonths("2026-01-01", "2026-12-31")).toBe(12);
    expect(contractTermMonths("2026-01-15", "2026-07-14")).toBe(6);
    expect(contractTermMonths("2026-01-20", "2026-03-04")).toBe(1);
    expect(contractTermMonths("2026-01-01", "2026-01-05")).toBe(1);
  });

  it("extends without drifting at month ends", () => {
    expect(nextExpiry("2026-01-31", 1)).toBe("2026-02-28");
    expect(nextExpiry("2026-02-28", 1)).toBe("2026-03-31");
    expect(nextExpiry("2025-12-31", 12)).toBe("2026-12-31");
    expect(nextExpiry("2023-12-31", 3)).toBe("2024-03-31");
  });
});

describe("renewal policy", () => {
  it("round-trips through the contract columns", () => {
    for (const p of ["auto", "review", "renegotiate", "none"] as const) {
      expect(renewalPolicyOf(policyFields(p))).toBe(p);
    }
    expect(renewalPolicyOf({ auto_renew: true, renewal_type: null })).toBe("auto");
  });

  it("only keeps term and limit for automatic renewal", () => {
    expect(renewalPayload({ renewal_policy: "auto", renewal_term_months: "6", max_renewal_count: "", renewal_notice_days: "45" }))
      .toEqual({ renewal_term_months: 6, max_renewal_count: null, renewal_notice_days: 45 });
    expect(renewalPayload({ renewal_policy: "review", renewal_term_months: "6", max_renewal_count: "2" }))
      .toEqual({ renewal_term_months: null, max_renewal_count: null, renewal_notice_days: 30 });
  });

  it("needs an expiry date to renew automatically", () => {
    const schema = z.object({ renewal_policy: z.string(), expiry_date: z.string().optional() }).superRefine(checkRenewal as never);
    const r = schema.safeParse({ renewal_policy: "auto", expiry_date: "" });
    expect(r.success).toBe(false);
    expect(schema.safeParse({ renewal_policy: "none", expiry_date: "" }).success).toBe(true);
  });
});

describe("what the screens say", () => {
  it("auto-renewing contracts show their renewal date", () => {
    const s = renewalSummary({ ...base, auto_renew: true, renewal_type: "auto_renewal" }, today);
    expect(s).toEqual({ tone: "ok", label: "Renews 30 Sep 2026", detail: "Automatically, for 12 months" });
  });

  it("counts renewals against the limit", () => {
    expect(renewalSummary({ ...base, auto_renew: true, max_renewal_count: 3, renewal_count: 1 }, today).detail)
      .toBe("Automatically, for 12 months (renewal 2 of 3)");
    const atLimit = renewalSummary({ ...base, auto_renew: true, max_renewal_count: 1, renewal_count: 1 }, today);
    expect(atLimit).toEqual({ tone: "soon", label: "Expires in 2 days", detail: "Renewal limit reached" });
  });

  it("flags contracts inside their reminder window", () => {
    expect(renewalSummary({ ...base, renewal_type: "manual_review" }, today)).toEqual({ tone: "soon", label: "Expires in 2 days", detail: "Needs a renewal decision" });
    expect(needsRenewalDecision(base, today)).toBe(true);
    expect(needsRenewalDecision({ ...base, expiry_date: "2027-03-31" }, today)).toBe(false);
    expect(needsRenewalDecision({ ...base, auto_renew: true }, today)).toBe(false);
  });

  it("describes ended and open-ended contracts", () => {
    expect(renewalSummary({ ...base, status: "expired" }, today).label).toBe("Expired 30 Sep 2026");
    expect(renewalSummary({ ...base, status: "terminated" }, today).label).toBe("Ended");
    expect(renewalSummary({ ...base, expiry_date: null }, today).label).toBe("No expiry date");
  });
});
