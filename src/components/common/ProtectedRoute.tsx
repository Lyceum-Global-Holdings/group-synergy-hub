import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

type MfaCheck = 'pending' | 'ok' | 'challenge';

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [mfaCheck, setMfaCheck] = useState<MfaCheck>('pending');

  useEffect(() => {
    if (!user) {
      setMfaCheck('pending');
      return;
    }
    let cancelled = false;
    (async () => {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (cancelled) return;
      // If user has enrolled MFA but session is only AAL1, force the challenge.
      if (aal?.currentLevel === 'aal1' && aal?.nextLevel === 'aal2') {
        setMfaCheck('challenge');
      } else {
        setMfaCheck('ok');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (loading || (user && mfaCheck === 'pending')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  if (mfaCheck === 'challenge' && location.pathname !== '/auth/mfa') {
    return <Navigate to="/auth/mfa" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
