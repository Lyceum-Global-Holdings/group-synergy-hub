import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type AalLevel = 'aal1' | 'aal2' | null;

export interface MfaState {
  loading: boolean;
  currentLevel: AalLevel;
  nextLevel: AalLevel;
  hasVerifiedFactor: boolean;
  /** True when user is signed in (AAL1) but must complete TOTP to reach AAL2. */
  mfaRequired: boolean;
}

/**
 * Reads the current Authenticator Assurance Level (AAL) and enrolled factors.
 * NIST SP 800-63B AAL2 is achieved when a verified TOTP factor has been used in the session.
 */
export function useMfa() {
  const [state, setState] = useState<MfaState>({
    loading: true,
    currentLevel: null,
    nextLevel: null,
    hasVerifiedFactor: false,
    mfaRequired: false,
  });

  const refresh = useCallback(async () => {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const verified = (factors?.totp ?? []).some((f) => f.status === 'verified');
    setState({
      loading: false,
      currentLevel: (aal?.currentLevel as AalLevel) ?? null,
      nextLevel: (aal?.nextLevel as AalLevel) ?? null,
      hasVerifiedFactor: verified,
      mfaRequired:
        aal?.currentLevel === 'aal1' && aal?.nextLevel === 'aal2' && verified,
    });
  }, []);

  useEffect(() => {
    refresh();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      refresh();
    });
    return () => sub.subscription.unsubscribe();
  }, [refresh]);

  return { ...state, refresh };
}
