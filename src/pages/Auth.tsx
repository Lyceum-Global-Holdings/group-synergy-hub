import { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2, Eye, EyeOff, ArrowLeft, MailCheck, ShieldAlert,
  Check, Package, FileCheck2,
} from 'lucide-react';
import TurnstileWidget from '@/components/security/TurnstileWidget';
import { useTurnstileSiteKey } from '@/hooks/useTurnstileSiteKey';
import { useTurnstileEnabledFor } from '@/hooks/usePublicSecuritySettings';
import { isScannerShell, SCANNER_BASENAME } from '@/lib/scannerShell';
import { cn } from '@/lib/utils';

// signin: email + password · forgot: request a reset link ·
// reset: set a new password after following the emailed link (/auth?reset=true)
type Mode = 'signin' | 'forgot' | 'reset';

const MIN_PASSWORD_LENGTH = 8;

// Filled, borderless fields that lift to the surface colour on focus.
const fieldClass =
  'h-12 rounded-xl border-transparent bg-muted/70 px-4 text-[15px] shadow-none ' +
  'placeholder:text-muted-foreground/70 focus-visible:border-primary/40 ' +
  'focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-primary/15 ' +
  'focus-visible:ring-offset-0';

// Fine film grain for the brand panel.
const NOISE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E" +
  "%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' " +
  "stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

const BARS = [38, 55, 44, 68, 52, 76, 61, 88];

function BrandLockup() {
  return (
    <div className="flex items-center justify-center gap-3">
      <img
        src="/pwa-192x192.png"
        alt=""
        className="h-11 w-11 rounded-xl shadow-md shadow-primary/30"
      />
      <div className="text-left leading-tight">
        <div className="text-[15px] font-bold text-foreground">Lyceum Global Holdings</div>
        <div className="text-xs text-muted-foreground">Enterprise Management System</div>
      </div>
    </div>
  );
}

// Decorative dashboard preview — skeleton shapes rather than figures, so it
// never reads as real data.
function DashboardPreview() {
  return (
    <div aria-hidden className="relative mt-auto h-[330px] select-none">
      <div className="absolute inset-x-0 bottom-0 rounded-2xl border border-white/20 bg-white/10 p-5 shadow-2xl shadow-black/20 backdrop-blur-md">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-white/40" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/30" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
        </div>
        <div className="mt-4 flex items-end justify-between">
          <div>
            <div className="text-xs text-white/70">Stock value</div>
            <div className="mt-2 h-2.5 w-24 rounded-full bg-white/70" />
          </div>
          <span className="rounded-full bg-emerald-400/20 px-2.5 py-1 text-[11px] font-medium text-emerald-100">
            ▲ Trending up
          </span>
        </div>
        <div className="mt-5 flex h-24 items-end gap-2">
          {BARS.map((h, i) => (
            <div
              key={i}
              className={cn('flex-1 rounded-t-md', i === BARS.length - 1 ? 'bg-white/85' : 'bg-white/25')}
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      </div>

      <div className="absolute right-3 top-0 w-52 rotate-[3deg] rounded-2xl bg-white p-4 text-slate-800 shadow-xl shadow-black/25">
        <div className="flex items-center gap-2 text-xs font-semibold">
          <FileCheck2 className="h-4 w-4 text-blue-600" /> Approvals
        </div>
        <div className="mt-3 space-y-2.5">
          {[80, 64, 72].map((w, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500">
                <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
              </span>
              <span className="h-2 rounded-full bg-slate-200" style={{ width: `${w}%` }} />
            </div>
          ))}
        </div>
      </div>

      <div className="absolute left-4 top-10 flex -rotate-2 items-center gap-2 rounded-full bg-white/95 px-3.5 py-2 text-xs font-medium text-slate-700 shadow-lg shadow-black/20">
        <Package className="h-3.5 w-3.5 text-blue-600" /> GRN received
      </div>
    </div>
  );
}

function ShowcasePanel() {
  return (
    <aside className="relative hidden overflow-hidden rounded-[22px] bg-[linear-gradient(145deg,hsl(213_94%_46%)_0%,hsl(216_90%_38%)_45%,hsl(224_85%_26%)_100%)] p-10 text-white lg:flex lg:flex-col">
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.16] mix-blend-overlay" style={{ backgroundImage: NOISE }} />
      <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-sky-300/30 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-indigo-400/30 blur-3xl" />

      <div className="relative">
        <h2 className="text-[2.5rem] font-bold leading-[1.15] tracking-tight">
          Simplify management with{' '}
          <span className="relative inline-block whitespace-nowrap">
            one dashboard.
            <svg
              aria-hidden
              viewBox="0 0 240 14"
              preserveAspectRatio="none"
              className="absolute -bottom-3 left-0 h-3 w-full"
            >
              <path d="M3 10 C 60 2, 150 2, 237 7" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" opacity="0.9" />
            </svg>
          </span>
        </h2>
        <p className="mt-7 max-w-sm text-[15px] leading-relaxed text-white/80">
          Procurement, warehouse, sales and finance for every Lyceum Global
          company — in one place.
        </p>
      </div>

      <DashboardPreview />
    </aside>
  );
}

export default function Auth() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [mode, setMode] = useState<Mode>(() =>
    searchParams.get('reset') === 'true' ? 'reset' : 'signin',
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const { data: turnstile } = useTurnstileSiteKey();
  const turnstileEnabled = useTurnstileEnabledFor('auth');
  const { signIn, resetPassword, updatePassword, user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const captchaActive = turnstileEnabled !== false && !!turnstile?.siteKey;
  const captchaPending = captchaActive && !captchaToken;

  // Get redirect URL from query params (for QR code transfer flow)
  const redirectUrl = searchParams.get('redirect');
  const action = searchParams.get('action');

  const resolvePostLoginPath = () => {
    const scanner = isScannerShell();

    if (redirectUrl) {
      try {
        const parsed = new URL(redirectUrl, window.location.origin);
        if (parsed.origin !== window.location.origin) return '/';

        let path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
        if (action) {
          parsed.searchParams.set('action', action);
          path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
        }

        if (scanner && parsed.pathname.startsWith(SCANNER_BASENAME)) {
          return `${parsed.pathname.slice(SCANNER_BASENAME.length) || '/'}${parsed.search}${parsed.hash}`;
        }
        if (!scanner && parsed.pathname.startsWith(SCANNER_BASENAME)) {
          return '/';
        }
        return path.startsWith('/') ? path : '/';
      } catch {
        return '/';
      }
    }

    let from: string = location.state?.from?.pathname || '/';
    if (scanner && from.startsWith(SCANNER_BASENAME)) {
      from = from.slice(SCANNER_BASENAME.length) || '/';
    }
    if (!scanner && from.startsWith(SCANNER_BASENAME)) {
      from = '/';
    }
    return from.startsWith('/') ? from : '/';
  };

  // Redirect if already authenticated. Not in reset mode: following the
  // emailed recovery link signs the user in, and they must be able to set
  // their new password before being sent on.
  useEffect(() => {
    if (user && mode !== 'reset') {
      navigate(resolvePostLoginPath(), { replace: true });
    }
  }, [user, mode, navigate, location, redirectUrl, action]);

  const switchMode = (next: Mode) => {
    setMode(next);
    setCaptchaToken(null);
    setResetSent(false);
    setShowPassword(false);
    if (next !== 'reset' && searchParams.has('reset')) {
      const params = new URLSearchParams(searchParams);
      params.delete('reset');
      setSearchParams(params, { replace: true });
    }
  };

  const getErrorMessage = (error: any) => {
    const message = error?.message || '';
    if (message.includes('Invalid login credentials')) {
      return 'Invalid email or password. Please check your credentials and try again.';
    }
    if (/rate limit/i.test(message)) {
      return 'Too many attempts — please wait a few minutes and try again.';
    }
    return message || 'An unexpected error occurred. Please try again.';
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { error } = await signIn(email, password, captchaToken ?? undefined);
      if (error) {
        console.error('Sign in error:', error);
        toast({
          title: "Sign in failed",
          description: getErrorMessage(error),
          variant: "destructive"
        });
        setCaptchaToken(null);
      } else {
        toast({
          title: "Welcome back!",
          description: "You have successfully signed in."
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { error } = await resetPassword(email.trim(), captchaToken ?? undefined);
      if (error) {
        toast({
          title: 'Could not send reset link',
          description: getErrorMessage(error),
          variant: 'destructive',
        });
        setCaptchaToken(null);
        return;
      }
      // Same confirmation whether or not the address has an account, so the
      // form can't be used to probe which emails are registered.
      setResetSent(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      toast({
        title: 'Password too short',
        description: `Use at least ${MIN_PASSWORD_LENGTH} characters.`,
        variant: 'destructive',
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords don't match", description: 'Re-enter the same password in both fields.', variant: 'destructive' });
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await updatePassword(newPassword);
      if (error) {
        toast({ title: 'Could not update password', description: getErrorMessage(error), variant: 'destructive' });
        return;
      }
      toast({ title: 'Password updated', description: "You're signed in with your new password." });
      switchMode('signin'); // already signed in, so the redirect effect takes over
    } finally {
      setIsLoading(false);
    }
  };

  const captchaBlock = captchaActive && (
    <div className="flex justify-center">
      <TurnstileWidget
        key={mode}
        siteKey={turnstile!.siteKey}
        action={mode === 'forgot' ? 'reset_password' : 'login'}
        onVerify={setCaptchaToken}
        onExpire={() => setCaptchaToken(null)}
        onError={() => setCaptchaToken(null)}
      />
    </div>
  );

  const primaryButtonClass =
    'h-12 w-full rounded-xl text-[15px] font-semibold shadow-lg shadow-primary/25';

  const backToSignIn = (
    <button
      type="button"
      onClick={() => switchMode('signin')}
      className="mx-auto flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
    >
      <ArrowLeft className="h-4 w-4" /> Back to sign in
    </button>
  );

  const renderSignIn = () => (
    <>
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Welcome Back</h1>
        <p className="mt-2 text-sm text-muted-foreground">Please sign in to your account</p>
      </div>

      <form onSubmit={handleSignIn} className="mt-8 space-y-4">
        <div>
          <Label htmlFor="email" className="sr-only">Email address</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={fieldClass}
            required
          />
        </div>
        <div>
          <Label htmlFor="password" className="sr-only">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={cn(fieldClass, 'pr-12')}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={() => switchMode('forgot')}
              className="text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
            >
              Forgot password?
            </button>
          </div>
        </div>

        {captchaBlock}

        <Button type="submit" className={primaryButtonClass} disabled={isLoading || captchaPending}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Sign In
        </Button>
      </form>
    </>
  );

  const renderForgot = () =>
    resetSent ? (
      <div className="text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
          <MailCheck className="h-7 w-7 text-primary" />
        </div>
        <h1 className="mt-5 text-2xl font-bold tracking-tight text-foreground">Check your inbox</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          If an account exists for <span className="font-medium text-foreground">{email.trim()}</span>,
          a password reset link is on its way. The link expires after a short time.
        </p>
        <div className="mt-8">{backToSignIn}</div>
      </div>
    ) : (
      <>
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Reset password</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter your account email and we'll send you a reset link
          </p>
        </div>
        <form onSubmit={handleForgot} className="mt-8 space-y-4">
          <div>
            <Label htmlFor="reset-email" className="sr-only">Email address</Label>
            <Input
              id="reset-email"
              type="email"
              autoComplete="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={fieldClass}
              required
              autoFocus
            />
          </div>
          {captchaBlock}
          <Button type="submit" className={primaryButtonClass} disabled={isLoading || captchaPending}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send reset link
          </Button>
        </form>
        <div className="mt-6">{backToSignIn}</div>
      </>
    );

  const renderReset = () => {
    if (loading) {
      return (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      );
    }
    // No recovery session: the link was already used, expired, or tampered with.
    if (!user) {
      return (
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10">
            <ShieldAlert className="h-7 w-7 text-destructive" />
          </div>
          <h1 className="mt-5 text-2xl font-bold tracking-tight text-foreground">Link expired</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            This password reset link is invalid or has already been used. Request a new one to continue.
          </p>
          <Button className={cn(primaryButtonClass, 'mt-8')} onClick={() => switchMode('forgot')}>
            Request a new link
          </Button>
          <div className="mt-6">{backToSignIn}</div>
        </div>
      );
    }
    return (
      <>
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Set a new password</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            For <span className="font-medium text-foreground">{user.email}</span>
          </p>
        </div>
        <form onSubmit={handleReset} className="mt-8 space-y-4">
          <div>
            <Label htmlFor="new-password" className="sr-only">New password</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder={`New password (min. ${MIN_PASSWORD_LENGTH} characters)`}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={cn(fieldClass, 'pr-12')}
                required
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div>
            <Label htmlFor="confirm-password" className="sr-only">Confirm new password</Label>
            <Input
              id="confirm-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={fieldClass}
              required
            />
          </div>
          <Button type="submit" className={primaryButtonClass} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Update password
          </Button>
        </form>
      </>
    );
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4 sm:p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_40rem_at_20%_-10%,hsl(var(--primary)/0.10),transparent_60%),radial-gradient(50rem_35rem_at_110%_110%,hsl(var(--info)/0.10),transparent_60%)]"
      />

      <div className="relative grid w-full max-w-5xl gap-4 rounded-[28px] bg-card p-3 shadow-2xl shadow-primary/10 ring-1 ring-border/60 sm:p-4 lg:min-h-[640px] lg:grid-cols-2">
        <ShowcasePanel />

        <main className="flex items-center justify-center px-3 py-10 sm:px-10">
          <div className="w-full max-w-sm">
            <BrandLockup />
            <div className="mt-8">
              {mode === 'signin' && renderSignIn()}
              {mode === 'forgot' && renderForgot()}
              {mode === 'reset' && renderReset()}
            </div>

            {mode === 'signin' && (
              <div className="mt-8 space-y-3 text-center">
                <p className="text-sm text-muted-foreground">
                  Don't have an account?{' '}
                  <span className="font-medium text-foreground">Contact your administrator</span>
                </p>
                {captchaActive && (
                  <p className="text-[11px] text-muted-foreground/80">
                    Protected by Cloudflare Turnstile — no personal data is collected.
                  </p>
                )}
                <p className="text-[11px] text-muted-foreground/80">
                  First user? You'll be offered admin setup after signing in.
                </p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
