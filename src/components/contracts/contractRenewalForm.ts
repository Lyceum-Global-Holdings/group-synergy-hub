import { z } from "zod";
import type { RenewalPolicy } from "@/lib/contractRenewal";

/** Form fields shared by the create and edit dialogs. */
export const renewalFormSchema = {
  renewal_policy: z.enum(["auto", "review", "renegotiate", "none"]).default("none"),
  renewal_term_months: z.string().optional(),
  max_renewal_count: z.string().optional(),
  renewal_notice_days: z.string().optional(),
};

export interface RenewalFormValues {
  renewal_policy?: RenewalPolicy;
  renewal_term_months?: string;
  max_renewal_count?: string;
  renewal_notice_days?: string;
  expiry_date?: string;
}

/** Zod refinement: renewal settings need an expiry date and sensible numbers. */
export function checkRenewal(data: RenewalFormValues, ctx: z.RefinementCtx) {
  const intIn = (v: string | undefined, min: number, max: number) => !v || (/^\d+$/.test(v) && +v >= min && +v <= max);
  if (data.renewal_policy === "auto" && !data.expiry_date) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["expiry_date"], message: "Set an expiry date so it can renew" });
  }
  if (!intIn(data.renewal_term_months, 1, 120)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["renewal_term_months"], message: "1 to 120 months" });
  }
  if (!intIn(data.max_renewal_count, 1, 99)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["max_renewal_count"], message: "1 to 99, or leave empty for no limit" });
  }
  if (!intIn(data.renewal_notice_days, 0, 365)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["renewal_notice_days"], message: "0 to 365 days" });
  }
}

const orNull = (v?: string) => (v ? Number(v) : null);

/** Form values → contract columns. */
export function renewalPayload(data: RenewalFormValues) {
  const auto = data.renewal_policy === "auto";
  return {
    renewal_term_months: auto ? orNull(data.renewal_term_months) : null,
    max_renewal_count: auto ? orNull(data.max_renewal_count) : null,
    renewal_notice_days: data.renewal_notice_days ? Number(data.renewal_notice_days) : 30,
  };
}
