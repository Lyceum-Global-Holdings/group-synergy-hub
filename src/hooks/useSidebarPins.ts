import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export const PIN_LIMIT_PER_COMPANY = 12;

export interface PinnedSubmodule {
  id: string;
  user_id: string;
  company_id: string;
  module_key: string;
  submodule_key: string;
  submodule_url: string;
  submodule_title: string;
  position: number;
}

const PINS_KEY = (userId: string | undefined) => ["sidebar-pins", userId] as const;

/**
 * Returns all pins for the current user across all accessible companies.
 * Filtering by company is done client-side because a user typically has very
 * few pins (≤ ~50 total) and we want a single shared cache entry.
 */
export function useUserPins() {
  const { user } = useAuth();

  return useQuery({
    queryKey: PINS_KEY(user?.id),
    enabled: !!user?.id,
    queryFn: async (): Promise<PinnedSubmodule[]> => {
      const { data, error } = await supabase
        .from("user_pinned_submodules")
        .select("*")
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PinnedSubmodule[];
    },
  });
}

export function useTogglePin() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      companyId: string;
      moduleKey: string;
      submoduleKey: string;
      submoduleUrl: string;
      submoduleTitle: string;
    }) => {
      if (!user?.id) throw new Error("Not authenticated");

      // Check if already pinned
      const { data: existing, error: selErr } = await supabase
        .from("user_pinned_submodules")
        .select("id")
        .eq("user_id", user.id)
        .eq("company_id", input.companyId)
        .eq("module_key", input.moduleKey)
        .eq("submodule_key", input.submoduleKey)
        .maybeSingle();
      if (selErr) throw selErr;

      if (existing) {
        const { error: delErr } = await supabase
          .from("user_pinned_submodules")
          .delete()
          .eq("id", existing.id);
        if (delErr) throw delErr;
        return { action: "unpinned" as const };
      }

      // Enforce soft cap per company
      const { count, error: cntErr } = await supabase
        .from("user_pinned_submodules")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("company_id", input.companyId);
      if (cntErr) throw cntErr;
      if ((count ?? 0) >= PIN_LIMIT_PER_COMPANY) {
        throw new Error(
          `Pin limit reached (${PIN_LIMIT_PER_COMPANY}). Unpin something first.`
        );
      }

      const nextPosition = count ?? 0;
      const { error: insErr } = await supabase
        .from("user_pinned_submodules")
        .insert({
          user_id: user.id,
          company_id: input.companyId,
          module_key: input.moduleKey,
          submodule_key: input.submoduleKey,
          submodule_url: input.submoduleUrl,
          submodule_title: input.submoduleTitle,
          position: nextPosition,
        });
      if (insErr) throw insErr;
      return { action: "pinned" as const };
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: PINS_KEY(user?.id) });
      toast.success(res.action === "pinned" ? "Pinned to sidebar" : "Removed from pinned");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to update pin");
    },
  });
}

export function useReorderPins() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: { companyId: string; orderedIds: string[] }) => {
      if (!user?.id) throw new Error("Not authenticated");
      // Update each row's position; small lists so sequential is fine.
      await Promise.all(
        input.orderedIds.map((id, idx) =>
          supabase
            .from("user_pinned_submodules")
            .update({ position: idx })
            .eq("id", id)
            .eq("user_id", user.id)
        )
      );
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: PINS_KEY(user?.id) });
      const prev = qc.getQueryData<PinnedSubmodule[]>(PINS_KEY(user?.id));
      if (prev) {
        const idToPos = new Map(input.orderedIds.map((id, idx) => [id, idx]));
        const next = prev.map((p) =>
          p.company_id === input.companyId && idToPos.has(p.id)
            ? { ...p, position: idToPos.get(p.id)! }
            : p
        );
        qc.setQueryData(PINS_KEY(user?.id), next);
      }
      return { prev };
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.prev) qc.setQueryData(PINS_KEY(user?.id), ctx.prev);
      toast.error("Failed to reorder pins");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: PINS_KEY(user?.id) });
    },
  });
}
