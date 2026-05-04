import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ShieldCheck, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMfa } from '@/hooks/useMfa';
import { RecoveryCodesDisplay } from '@/components/auth/RecoveryCodesDisplay';

type Step = 'list' | 'enroll' | 'verify' | 'recovery';

export default function MfaSetup() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const mfa = useMfa();

  const [step, setStep] = useState<Step>('list');
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);

  useEffect(() => {
    if (!mfa.loading && mfa.hasVerifiedFactor) setStep('list');
  }, [mfa.loading, mfa.hasVerifiedFactor]);

  const startEnrollment = async () => {
    setBusy(true);
    try {
      // Sweep ALL stale (unverified) factors — Supabase enforces unique friendlyName per user
      // across every factor, not just the totp[] array. listFactors().all covers them all.
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const all = (factors as any)?.all ?? factors?.totp ?? [];
      for (const f of all) {
        if (f.status !== 'verified') {
          await supabase.auth.mfa.unenroll({ factorId: f.id });
        }
      }

      const makeName = () =>
        `Authenticator ${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

      let enrollResult = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: makeName(),
      });
      // Defensive retry once on name conflict (race with another tab / stale session cache).
      if (enrollResult.error && /friendly.?name|already exists/i.test(enrollResult.error.message)) {
        enrollResult = await supabase.auth.mfa.enroll({
          factorType: 'totp',
          friendlyName: makeName(),
        });
      }
      const { data, error } = enrollResult;
      if (error) throw error;
      setFactorId(data.id);
      setSecret(data.totp.secret);
      const qr = await QRCode.toDataURL(data.totp.uri, { margin: 1, width: 220 });
      setQrDataUrl(qr);
      setStep('verify');
    } catch (e: any) {
      toast({ title: 'Could not start MFA setup', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const verifyEnrollment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factorId) return;
    setBusy(true);
    try {
      const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
      if (chErr) throw chErr;
      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: ch.id,
        code: code.trim(),
      });
      if (vErr) throw vErr;

      // Now AAL2 — generate recovery codes
      const { data: codes, error: rcErr } = await supabase.rpc('generate_mfa_recovery_codes');
      if (rcErr) throw rcErr;
      setRecoveryCodes(codes as unknown as string[]);
      setStep('recovery');
      mfa.refresh();
      toast({ title: 'MFA enabled', description: 'Two-factor authentication is now active.' });
    } catch (e: any) {
      toast({ title: 'Verification failed', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const removeFactor = async (id: string) => {
    if (!confirm('Remove this authenticator? You will need to re-enroll to keep MFA active.')) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
      if (error) throw error;
      toast({ title: 'Authenticator removed' });
      mfa.refresh();
    } catch (e: any) {
      toast({ title: 'Could not remove', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const regenerateCodes = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('generate_mfa_recovery_codes');
      if (error) throw error;
      setRecoveryCodes(data as unknown as string[]);
      setStep('recovery');
    } catch (e: any) {
      toast({ title: 'Could not regenerate', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <CardTitle>Two-Factor Authentication</CardTitle>
          </div>
          <CardDescription>
            Protect your account with a time-based one-time password (TOTP) following NIST SP 800-63B (AAL2). Use any
            standards-compliant authenticator: Google Authenticator, Microsoft Authenticator, 1Password, Authy.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {mfa.loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : step === 'list' ? (
            <div className="space-y-4">
              <FactorsList onRemove={removeFactor} busy={busy} />
              <div className="flex flex-wrap gap-2">
                {!mfa.hasVerifiedFactor ? (
                  <Button onClick={startEnrollment} disabled={busy}>
                    {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Enable two-factor authentication
                  </Button>
                ) : (
                  <Button variant="outline" onClick={regenerateCodes} disabled={busy}>
                    Regenerate recovery codes
                  </Button>
                )}
                <Button variant="ghost" onClick={() => navigate('/')}>Back</Button>
              </div>
            </div>
          ) : step === 'verify' ? (
            <form onSubmit={verifyEnrollment} className="space-y-4">
              <div className="grid sm:grid-cols-[220px_1fr] gap-4 items-start">
                {qrDataUrl && (
                  <img
                    src={qrDataUrl}
                    alt="Scan with authenticator app"
                    className="rounded border bg-card p-2"
                  />
                )}
                <div className="space-y-2 text-sm">
                  <p className="font-medium">1. Scan the QR code with your authenticator app.</p>
                  <p>Or enter this secret manually:</p>
                  <code className="block break-all rounded bg-muted px-2 py-1 font-mono text-xs">{secret}</code>
                  <p className="font-medium pt-2">2. Enter the 6-digit code shown in the app:</p>
                </div>
              </div>
              <div className="space-y-2 max-w-xs">
                <Label htmlFor="code">Verification code</Label>
                <Input
                  id="code"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  required
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={busy || code.length !== 6}>
                  {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Verify and activate
                </Button>
                <Button type="button" variant="ghost" onClick={() => setStep('list')}>
                  Cancel
                </Button>
              </div>
            </form>
          ) : step === 'recovery' && recoveryCodes ? (
            <RecoveryCodesDisplay codes={recoveryCodes} onContinue={() => setStep('list')} />
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function FactorsList({ onRemove, busy }: { onRemove: (id: string) => void; busy: boolean }) {
  const [factors, setFactors] = useState<{ id: string; friendly_name?: string; status: string }[]>([]);
  useEffect(() => {
    supabase.auth.mfa.listFactors().then(({ data }) => {
      setFactors((data?.totp ?? []) as any);
    });
  }, [busy]);

  if (factors.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No authenticator app is registered. Enable two-factor authentication for stronger protection.
      </p>
    );
  }
  return (
    <ul className="divide-y rounded-md border">
      {factors.map((f) => (
        <li key={f.id} className="flex items-center justify-between p-3">
          <div>
            <p className="text-sm font-medium">{f.friendly_name || 'Authenticator'}</p>
            <p className="text-xs text-muted-foreground capitalize">{f.status}</p>
          </div>
          <Button size="sm" variant="ghost" onClick={() => onRemove(f.id)} disabled={busy}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </li>
      ))}
    </ul>
  );
}
