import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSupplierContext } from "@/contexts/SupplierContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import TurnstileWidget from "@/components/security/TurnstileWidget";
import { useTurnstileSiteKey } from "@/hooks/useTurnstileSiteKey";
import { useTurnstileEnabledFor } from "@/hooks/usePublicSecuritySettings";

type AcceptResponse = { success?: boolean; error?: string; code?: string; email?: string };

/** Reads the JSON error body of a failed function call, if there is one. */
async function errorMessage(data: AcceptResponse | null, error: unknown, fallback: string) {
  if (data?.error) return data.error;
  try {
    const body = await (error as { context?: Response } | null)?.context?.json();
    if (body?.error) return String(body.error);
  } catch {
    // no JSON body
  }
  return fallback;
}

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
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  useEffect(() => { setToken(tokenFromUrl); setInvitationId(idFromUrl); }, [tokenFromUrl, idFromUrl]);

  const signInPath = `/portal/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
  const linkComplete = !!tokenFromUrl && !!idFromUrl;
  const needsCaptcha = turnstileEnabled && !!turnstile?.siteKey;

  const finish = async () => {
    await refresh();
    setDone(true);
    toast({ title: "Welcome aboard", description: "Invitation accepted." });
    setTimeout(() => navigate("/portal", { replace: true }), 800);
  };

  // Signed in: join the supplier with this account.
  const accept = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (needsCaptcha && !captchaToken) {
      toast({ title: "Bot check required", description: "Please complete the challenge.", variant: "destructive" });
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.functions.invoke<AcceptResponse>("supplier-accept-invite", {
      body: { invitation_id: invitationId, token, turnstile_token: captchaToken ?? undefined },
    });
    setBusy(false);
    if (error || !data?.success) {
      setCaptchaToken(null);
      toast({
        title: "Could not accept invitation",
        description: await errorMessage(data, error, "Failed to accept invitation"),
        variant: "destructive",
      });
      return;
    }
    await finish();
  };

  // New to the portal: create the login from the invitation, then sign in.
  const createAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast({ title: "Password too short", description: "Use at least 8 characters.", variant: "destructive" });
      return;
    }
    if (password !== confirm) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    if (needsCaptcha && !captchaToken) {
      toast({ title: "Bot check required", description: "Please complete the challenge.", variant: "destructive" });
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.functions.invoke<AcceptResponse>("supplier-accept-invite", {
      body: {
        invitation_id: invitationId,
        token,
        turnstile_token: captchaToken ?? undefined,
        password,
        full_name: fullName || undefined,
      },
    });
    if (error || !data?.success || !data.email) {
      setBusy(false);
      setCaptchaToken(null);
      const message = await errorMessage(data, error, "Could not create your account");
      toast({ title: "Could not create your account", description: message, variant: "destructive" });
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email: data.email, password });
    setBusy(false);
    if (signInError) {
      // e.g. sign-in needs its own bot check: the account and membership exist.
      toast({ title: "Account created", description: "Sign in to open the supplier portal." });
      navigate(`/portal/login?next=${encodeURIComponent("/portal")}`, { replace: true });
      return;
    }
    await finish();
  };

  const linkFields = !linkComplete && (
    <>
      <Input placeholder="Invitation ID" value={invitationId}
        onChange={(e) => setInvitationId(e.target.value)} required />
      <Input placeholder="Token" value={token}
        onChange={(e) => setToken(e.target.value)} required />
    </>
  );

  const captcha = needsCaptcha && (
    <div className="flex justify-center">
      <TurnstileWidget
        siteKey={turnstile!.siteKey}
        action="supplier_accept_invite"
        onVerify={setCaptchaToken}
        onExpire={() => setCaptchaToken(null)}
        onError={() => setCaptchaToken(null)}
      />
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/20 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Accept Supplier Invitation</CardTitle>
          <CardDescription>
            {user
              ? `Signed in as ${user.email}. Confirm to join the supplier portal.`
              : "Set a password to create your supplier portal account, or sign in if you already have one."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {done ? (
            <p className="text-sm">Redirecting…</p>
          ) : user ? (
            <form onSubmit={accept} className="space-y-3">
              {linkFields}
              {captcha}
              <Button type="submit" className="w-full" disabled={busy || authLoading || (needsCaptcha && !captchaToken)}>
                {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Accept invitation
              </Button>
            </form>
          ) : (
            <form onSubmit={createAccount} className="space-y-3">
              {linkFields}
              <div className="space-y-1.5">
                <Label htmlFor="invite-name">Your name</Label>
                <Input id="invite-name" autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="invite-password">Password</Label>
                <Input id="invite-password" type="password" autoComplete="new-password" placeholder="At least 8 characters"
                  value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="invite-confirm">Confirm password</Label>
                <Input id="invite-confirm" type="password" autoComplete="new-password"
                  value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} />
              </div>
              {captcha}
              <Button type="submit" className="w-full" disabled={busy || authLoading || (needsCaptcha && !captchaToken)}>
                {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create account and join
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Already have an account?{" "}
                <Link to={signInPath} className="underline">Sign in</Link>, then open this link again.
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
