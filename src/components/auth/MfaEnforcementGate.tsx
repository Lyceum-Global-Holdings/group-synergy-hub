import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSecuritySettings } from "@/hooks/useSecuritySettings";
import { useCurrentUserRoles } from "@/hooks/useCurrentUserRoles";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ShieldAlert, X } from "lucide-react";

const PRIVILEGED_ROLES = new Set(["admin", "super_admin", "moderator"]);
const EXEMPT_PATH_PREFIXES = ["/auth", "/portal", "/public-supplier-registration"];

/**
 * Enforces the MFA policy from `security_settings`:
 *   required_admins → admin/super_admin/moderator must enroll TOTP
 *   required_all    → every signed-in user must enroll TOTP
 *
 * Within the configured grace period a dismissible banner is shown; after the
 * grace period unenrolled users are hard-redirected to /account/mfa and
 * blocked from the rest of the app.
 *
 * Aligned with NIST SP 800-63B AAL2 and ISO 27001 A.9.4.2.
 */
export default function MfaEnforcementGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { data: settings } = useSecuritySettings();
  const { data: roles = [] } = useCurrentUserRoles();
  const navigate = useNavigate();
  const location = useLocation();
  const [hasFactor, setHasFactor] = useState<boolean | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const policy = settings?.mfa_policy ?? "optional";
  const grace = settings?.mfa_grace_period_days ?? 7;

  const isPrivileged = roles.some((r: any) => PRIVILEGED_ROLES.has(r.role));
  const inScope =
    policy === "required_all" ||
    (policy === "required_admins" && isPrivileged);

  useEffect(() => {
    let cancelled = false;
    if (!user || !inScope) {
      setHasFactor(null);
      return;
    }
    supabase.auth.mfa.listFactors().then(({ data }) => {
      if (cancelled) return;
      const verified = (data?.totp ?? []).some((f: any) => f.status === "verified");
      setHasFactor(verified);
    }).catch(() => setHasFactor(true)); // fail-open to avoid lockout on transient errors
    return () => { cancelled = true; };
  }, [user?.id, inScope]);

  const exempt = EXEMPT_PATH_PREFIXES.some((p) => location.pathname.startsWith(p));

  // Compute whether the grace period has expired since the user account was created.
  const created = user?.created_at ? new Date(user.created_at).getTime() : Date.now();
  const elapsedDays = (Date.now() - created) / (1000 * 60 * 60 * 24);
  const graceExpired = elapsedDays > grace;

  useEffect(() => {
    if (!user || !inScope || hasFactor !== false || exempt) return;
    if (!graceExpired) return;
    navigate("/account/mfa", { replace: true });
  }, [user?.id, inScope, hasFactor, exempt, graceExpired, navigate]);

  const showBanner = !!user && inScope && hasFactor === false && !exempt && !graceExpired && !dismissed;

  return (
    <>
      {showBanner && (
        <div className="px-4 pt-3">
          <Alert className="border-warning/40 bg-warning/10">
            <ShieldAlert className="h-4 w-4 text-warning" />
            <AlertTitle className="flex items-center justify-between">
              <span>Two-factor authentication required</span>
              <Button variant="ghost" size="sm" onClick={() => setDismissed(true)} aria-label="Dismiss">
                <X className="h-4 w-4" />
              </Button>
            </AlertTitle>
            <AlertDescription className="flex items-center justify-between gap-4">
              <span>
                Your administrator requires MFA on your account. Please enroll within {Math.max(0, Math.ceil(grace - elapsedDays))} day(s) to avoid losing access.
              </span>
              <Button size="sm" onClick={() => navigate("/account/mfa")}>
                Set up now
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      )}
      {children}
    </>
  );
}
