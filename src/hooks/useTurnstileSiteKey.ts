import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface TurnstileConfig {
  siteKey: string;
  testMode: boolean;
}

/**
 * Loads the Cloudflare Turnstile site key from the public `turnstile-config`
 * edge function. Cached indefinitely; the key only changes on rotation.
 */
export function useTurnstileSiteKey() {
  return useQuery<TurnstileConfig>({
    queryKey: ["turnstile-config"],
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("turnstile-config", {
        method: "GET",
      });
      if (error) throw error;
      return data as TurnstileConfig;
    },
  });
}
