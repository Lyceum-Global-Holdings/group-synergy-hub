import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useSecuritySettings, useUpdateSecuritySettings, useSecurityAuditLog,
  LOCKED_TURNSTILE_SURFACES,
  type MfaPolicy,
} from "@/hooks/useSecuritySettings";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, Bot, KeyRound, History, Loader2, Info, Lock } from "lucide-react";

const MFA_POLICIES: { value: MfaPolicy; label: string; help: string }[] = [
  { value: "disabled",        label: "Disabled",                 help: "MFA is hidden. Not recommended for production." },
  { value: "optional",        label: "Optional (user choice)",   help: "Users may self-enroll TOTP. Default." },
  { value: "required_admins", label: "Required for admins",      help: "NIST AAL2: privileged users must enroll." },
  { value: "required_all",    label: "Required for everyone",    help: "Strongest. Every user must enroll within the grace period." },
];

const SURFACES: {
  key: keyof Settings["turnstile_surfaces"];
  label: string;
  help: string;
  locked?: boolean;
  lockReason?: string;
}[] = [
  {
    key: "auth",
    label: "Internal sign-in (/auth)",
    help: "Bot challenge on the staff login page.",
    locked: true,
    lockReason: "Enforced by Supabase Auth — manage in the Supabase dashboard (Auth → Bot and Abuse Protection).",
  },
  {
    key: "portal_login",
    label: "Supplier portal sign-in",
    help: "Bot challenge on /portal/login.",
    locked: true,
    lockReason: "Enforced by Supabase Auth — manage in the Supabase dashboard (Auth → Bot and Abuse Protection).",
  },
  { key: "portal_invite",        label: "Supplier invite acceptance",   help: "Bot challenge when accepting supplier invitations." },
  { key: "public_registration",  label: "Public supplier registration", help: "Bot challenge on the unauthenticated supplier registration form." },
];

type Settings = NonNullable<ReturnType<typeof useSecuritySettings>["data"]>;

export default function SecuritySettings() {
  const { data: settings, isLoading } = useSecuritySettings();
  const update = useUpdateSecuritySettings();
  const audit = useSecurityAuditLog(50);
  const { toast } = useToast();
  const [confirmDisableTurnstile, setConfirmDisableTurnstile] = useState(false);
  const [pendingPolicy, setPendingPolicy] = useState<MfaPolicy | null>(null);
  const [grace, setGrace] = useState<string>("");
  const [remember, setRemember] = useState<string>("");

  if (isLoading || !settings) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const apply = async (patch: Partial<Settings>) => {
    try {
      await update.mutateAsync(patch as any);
      toast({ title: "Security settings updated" });
    } catch (e: any) {
      toast({ title: "Update failed", description: e.message ?? String(e), variant: "destructive" });
    }
  };

  const handleSurfaceToggle = (
    key: keyof Settings["turnstile_surfaces"],
    value: boolean,
  ) => {
    const surface = SURFACES.find((s) => s.key === key);
    if (surface?.locked || (LOCKED_TURNSTILE_SURFACES as readonly string[]).includes(key as string)) {
      toast({
        variant: "destructive",
        title: "Locked by Supabase Auth",
        description:
          surface?.lockReason ??
          "This surface is enforced by Supabase Auth and cannot be changed here.",
      });
      return;
    }
    apply({
      turnstile_surfaces: { ...settings.turnstile_surfaces, [key]: value },
    });
  };

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-5xl">
      <header className="flex items-center gap-3">
        <ShieldCheck className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Security Settings</h1>
          <p className="text-sm text-muted-foreground">
            Centrally control bot protection and multi-factor authentication.
            Aligned with NIST SP 800-63B (AAL2), ISO 27001 A.9.4.2, OWASP ASVS V2/V11, SOC 2 CC6.
          </p>
        </div>
      </header>

      <Tabs defaultValue="bot">
        <TabsList>
          <TabsTrigger value="bot"><Bot className="h-4 w-4 mr-2" />Bot Protection</TabsTrigger>
          <TabsTrigger value="mfa"><KeyRound className="h-4 w-4 mr-2" />MFA Policy</TabsTrigger>
          <TabsTrigger value="audit"><History className="h-4 w-4 mr-2" />Audit Log</TabsTrigger>
        </TabsList>

        {/* ---------- Bot Protection ---------- */}
        <TabsContent value="bot" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Cloudflare Turnstile
                <Badge variant={settings.turnstile_enabled ? "default" : "secondary"}>
                  {settings.turnstile_enabled ? "Enabled" : "Disabled"}
                </Badge>
              </CardTitle>
              <CardDescription>
                Privacy-friendly, GDPR-compliant bot challenge. Disabling this removes the protection from every surface (master kill switch).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 border rounded-md bg-muted/30">
                <div>
                  <Label className="text-base">Master switch</Label>
                  <p className="text-sm text-muted-foreground">When off, no Turnstile challenge is shown anywhere and edge functions skip verification.</p>
                </div>
                <Switch
                  checked={settings.turnstile_enabled}
                  onCheckedChange={(v) => {
                    if (!v) setConfirmDisableTurnstile(true);
                    else apply({ turnstile_enabled: true });
                  }}
                />
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold uppercase text-muted-foreground">Per-surface controls</h3>
                <Alert>
                  <Lock className="h-4 w-4" />
                  <AlertTitle>Some surfaces are managed by Supabase Auth</AlertTitle>
                  <AlertDescription>
                    Internal sign-in and Supplier portal sign-in use Supabase's built-in CAPTCHA. Their toggles below are read-only — change them in the Supabase dashboard (Auth → Bot and Abuse Protection).
                  </AlertDescription>
                </Alert>
                {SURFACES.map((s) => (
                  <div key={s.key} className="flex items-center justify-between p-3 border rounded-md">
                    <div className="pr-4">
                      <div className="flex items-center gap-2">
                        <Label>{s.label}</Label>
                        {s.locked && (
                          <Badge variant="secondary" className="text-[10px] gap-1">
                            <Lock className="h-3 w-3" /> Locked
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{s.help}</p>
                      {s.locked && (
                        <p className="text-xs text-muted-foreground mt-1 italic">{s.lockReason}</p>
                      )}
                    </div>
                    <Switch
                      disabled={!settings.turnstile_enabled || s.locked}
                      checked={s.locked ? true : settings.turnstile_surfaces[s.key] !== false}
                      onCheckedChange={(v) => handleSurfaceToggle(s.key, v)}
                    />
                  </div>
                ))}
              </div>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Reminder</AlertTitle>
                <AlertDescription>
                  Supabase's built-in CAPTCHA setting (Auth → Settings → Bot and Abuse Protection) is independent. To fully disable bot challenges on email/password sign-in you must also turn it off there.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------- MFA ---------- */}
        <TabsContent value="mfa" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Multi-Factor Authentication
                <Badge>{MFA_POLICIES.find((p) => p.value === settings.mfa_policy)?.label}</Badge>
              </CardTitle>
              <CardDescription>
                TOTP-based MFA per RFC 6238. Step-up assurance for privileged actions follows NIST SP 800-63B AAL2.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Enforcement policy</Label>
                <Select
                  value={settings.mfa_policy}
                  onValueChange={(v) => {
                    const next = v as MfaPolicy;
                    if (next === "required_all" && settings.mfa_policy !== "required_all") {
                      setPendingPolicy(next);
                    } else {
                      apply({ mfa_policy: next });
                    }
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MFA_POLICIES.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        <div>
                          <div className="font-medium">{p.label}</div>
                          <div className="text-xs text-muted-foreground">{p.help}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Grace period (days)</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number" min={0} max={90}
                      defaultValue={settings.mfa_grace_period_days}
                      onChange={(e) => setGrace(e.target.value)}
                    />
                    <Button
                      variant="outline"
                      onClick={() => grace !== "" && apply({ mfa_grace_period_days: Math.max(0, Math.min(90, Number(grace))) })}
                    >Save</Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Days after enforcement before unenrolled users are blocked. 0 = immediate.</p>
                </div>
                <div className="space-y-2">
                  <Label>Remember device (hours)</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number" min={0} max={720}
                      defaultValue={settings.mfa_remember_device_hours}
                      onChange={(e) => setRemember(e.target.value)}
                    />
                    <Button
                      variant="outline"
                      onClick={() => remember !== "" && apply({ mfa_remember_device_hours: Math.max(0, Math.min(720, Number(remember))) })}
                    >Save</Button>
                  </div>
                  <p className="text-xs text-muted-foreground">0 = challenge every session (NIST AAL2 default). Max 720h (30 days).</p>
                </div>
              </div>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Allowed factor types</AlertTitle>
                <AlertDescription>
                  TOTP (RFC 6238) is enabled. WebAuthn / passkeys is reserved for a future release.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------- Audit ---------- */}
        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent changes</CardTitle>
              <CardDescription>SOC 2 evidence trail. Last 50 changes to security settings.</CardDescription>
            </CardHeader>
            <CardContent>
              {audit.isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : !audit.data?.length ? (
                <p className="text-sm text-muted-foreground">No changes recorded yet.</p>
              ) : (
                <div className="space-y-2 max-h-[60vh] overflow-auto">
                  {audit.data.map((row) => (
                    <div key={row.id} className="text-xs border rounded p-2 font-mono">
                      <div className="flex justify-between mb-1">
                        <span className="font-semibold">{row.action}</span>
                        <span className="text-muted-foreground">{new Date(row.changed_at).toLocaleString()}</span>
                      </div>
                      <div className="text-muted-foreground">by {row.changed_by ?? "system"}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Confirmation dialogs */}
      <AlertDialog open={confirmDisableTurnstile} onOpenChange={setConfirmDisableTurnstile}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable bot protection?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes Cloudflare Turnstile from every public-facing surface. Brute-force and credential-stuffing risk will increase. Recommended only for short maintenance windows.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => apply({ turnstile_enabled: false })}>
              Disable
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!pendingPolicy} onOpenChange={(o) => !o && setPendingPolicy(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Require MFA for everyone?</AlertDialogTitle>
            <AlertDialogDescription>
              All users without a verified TOTP factor will be redirected to enroll after the grace period. Make sure users have been notified.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (pendingPolicy) apply({ mfa_policy: pendingPolicy }); setPendingPolicy(null); }}>
              Apply
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
