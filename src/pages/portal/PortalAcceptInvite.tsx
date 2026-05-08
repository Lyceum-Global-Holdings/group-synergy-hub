import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSupplierContext } from "@/contexts/SupplierContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import TurnstileWidget from "@/components/security/TurnstileWidget";
import { useTurnstileSiteKey } from "@/hooks/useTurnstileSiteKey";
import { useTurnstileEnabledFor } from "@/hooks/usePublicSecuritySettings";

export default function PortalAcceptInvite() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const { refresh } = useSupplierContext();
  const { data: turnstile } = useTurnstileSiteKey();
  const turnstileEnabled = useTurnstileEnabledFor('portal_invite');

  const tokenFromUrl = params.get("token") ?? "";
  const idFromUrl = params.get("id") ?? "";
  const [token, setToken] = useState(tokenFromUrl);
  const [invitationId, setInvitationId] = useState(idFromUrl);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  useEffect(() => { setToken(tokenFromUrl); setInvitationId(idFromUrl); }, [tokenFromUrl, idFromUrl]);

  const accept = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!user) {
      navigate(`/portal/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }
    if (user && !captchaToken) {
      toast({ title: "Bot check required", description: "Please complete the challenge.", variant: "destructive" });
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("supplier-accept-invite", {
      body: { invitation_id: invitationId, token, turnstile_token: captchaToken },
    });
    setBusy(false);
    if (error || (data && (data as any).error)) {
      const msg = (data as any)?.error || error?.message || "Failed to accept invitation";
      setCaptchaToken(null);
      toast({ title: "Could not accept invitation", description: String(msg), variant: "destructive" });
      return;
    }
    await refresh();
    setDone(true);
    toast({ title: "Welcome aboard", description: "Invitation accepted." });
    setTimeout(() => navigate("/portal", { replace: true }), 800);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/20 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Accept Supplier Invitation</CardTitle>
          <CardDescription>
            {user
              ? `Signed in as ${user.email}. Confirm to join the supplier portal.`
              : "You must sign in with the email the invitation was sent to."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {done ? (
            <p className="text-sm">Redirecting…</p>
          ) : (
            <form onSubmit={accept} className="space-y-3">
              <Input placeholder="Invitation ID" value={invitationId}
                onChange={(e) => setInvitationId(e.target.value)} required />
              <Input placeholder="Token" value={token}
                onChange={(e) => setToken(e.target.value)} required />
              {user && turnstileEnabled && turnstile?.siteKey && (
                <div className="flex justify-center">
                  <TurnstileWidget
                    siteKey={turnstile.siteKey}
                    action="supplier_accept_invite"
                    onVerify={setCaptchaToken}
                    onExpire={() => setCaptchaToken(null)}
                    onError={() => setCaptchaToken(null)}
                  />
                </div>
              )}
              <Button type="submit" className="w-full" disabled={busy || authLoading || (!!user && turnstileEnabled && !captchaToken)}>
                {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {user ? "Accept invitation" : "Sign in to continue"}
              </Button>
              {!user && (
                <p className="text-xs text-muted-foreground text-center">
                  <Link to={`/portal/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`} className="underline">
                    Go to sign in
                  </Link>
                </p>
              )}
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
