import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";

/**
 * Shared, super-admin-managed column visibility for a table view.
 *
 * - Every authenticated user loads the system-wide default (ui_view_settings).
 * - Anyone may toggle columns for their current session (not persisted).
 * - Super admins can push the current layout system-wide (set_ui_view_setting),
 *   making it the default everyone loads.
 */

export interface UiViewSetting {
  view_key: string;
  config: Record<string, boolean>;
  updated_by: string | null;
  updated_at: string;
}

export function useUiViewSetting(viewKey: string) {
  return useQuery<UiViewSetting | null>({
    queryKey: ["ui-view-setting", viewKey],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("ui_view_settings")
        .select("*")
        .eq("view_key", viewKey)
        .maybeSingle();
      if (error) throw error;
      return (data as UiViewSetting) ?? null;
    },
  });
}

interface ColumnDef<K extends string> {
  key: K;
  label: string;
  fixed: boolean;
}

interface UseManagedColumnsArgs<K extends string> {
  viewKey: string;
  defs: ReadonlyArray<ColumnDef<K>>;
  defaultVisible: Record<K, boolean>;
}

export function useManagedColumns<K extends string>({
  viewKey,
  defs,
  defaultVisible,
}: UseManagedColumnsArgs<K>) {
  const queryClient = useQueryClient();
  const { data: isSuperAdmin = false } = useSuperAdmin();
  const { data: systemSetting } = useUiViewSetting(viewKey);

  const fixedKeys = useMemo(
    () => defs.filter((d) => d.fixed).map((d) => d.key),
    [defs]
  );

  // Merge a saved config over the hardcoded defaults; fixed columns are always
  // visible, and any column missing from the saved config keeps its default.
  const resolve = useCallback(
    (config?: Record<string, boolean> | null): Record<K, boolean> => {
      const merged = { ...defaultVisible } as Record<K, boolean>;
      if (config) {
        for (const d of defs) {
          if (typeof config[d.key] === "boolean") merged[d.key] = config[d.key];
        }
      }
      for (const k of fixedKeys) merged[k] = true;
      return merged;
    },
    [defaultVisible, defs, fixedKeys]
  );

  const [visibleColumns, setVisibleColumns] = useState<Record<K, boolean>>(() =>
    resolve(systemSetting?.config)
  );

  // Apply the system default once it first loads, without clobbering in-session
  // toggles a user makes afterwards.
  const appliedAtRef = useRef<string | null>(null);
  useEffect(() => {
    if (!systemSetting) return;
    if (appliedAtRef.current === systemSetting.updated_at) return;
    appliedAtRef.current = systemSetting.updated_at;
    setVisibleColumns(resolve(systemSetting.config));
  }, [systemSetting, resolve]);

  const toggleColumn = useCallback(
    (key: K) => {
      if (fixedKeys.includes(key)) return;
      setVisibleColumns((prev) => ({ ...prev, [key]: !prev[key] }));
    },
    [fixedKeys]
  );

  const col = useCallback((key: K) => visibleColumns[key], [visibleColumns]);

  const resetToSystemDefault = useCallback(() => {
    setVisibleColumns(resolve(systemSetting?.config));
  }, [resolve, systemSetting]);

  const applyMutation = useMutation({
    mutationFn: async (config: Record<K, boolean>) => {
      // Persist only the non-fixed columns; fixed are always-on.
      const toSave: Record<string, boolean> = {};
      for (const d of defs) if (!d.fixed) toSave[d.key] = !!config[d.key];
      const { data, error } = await (supabase as any).rpc("set_ui_view_setting", {
        p_view_key: viewKey,
        p_config: toSave,
      });
      if (error) throw error;
      return data as UiViewSetting;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ui-view-setting", viewKey] });
    },
  });

  const applySystemWide = useCallback(
    () => applyMutation.mutateAsync(visibleColumns),
    [applyMutation, visibleColumns]
  );

  return {
    visibleColumns,
    toggleColumn,
    col,
    resetToSystemDefault,
    applySystemWide,
    isApplying: applyMutation.isPending,
    isSuperAdmin,
    hasSystemDefault: !!systemSetting,
  };
}
