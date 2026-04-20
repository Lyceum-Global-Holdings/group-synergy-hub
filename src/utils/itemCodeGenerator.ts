import { supabase } from '@/integrations/supabase/client';

/**
 * Allocate sequential warehouse item codes following the project standard:
 *   INV-{CATEGORY_CODE}-{NNN}
 *
 * Standards:
 * - GS1 SKU Identification (deterministic unique identifier)
 * - ISO 8000-110 Master Data Quality (documented, repeatable pattern)
 * - ISO 7372 / SAP MM 3-letter category mnemonic
 *
 * Performs a single DB query per category per batch to discover the current
 * max sequence, then returns `count` sequential codes starting from max + 1.
 *
 * Scoped per (categoryCode, companyId) — matches the composite uniqueness
 * constraint on warehouse_items(item_code, company_id).
 */
export async function allocateItemCodes(
  categoryCode: string,
  companyId: string | null,
  count: number
): Promise<string[]> {
  if (!categoryCode) {
    throw new Error('Category code is required to auto-generate item codes');
  }
  if (count <= 0) return [];

  const prefix = `INV-${categoryCode}-`;

  let query = supabase
    .from('warehouse_items')
    .select('item_code')
    .ilike('item_code', `${prefix}%`);

  if (companyId) {
    query = query.eq('company_id', companyId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[allocateItemCodes] Failed to fetch existing codes:', error);
    throw new Error(`Failed to allocate item codes for ${categoryCode}: ${error.message}`);
  }

  let maxSeq = 0;
  if (data && data.length > 0) {
    for (const row of data) {
      const seqStr = (row.item_code || '').replace(prefix, '');
      const seq = parseInt(seqStr, 10);
      if (!isNaN(seq) && seq > maxSeq) {
        maxSeq = seq;
      }
    }
  }

  const codes: string[] = [];
  for (let i = 1; i <= count; i++) {
    const nextSeq = (maxSeq + i).toString().padStart(3, '0');
    codes.push(`${prefix}${nextSeq}`);
  }

  return codes;
}
