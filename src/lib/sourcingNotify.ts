import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type NotifyBody =
  | { event: "registration_decision"; registration_id: string }
  | { event: "rfq_published"; request_id: string };

export interface NotifyResult {
  sent: number;
  failed?: string[];
  error?: string;
}

/**
 * Sends a sourcing email through the sourcing-notify edge function. Never
 * throws: the business step already succeeded, so a mail problem is reported
 * as a warning instead of undoing anything.
 */
export async function notifySourcing(body: NotifyBody): Promise<NotifyResult | null> {
  const { data, error } = await supabase.functions.invoke<NotifyResult & { success: boolean }>("sourcing-notify", { body });
  if (error || !data?.success) {
    console.warn("sourcing-notify failed", error ?? data);
    return null;
  }
  return data;
}

/** Emails the applicant about an approval or rejection and says whether it went. */
export async function notifyRegistrationDecision(registrationId: string) {
  const result = await notifySourcing({ event: "registration_decision", registration_id: registrationId });
  if (result?.sent) toast.success("The applicant has been emailed");
  else toast.warning("The applicant couldn't be emailed", {
    description: result?.error ?? "Check the email settings, or contact them directly.",
  });
}
