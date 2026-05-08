import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import TurnstileWidget from "@/components/security/TurnstileWidget";
import { useTurnstileSiteKey } from "@/hooks/useTurnstileSiteKey";
import { useTurnstileEnabledFor } from "@/hooks/usePublicSecuritySettings";

export default function PortalLogin() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") || "/portal";
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const { data: turnstile } = useTurnstileSiteKey();
  const turnstileEnabled = useTurnstileEnabledFor('portal_login');

  useEffect(() => { if (user) navigate(next, { replace: true }); }, [user, next, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await signIn(email, password, captchaToken ?? undefined);
    setBusy(false);
    if (error) {
      setCaptchaToken(null);
      toast({ title: "Sign-in failed", description: error.message, variant: "destructive" });
      return;
    }
    navigate(next, { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/20 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Supplier Portal</CardTitle>
          <CardDescription>Sign in to manage your supplier account.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-3">
            <Input type="email" required placeholder="Email" value={email}
              onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            <Input type="password" required placeholder="Password" value={password}
              onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            {turnstileEnabled !== false && turnstile?.siteKey && (
              <div className="flex justify-center">
                <TurnstileWidget
                  siteKey={turnstile.siteKey}
                  action="portal_login"
                  onVerify={setCaptchaToken}
                  onExpire={() => setCaptchaToken(null)}
                  onError={() => setCaptchaToken(null)}
                />
              </div>
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={busy || (turnstileEnabled !== false && !!turnstile?.siteKey && !captchaToken)}
            >
              {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Sign in
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Have an invitation? <Link to={`/portal/accept-invite${window.location.search}`} className="underline">Accept invite</Link>
            </p>
            {turnstileEnabled !== false && turnstile?.siteKey && (
              <p className="text-[10px] text-muted-foreground text-center">
                Protected by Cloudflare Turnstile.
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
