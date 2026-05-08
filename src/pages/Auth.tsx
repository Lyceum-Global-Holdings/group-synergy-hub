import { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle, Eye, EyeOff } from 'lucide-react';
import TurnstileWidget from '@/components/security/TurnstileWidget';
import { useTurnstileSiteKey } from '@/hooks/useTurnstileSiteKey';
import { useTurnstileEnabledFor } from '@/hooks/usePublicSecuritySettings';

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const { data: turnstile } = useTurnstileSiteKey();
  const turnstileEnabled = useTurnstileEnabledFor('auth');
  const { signIn, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  // Get redirect URL from query params (for QR code transfer flow)
  const redirectUrl = searchParams.get('redirect');
  const action = searchParams.get('action');

  // Redirect if already authenticated
  useEffect(() => {
    if (user) {
      // Priority: query param redirect > location state > default
      if (redirectUrl) {
        const fullRedirect = action ? `${redirectUrl}?action=${action}` : redirectUrl;
        navigate(fullRedirect, { replace: true });
      } else {
        const from = location.state?.from?.pathname || '/';
        navigate(from, { replace: true });
      }
    }
  }, [user, navigate, location, redirectUrl, action]);

  const getErrorMessage = (error: any) => {
    const message = error?.message || '';
    if (message.includes('Invalid login credentials')) {
      return 'Invalid email or password. Please check your credentials and try again.';
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center space-y-2">
          <div className="w-12 h-12 bg-gradient-to-br from-primary to-info rounded-lg flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-lg">ERP</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Enterprise Management System</h1>
          <p className="text-sm text-muted-foreground text-center">
            Sign in to access your dashboard
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign In</CardTitle>
            <CardDescription>
              Enter your credentials to access your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                  </Button>
                </div>
              </div>
              {turnstile?.siteKey && (
                <div className="flex justify-center">
                  <TurnstileWidget
                    siteKey={turnstile.siteKey}
                    action="login"
                    onVerify={setCaptchaToken}
                    onExpire={() => setCaptchaToken(null)}
                    onError={() => setCaptchaToken(null)}
                  />
                </div>
              )}
              <Button
                type="submit"
                className="w-full"
                disabled={isLoading || (!!turnstile?.siteKey && !captchaToken)}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign In
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Protected by Cloudflare Turnstile — no personal data is collected.
              </p>
            </form>
          </CardContent>
        </Card>

        <div className="text-center">
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>After signing in:</strong> First user will get admin bootstrap option to manage the system.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    </div>
  );
}
