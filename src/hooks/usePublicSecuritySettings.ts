import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TurnstileSurface =
  | "auth"
  | "portal_login"
  | "portal_invite"
  | "public_registration";

export interface PublicSecuritySettings {
  turnstile_enabled: boolean;
  turnstile_surfaces: Record<TurnstileSurface, boolean>;
}

const FALLBACK: PublicSecuritySettings = {
  turnstile_enabled: true,
  turnstile_surfaces: {
    auth: true,
    portal_login: true,
    portal_invite: true,
    public_registration: true,
  },
};

/**
 * Pre-auth read of the security flags needed by login/registration screens
 * to decide whether to render the Turnstile widget. Calls the
 * `security-settings-public` edge function (no JWT required).
 */
export function usePublicSecuritySettings() {
  return useQuery<PublicSecuritySettings>({
    queryKey: ["security-settings-public"],
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        "security-settings-public",
        { method: "GET" },
      );
      if (error || !data) return FALLBACK;
      return {
        turnstile_enabled: data.turnstile_enabled ?? true,
        turnstile_surfaces: { ...FALLBACK.turnstile_surfaces, ...(data.turnstile_surfaces ?? {}) },
      };
    },
  });
}

/** Returns true when Turnstile is on AND the requested surface is enabled. */
export function useTurnstileEnabledFor(surface: TurnstileSurface): boolean {
  const { data } = usePublicSecuritySettings();
  if (!data) return true; // fail-safe while loading: render widget
  return data.turnstile_enabled && data.turnstile_surfaces[surface] !== false;
}
