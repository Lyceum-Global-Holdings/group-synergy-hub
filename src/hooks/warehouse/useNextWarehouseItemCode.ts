import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Phase 9.5 — Next-item-code generator.
 *
 * MUST scan `warehouse_item_catalog` (the GLOBAL table that owns the
 * `UNIQUE(item_code)` constraint), not `warehouse_items` (which only
 * holds the current company's slice). Generating from the per-company
 * inventory layer was the root cause of the
 * `warehouse_item_catalog_item_code_key` collisions users were seeing
 * when adding items in categories another company had already used.
 *
 * Aligned with:
 *   - GS1 GTIN-13 / ISO/IEC 15459 (globally unique item identifiers)
 *   - SAP MM Material Number (unique within client / mandant)
 *
 * Format-tolerant: parses only the leading digits of each suffix so
 * mixed historical padding (`001` vs `0001`) is handled correctly.
 *
 * The `companyId` argument is kept for backward-compatibility with
 * existing callers but is intentionally ignored — catalog has no
 * `company_id` column.
 */
export function useNextWarehouseItemCode(
  categoryCode: string | null,
  _companyId: string | null,
) {
  return useQuery({
    queryKey: ['next-catalog-item-code', categoryCode],
    queryFn: async () => {
      if (!categoryCode) return null;

      const prefix = `INV-${categoryCode}-`;

      // Primary path: server-side authoritative RPC (single round-trip,
      // collision-free).
      const { data: rpcCode, error: rpcError } = await supabase.rpc(
        'next_catalog_item_code',
        { p_category_code: categoryCode },
      );
      if (!rpcError && typeof rpcCode === 'string' && rpcCode.length > 0) {
        return rpcCode;
      }

      // Fallback: client-side scan of the catalog if the RPC is unavailable.
      // Still queries the GLOBAL catalog, never per-company inventory.
      const { data, error } = await supabase
        .from('warehouse_item_catalog')
        .select('item_code')
        .ilike('item_code', `${prefix}%`);

      if (error) {
        console.error('[useNextWarehouseItemCode] catalog scan failed:', error);
        return `${prefix}001`;
      }

      let maxSeq = 0;
      for (const row of data ?? []) {
        const code = row.item_code ?? '';
        if (!code.startsWith(prefix)) continue;
        const tail = code.slice(prefix.length);
        const m = tail.match(/^(\d+)/);
        if (!m) continue;
        const seq = Number(m[1]);
        if (Number.isFinite(seq) && seq > maxSeq) maxSeq = seq;
      }

      const nextSeq = String(maxSeq + 1).padStart(3, '0');
      return `${prefix}${nextSeq}`;
    },
    enabled: !!categoryCode,
    // Live-critical: a stale code = a guaranteed UNIQUE collision. Always
    // hit the network when the dialog opens.
    staleTime: 0,
    refetchOnMount: 'always',
  });
}
