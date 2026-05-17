import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { BulkCatalogRow, ImportResultRow, newRow } from './types';

export interface BulkCatalogDefaults {
  company_id: string | null;
  location_id: string | null;
}

export function useBulkCatalogImport(defaults: BulkCatalogDefaults = { company_id: null, location_id: null }) {
  const defaultsRef = useRef(defaults);
  defaultsRef.current = defaults;

  const makeRow = useCallback(
    (extra: Partial<BulkCatalogRow> = {}) =>
      newRow({
        company_id: defaultsRef.current.company_id,
        location_id: defaultsRef.current.location_id,
        ...extra,
      }),
    [],
  );

  const [rows, setRows] = useState<BulkCatalogRow[]>(() => [makeRow(), makeRow(), makeRow()]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Backfill blank/pending rows when defaults change (don't overwrite user edits or imported rows)
  useEffect(() => {
    setRows((rs) =>
      rs.map((r) => {
        if (r.status === 'imported') return r;
        const patch: Partial<BulkCatalogRow> = {};
        if (!r.company_id && defaults.company_id) patch.company_id = defaults.company_id;
        if (!r.location_id && defaults.location_id) patch.location_id = defaults.location_id;
        return Object.keys(patch).length ? { ...r, ...patch } : r;
      }),
    );
  }, [defaults.company_id, defaults.location_id]);

  const setRow = useCallback((rowId: string, patch: Partial<BulkCatalogRow>) => {
    setRows((rs) => rs.map((r) => (r.rowId === rowId ? { ...r, ...patch, status: 'pending', message: null } : r)));
  }, []);

  const addRows = useCallback(
    (n = 1) => {
      setRows((rs) => [...rs, ...Array.from({ length: n }, () => makeRow())]);
    },
    [makeRow],
  );

  const removeRow = useCallback((rowId: string) => {
    setRows((rs) => rs.filter((r) => r.rowId !== rowId));
  }, []);

  const clearInvalid = useCallback(() => {
    setRows((rs) => rs.filter((r) => r.status !== 'invalid' && r.status !== 'error'));
  }, []);

  const resetAll = useCallback(() => {
    setRows([makeRow(), makeRow(), makeRow()]);
  }, [makeRow]);


  /**
   * Append rows by pasted entries. Each entry may include `code` only or also
   * `opening_qty`, `unit_cost`, `reorder_level`, `notes`. Catalog is resolved
   * in a single query against item_code / barcode / sku.
   */
  const seedFromPaste = useCallback(
    async (entries: PasteEntry[]) => {
      // Deduplicate by code+qty signature so identical lines collapse, but keep
      // distinct qty values as separate rows.
      const cleaned = entries
        .map((e) => ({ ...e, code: (e.code ?? '').trim() }))
        .filter((e) => e.code.length > 0);
      if (cleaned.length === 0) return { resolved: 0, missing: [] as string[], withQty: 0 };

      const uniqueCodes = Array.from(new Set(cleaned.map((e) => e.code)));
      const { data, error } = await supabase
        .from('warehouse_item_catalog')
        .select('id, item_code, name, barcode, sku, unit:item_units(abbreviation)')
        .or(
          `item_code.in.(${uniqueCodes.map((c) => `"${c}"`).join(',')}),barcode.in.(${uniqueCodes
            .map((c) => `"${c}"`)
            .join(',')}),sku.in.(${uniqueCodes.map((c) => `"${c}"`).join(',')})`,
        );
      if (error) throw error;

      const byKey = new Map<string, any>();
      for (const it of data ?? []) {
        if (it.item_code) byKey.set(it.item_code.toLowerCase(), it);
        if ((it as any).barcode) byKey.set(((it as any).barcode as string).toLowerCase(), it);
        if ((it as any).sku) byKey.set(((it as any).sku as string).toLowerCase(), it);
      }

      const missing: string[] = [];
      let withQty = 0;
      const newRows: BulkCatalogRow[] = cleaned.map((entry) => {
        const hit = byKey.get(entry.code.toLowerCase());
        const qtyStr =
          entry.opening_qty != null && Number.isFinite(entry.opening_qty) && entry.opening_qty > 0
            ? String(entry.opening_qty)
            : '';
        if (qtyStr) withQty += 1;
        const costStr =
          entry.unit_cost != null && Number.isFinite(entry.unit_cost) ? String(entry.unit_cost) : '';
        const reorderStr =
          entry.reorder_level != null && Number.isFinite(entry.reorder_level)
            ? String(entry.reorder_level)
            : '';
        if (!hit) {
          missing.push(entry.code);
          return makeRow({
            item_code: entry.code,
            opening_qty: qtyStr,
            unit_cost: costStr,
            reorder_level: reorderStr,
            notes: entry.notes ?? '',
            status: 'invalid',
            message: 'Not in catalog',
          });
        }
        return makeRow({
          catalog_item_id: hit.id,
          item_code: hit.item_code,
          name: hit.name,
          uom: hit.unit?.abbreviation ?? null,
          opening_qty: qtyStr,
          unit_cost: costStr,
          reorder_level: reorderStr,
          notes: entry.notes ?? '',
          status: 'pending',
        });
      });

      setRows((rs) => {
        const trimmed = rs.filter((r) => r.catalog_item_id || r.item_code || r.name);
        return [...trimmed, ...newRows];
      });
      return { resolved: cleaned.length - missing.length, missing, withQty };
    },
    [makeRow],
  );

  /** Back-compat: seed from a flat list of codes (no qty). */
  const seedFromCodes = useCallback(
    async (codes: string[]) => {
      const { resolved, missing } = await seedFromPaste(codes.map((code) => ({ code })));
      return { resolved, missing };
    },
    [seedFromPaste],
  );

  const validateRow = useCallback((r: BulkCatalogRow): string | null => {
    if (!r.catalog_item_id) return 'Pick a catalog item';
    if (!r.company_id) return 'Company required';
    const qty = r.opening_qty ? Number(r.opening_qty) : 0;
    if (Number.isNaN(qty) || qty < 0) return 'Opening qty must be ≥ 0';
    if (qty > 0 && !r.location_id) return 'Location required when qty > 0';
    if (qty > 0 && !r.bin_id) return 'Bin required when qty > 0';
    if (r.bin_id && !r.location_id) return 'Location required for bin';
    if (r.unit_cost && Number(r.unit_cost) < 0) return 'Unit cost must be ≥ 0';
    return null;
  }, []);

  const validatedRows = useMemo(() => {
    // Detect intra-grid duplicates on (catalog_item_id, company_id, location_id, bin_id)
    const dupKey = (r: BulkCatalogRow) =>
      `${r.catalog_item_id}|${r.company_id}|${r.location_id ?? ''}|${r.bin_id ?? ''}`;
    const counts = new Map<string, number>();
    for (const r of rows) {
      if (r.catalog_item_id && r.company_id) counts.set(dupKey(r), (counts.get(dupKey(r)) ?? 0) + 1);
    }
    return rows.map((r) => {
      if (r.status === 'imported') return r;
      const err = validateRow(r);
      if (err) return { ...r, status: 'invalid' as const, message: err };
      if ((counts.get(dupKey(r)) ?? 0) > 1)
        return { ...r, status: 'invalid' as const, message: 'Duplicate (item/company/location/bin)' };
      return { ...r, status: 'valid' as const, message: null };
    });
  }, [rows, validateRow]);

  const validCount = validatedRows.filter((r) => r.status === 'valid').length;
  const invalidCount = validatedRows.filter((r) => r.status === 'invalid').length;

  const submit = useCallback(async () => {
    const payload = validatedRows
      .filter((r) => r.status === 'valid')
      .map((r) => ({
        rowId: r.rowId,
        catalog_item_id: r.catalog_item_id,
        company_id: r.company_id,
        location_id: r.location_id,
        bin_id: r.bin_id,
        opening_qty: r.opening_qty ? Number(r.opening_qty) : 0,
        unit_cost: r.unit_cost ? Number(r.unit_cost) : null,
        reorder_level: r.reorder_level ? Number(r.reorder_level) : null,
        notes: r.notes || null,
      }));

    if (payload.length === 0) return [] as ImportResultRow[];

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('bulk_provision_inventory_from_catalog' as any, {
        p_rows: payload.map(({ rowId, ...rest }) => rest),
      });
      if (error) throw error;
      const results = (data ?? []) as ImportResultRow[];

      // Apply per-row status back to grid
      setRows((rs) => {
        const next = [...rs];
        results.forEach((res, idx) => {
          const target = payload[idx];
          const i = next.findIndex((r) => r.rowId === target.rowId);
          if (i >= 0) {
            next[i] = {
              ...next[i],
              status: res.status === 'error' ? 'error' : 'imported',
              message: res.error ?? null,
            };
          }
        });
        return next;
      });
      return results;
    } finally {
      setIsSubmitting(false);
    }
  }, [validatedRows]);

  return {
    rows: validatedRows,
    setRow,
    addRows,
    removeRow,
    clearInvalid,
    resetAll,
    seedFromCodes,
    submit,
    isSubmitting,
    validCount,
    invalidCount,
  };
}
