import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ShieldCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMfa } from '@/hooks/useMfa';

export default function MfaChallenge() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const mfa = useMfa();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [busy, setBusy] = useState(false);
  // Set while a recovery code is processed, so the redirect below does not race it.
  const recovering = useRef(false);

  useEffect(() => {
    supabase.auth.mfa.listFactors().then(({ data }) => {
      const verified = (data?.totp ?? []).find((f) => f.status === 'verified');
      if (verified) setFactorId(verified.id);
    });
  }, []);

  // If user is already AAL2 (or has no verified factor), bounce them out
  useEffect(() => {
    if (mfa.loading || recovering.current) return;
    if (mfa.currentLevel === 'aal2' || !mfa.hasVerifiedFactor) {
      navigate('/', { replace: true });
    }
  }, [mfa.loading, mfa.currentLevel, mfa.hasVerifiedFactor, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (recoveryMode) {
        recovering.current = true;
        // The server checks the code once and, if valid, removes the old
        // authenticator; a recovery code alone cannot complete the MFA step.
        const { data, error } = await supabase.functions.invoke<{ success: boolean; error?: string }>(
          'mfa-recovery',
          { body: { code } },
        );
        if (error || !data) {
          let message = 'Could not check the recovery code. Try again.';
          try {
            const body = await (error as { context?: Response } | null)?.context?.json();
            if (body?.error) message = body.error;
          } catch {
            // keep the generic message
          }
          throw new Error(message);
        }
        if (!data.success) throw new Error(data.error ?? 'That recovery code is wrong or has already been used.');

        // Pick up the removed authenticator so the app stops asking for a code.
        const { error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
          await supabase.auth.signOut();
          toast({
            title: 'Recovery code accepted',
            description: 'Sign in again, then set up your authenticator app.',
          });
          navigate('/auth', { replace: true });
          return;
        }
        toast({
          title: 'Recovery code accepted',
          description: 'Your old authenticator was removed. Set up a new one now.',
        });
        navigate('/account/mfa', { replace: true });
        return;
      }
      if (!factorId) throw new Error('No authenticator found.');
      const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
      if (chErr) throw chErr;
      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: ch.id,
        code: code.trim(),
      });
      if (vErr) throw vErr;
      mfa.refresh();
      navigate('/', { replace: true });
    } catch (e: any) {
      recovering.current = false;
      toast({ title: 'Verification failed', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate('/auth', { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <CardTitle>Two-Factor Authentication</CardTitle>
          </div>
          <CardDescription>
            {recoveryMode
              ? 'Enter one of your saved recovery codes.'
              : 'Enter the 6-digit code from your authenticator app to continue.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">{recoveryMode ? 'Recovery code' : 'Verification code'}</Label>
              <Input
                id="code"
                autoFocus
                autoComplete="one-time-code"
                inputMode={recoveryMode ? 'text' : 'numeric'}
                value={code}
                onChange={(e) => setCode(recoveryMode ? e.target.value.toUpperCase() : e.target.value.replace(/\D/g, ''))}
                maxLength={recoveryMode ? 11 : 6}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Verify
            </Button>
            <div className="flex justify-between text-sm">
              <button
                type="button"
                className="text-primary hover:underline"
                onClick={() => {
                  setRecoveryMode((v) => !v);
                  setCode('');
                }}
              >
                {recoveryMode ? 'Use authenticator app' : 'Use a recovery code'}
              </button>
              <button type="button" className="text-muted-foreground hover:underline" onClick={signOut}>
                Sign out
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
