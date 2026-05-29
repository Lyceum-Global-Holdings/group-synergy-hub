import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { BulkCatalogRow, BulkCatalogSplit, ImportResultRow, PasteEntry, newRow, newSplit } from './types';

export interface BulkCatalogDefaults {
  company_id: string | null;
  location_id: string | null;
}

interface FlatPayload {
  rowId: string;
  splitId: string | null;
  catalog_item_id: string | null;
  company_id: string | null;
  location_id: string | null;
  bin_id: string | null;
  opening_qty: number;
  unit_cost: number | null;
  reorder_level: number | null;
  reference_no: string | null;
  notes: string | null;
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
    setRows((rs) =>
      rs.map((r) => {
        if (r.rowId !== rowId) return r;
        const next = { ...r, ...patch, status: 'pending' as const, message: null };
        // When parent location changes, clear bin and split bins (parity will re-validate)
        if ('location_id' in patch && patch.location_id !== r.location_id) {
          next.bin_id = null;
          if (next.splits && next.splits.length > 0) {
            next.splits = next.splits.map((s) => ({ ...s, bin_id: null, status: 'pending', message: null }));
          }
        }
        return next;
      }),
    );
  }, []);

  const setSplit = useCallback((rowId: string, splitId: string, patch: Partial<BulkCatalogSplit>) => {
    setRows((rs) =>
      rs.map((r) => {
        if (r.rowId !== rowId || !r.splits) return r;
        return {
          ...r,
          status: 'pending',
          message: null,
          splits: r.splits.map((s) =>
            s.splitId === splitId ? { ...s, ...patch, status: 'pending', message: null } : s,
          ),
        };
      }),
    );
  }, []);

  const enableSplits = useCallback((rowId: string) => {
    setRows((rs) =>
      rs.map((r) => {
        if (r.rowId !== rowId) return r;
        if (r.splits && r.splits.length > 0) return r;
        // Seed first split from parent's existing bin/qty/cost so nothing is lost
        const seed = newSplit({
          bin_id: r.bin_id,
          qty: r.opening_qty || '',
          unit_cost: r.unit_cost || '',
        });
        return { ...r, splits: [seed, newSplit()], bin_id: null, opening_qty: '', status: 'pending', message: null };
      }),
    );
  }, []);

  const addSplit = useCallback((rowId: string) => {
    setRows((rs) =>
      rs.map((r) => {
        if (r.rowId !== rowId) return r;
        const existing = r.splits ?? [];
        return { ...r, splits: [...existing, newSplit()], status: 'pending', message: null };
      }),
    );
  }, []);

  const removeSplit = useCallback((rowId: string, splitId: string) => {
    setRows((rs) =>
      rs.map((r) => {
        if (r.rowId !== rowId || !r.splits) return r;
        const next = r.splits.filter((s) => s.splitId !== splitId);
        return { ...r, splits: next.length > 0 ? next : undefined, status: 'pending', message: null };
      }),
    );
  }, []);

  const collapseSplits = useCallback((rowId: string) => {
    setRows((rs) =>
      rs.map((r) => {
        if (r.rowId !== rowId) return r;
        return { ...r, splits: undefined, status: 'pending', message: null };
      }),
    );
  }, []);

  const duplicateRowForNewBin = useCallback((rowId: string) => {
    setRows((rs) => {
      const i = rs.findIndex((r) => r.rowId === rowId);
      if (i < 0) return rs;
      const src = rs[i];
      const clone = makeRow({
        catalog_item_id: src.catalog_item_id,
        item_code: src.item_code,
        name: src.name,
        uom: src.uom,
        company_id: src.company_id,
        location_id: src.location_id,
        bin_id: null,
        unit_cost: src.unit_cost,
        reorder_level: src.reorder_level,
        reference_no: src.reference_no,
        notes: src.notes,
      });
      return [...rs.slice(0, i + 1), clone, ...rs.slice(i + 1)];
    });
  }, [makeRow]);

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
   * `opening_qty`, `unit_cost`, `reorder_level`, `notes`, and optional
   * `bin_code`. Entries that share (code, defaults) and differ only by bin
   * are auto-grouped into a single parent row with multiple splits.
   */
  const seedFromPaste = useCallback(
    async (entries: PasteEntry[]) => {
      const cleaned = entries
        .map((e) => ({ ...e, code: (e.code ?? '').trim(), bin_code: e.bin_code?.trim() || null }))
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

      // Resolve bin codes when provided. We resolve against the current default
      // location only; if the user is using non-default locations, they can pick
      // the bin in the grid.
      const defaultLoc = defaultsRef.current.location_id;
      const binCodes = Array.from(
        new Set(cleaned.map((e) => e.bin_code).filter((c): c is string => !!c)),
      );
      const binByCode = new Map<string, { id: string; location_id: string }>();
      if (binCodes.length > 0 && defaultLoc) {
        const { data: binData } = await supabase
          .from('warehouse_bins')
          .select('id, bin_code, location_id')
          .eq('location_id', defaultLoc)
          .in('bin_code', binCodes);
        for (const b of binData ?? []) {
          binByCode.set(((b as any).bin_code as string).toLowerCase(), {
            id: (b as any).id,
            location_id: (b as any).location_id,
          });
        }
      }

      const missing: string[] = [];
      let withQty = 0;

      // Group by (catalog_id) when a bin_code was provided so multi-bin pastes
      // collapse into one parent row with multiple splits.
      const groups = new Map<string, BulkCatalogRow>();
      const standalone: BulkCatalogRow[] = [];

      for (const entry of cleaned) {
        const hit = byKey.get(entry.code.toLowerCase());
        const qN = entry.opening_qty != null && Number.isFinite(entry.opening_qty) && entry.opening_qty > 0
          ? entry.opening_qty
          : 0;
        if (qN > 0) withQty += 1;
        const qtyStr = qN > 0 ? String(qN) : '';
        const costStr =
          entry.unit_cost != null && Number.isFinite(entry.unit_cost) ? String(entry.unit_cost) : '';
        const reorderStr =
          entry.reorder_level != null && Number.isFinite(entry.reorder_level)
            ? String(entry.reorder_level)
            : '';

        if (!hit) {
          missing.push(entry.code);
          standalone.push(
            makeRow({
              item_code: entry.code,
              opening_qty: qtyStr,
              unit_cost: costStr,
              reorder_level: reorderStr,
              notes: entry.notes ?? '',
              status: 'invalid',
              message: 'Not in catalog',
            }),
          );
          continue;
        }

        const binHit = entry.bin_code ? binByCode.get(entry.bin_code.toLowerCase()) : null;

        if (entry.bin_code && binHit) {
          // Group into a parent row keyed by catalog id
          const key = `${hit.id}`;
          let parent = groups.get(key);
          if (!parent) {
            parent = makeRow({
              catalog_item_id: hit.id,
              item_code: hit.item_code,
              name: hit.name,
              uom: hit.unit?.abbreviation ?? null,
              unit_cost: costStr,
              reorder_level: reorderStr,
              notes: entry.notes ?? '',
              splits: [],
              status: 'pending',
            });
            groups.set(key, parent);
          }
          parent.splits = [
            ...(parent.splits ?? []),
            newSplit({ bin_id: binHit.id, qty: qtyStr, unit_cost: costStr }),
          ];
        } else {
          standalone.push(
            makeRow({
              catalog_item_id: hit.id,
              item_code: hit.item_code,
              name: hit.name,
              uom: hit.unit?.abbreviation ?? null,
              opening_qty: qtyStr,
              unit_cost: costStr,
              reorder_level: reorderStr,
              notes: entry.notes ?? '',
              status: 'pending',
            }),
          );
          if (entry.bin_code && !binHit) {
            // Bin code provided but not resolved — mark invalid hint via message
            standalone[standalone.length - 1].status = 'invalid';
            standalone[standalone.length - 1].message = `Bin "${entry.bin_code}" not found at default location`;
          }
        }
      }

      // Collapse single-split parents back to standalone rows for clarity
      const grouped = Array.from(groups.values()).map((p) => {
        if (p.splits && p.splits.length === 1) {
          const only = p.splits[0];
          return { ...p, splits: undefined, bin_id: only.bin_id, opening_qty: only.qty, unit_cost: only.unit_cost };
        }
        return p;
      });

      const newRows: BulkCatalogRow[] = [...standalone, ...grouped];

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

  /**
   * Validate a row. Returns array of {splitId|null, message}. If row has no
   * splits and is single-line, returns at most one entry with splitId=null.
   */
  const validateRow = useCallback((r: BulkCatalogRow): Array<{ splitId: string | null; message: string }> => {
    const errs: Array<{ splitId: string | null; message: string }> = [];
    if (!r.catalog_item_id) errs.push({ splitId: null, message: 'Pick a catalog item' });
    if (!r.company_id) errs.push({ splitId: null, message: 'Company required' });
    if (r.unit_cost && Number(r.unit_cost) < 0) errs.push({ splitId: null, message: 'Unit cost must be ≥ 0' });

    if (r.splits && r.splits.length > 0) {
      if (!r.location_id) errs.push({ splitId: null, message: 'Location required when splitting bins' });
      const seenBins = new Map<string, number>();
      r.splits.forEach((s) => {
        if (s.bin_id) seenBins.set(s.bin_id, (seenBins.get(s.bin_id) ?? 0) + 1);
      });
      let totalQty = 0;
      r.splits.forEach((s) => {
        const q = s.qty ? Number(s.qty) : 0;
        if (!s.bin_id) errs.push({ splitId: s.splitId, message: 'Bin required' });
        if (!Number.isFinite(q) || q <= 0) errs.push({ splitId: s.splitId, message: 'Qty must be > 0' });
        else totalQty += q;
        if (s.unit_cost && Number(s.unit_cost) < 0)
          errs.push({ splitId: s.splitId, message: 'Unit cost must be ≥ 0' });
        if (s.bin_id && (seenBins.get(s.bin_id) ?? 0) > 1)
          errs.push({ splitId: s.splitId, message: 'Duplicate bin in split' });
      });
      if (totalQty <= 0 && r.splits.every((s) => !s.bin_id || !s.qty))
        errs.push({ splitId: null, message: 'At least one split with bin + qty required' });
    } else {
      const qty = r.opening_qty ? Number(r.opening_qty) : 0;
      if (Number.isNaN(qty) || qty < 0) errs.push({ splitId: null, message: 'Opening qty must be ≥ 0' });
      if (qty > 0 && !r.location_id) errs.push({ splitId: null, message: 'Location required when qty > 0' });
      if (qty > 0 && !r.bin_id) errs.push({ splitId: null, message: 'Bin required when qty > 0' });
      if (r.bin_id && !r.location_id) errs.push({ splitId: null, message: 'Location required for bin' });
    }
    return errs;
  }, []);

  const validatedRows = useMemo(() => {
    // Cross-row dedupe: flatten (catalog, company, location, bin) tuples across
    // both single-line bins and split bins.
    const dupKey = (catId: string | null, comp: string | null, loc: string | null, bin: string | null) =>
      `${catId}|${comp}|${loc ?? ''}|${bin ?? ''}`;
    const counts = new Map<string, number>();
    for (const r of rows) {
      if (!r.catalog_item_id || !r.company_id) continue;
      if (r.splits && r.splits.length > 0) {
        for (const s of r.splits) {
          if (s.bin_id) {
            const k = dupKey(r.catalog_item_id, r.company_id, r.location_id, s.bin_id);
            counts.set(k, (counts.get(k) ?? 0) + 1);
          }
        }
      } else {
        const k = dupKey(r.catalog_item_id, r.company_id, r.location_id, r.bin_id);
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
    }

    return rows.map((r) => {
      if (r.status === 'imported') return r;
      const errs = validateRow(r);

      // Layer in cross-row duplicate flags
      if (r.catalog_item_id && r.company_id) {
        if (r.splits && r.splits.length > 0) {
          r.splits.forEach((s) => {
            if (s.bin_id) {
              const k = dupKey(r.catalog_item_id, r.company_id, r.location_id, s.bin_id);
              if ((counts.get(k) ?? 0) > 1)
                errs.push({ splitId: s.splitId, message: 'Duplicate (item/company/location/bin)' });
            }
          });
        } else {
          const k = dupKey(r.catalog_item_id, r.company_id, r.location_id, r.bin_id);
          if ((counts.get(k) ?? 0) > 1)
            errs.push({ splitId: null, message: 'Duplicate (item/company/location/bin)' });
        }
      }

      if (errs.length === 0) {
        // Mark parent + splits valid
        const splits = r.splits?.map((s) => ({ ...s, status: 'valid' as const, message: null }));
        return { ...r, status: 'valid' as const, message: null, splits };
      }

      // Apply split-level messages and aggregate parent message
      const splitMsgs = new Map<string, string>();
      const rowMsgs: string[] = [];
      for (const e of errs) {
        if (e.splitId) {
          if (!splitMsgs.has(e.splitId)) splitMsgs.set(e.splitId, e.message);
        } else {
          rowMsgs.push(e.message);
        }
      }
      const splits = r.splits?.map((s) =>
        splitMsgs.has(s.splitId)
          ? { ...s, status: 'invalid' as const, message: splitMsgs.get(s.splitId)! }
          : { ...s, status: 'valid' as const, message: null },
      );
      const parentMsg = rowMsgs[0] ?? (splitMsgs.size > 0 ? `${splitMsgs.size} split issue(s)` : null);
      return { ...r, status: 'invalid' as const, message: parentMsg, splits };
    });
  }, [rows, validateRow]);

  const validCount = validatedRows.filter((r) => r.status === 'valid').length;
  const invalidCount = validatedRows.filter((r) => r.status === 'invalid').length;

  const submit = useCallback(async () => {
    const flat: FlatPayload[] = [];
    for (const r of validatedRows) {
      if (r.status !== 'valid') continue;
      const ref = r.reference_no?.trim();
      const baseNotes = r.notes?.trim() || '';
      const combinedNotes = ref
        ? baseNotes
          ? `PO/CMR: ${ref} — ${baseNotes}`
          : `PO/CMR: ${ref}`
        : baseNotes || null;
      const reorder = r.reorder_level ? Number(r.reorder_level) : null;
      const parentCost = r.unit_cost ? Number(r.unit_cost) : null;

      if (r.splits && r.splits.length > 0) {
        for (const s of r.splits) {
          flat.push({
            rowId: r.rowId,
            splitId: s.splitId,
            catalog_item_id: r.catalog_item_id,
            company_id: r.company_id,
            location_id: r.location_id,
            bin_id: s.bin_id,
            opening_qty: s.qty ? Number(s.qty) : 0,
            unit_cost: s.unit_cost ? Number(s.unit_cost) : parentCost,
            reorder_level: reorder,
            reference_no: ref || null,
            notes: combinedNotes,
          });
        }
      } else {
        flat.push({
          rowId: r.rowId,
          splitId: null,
          catalog_item_id: r.catalog_item_id,
          company_id: r.company_id,
          location_id: r.location_id,
          bin_id: r.bin_id,
          opening_qty: r.opening_qty ? Number(r.opening_qty) : 0,
          unit_cost: parentCost,
          reorder_level: reorder,
          reference_no: ref || null,
          notes: combinedNotes,
        });
      }
    }

    if (flat.length === 0) return [] as ImportResultRow[];

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('bulk_provision_inventory_from_catalog' as any, {
        p_rows: flat.map(({ rowId, splitId, ...rest }) => rest),
      });
      if (error) throw error;
      const results = (data ?? []) as ImportResultRow[];

      // Fan results back to row + split granularity. A parent row is "imported"
      // only when ALL of its splits succeeded; otherwise "error" with combined msg.
      setRows((rs) => {
        const byRow = new Map<string, { ok: number; err: number; msgs: string[]; splitStatus: Map<string, { ok: boolean; msg: string | null }> }>();
        results.forEach((res, idx) => {
          const target = flat[idx];
          const entry = byRow.get(target.rowId) ?? { ok: 0, err: 0, msgs: [] as string[], splitStatus: new Map() };
          if (res.status === 'error') {
            entry.err += 1;
            if (res.error) entry.msgs.push(res.error);
          } else {
            entry.ok += 1;
          }
          if (target.splitId) {
            entry.splitStatus.set(target.splitId, {
              ok: res.status !== 'error',
              msg: res.error ?? null,
            });
          }
          byRow.set(target.rowId, entry);
        });

        return rs.map((r) => {
          const e = byRow.get(r.rowId);
          if (!e) return r;
          const splits = r.splits?.map((s) => {
            const st = e.splitStatus.get(s.splitId);
            if (!st) return s;
            return {
              ...s,
              status: (st.ok ? 'imported' : 'error') as const,
              message: st.msg,
            };
          });
          const status = e.err === 0 ? 'imported' : e.ok === 0 ? 'error' : 'error';
          const message = e.err === 0 ? null : e.msgs.join('; ') || `${e.err} split(s) failed`;
          return { ...r, status, message, splits };
        });
      });
      return results;
    } finally {
      setIsSubmitting(false);
    }
  }, [validatedRows]);

  return {
    rows: validatedRows,
    setRow,
    setSplit,
    enableSplits,
    addSplit,
    removeSplit,
    collapseSplits,
    duplicateRowForNewBin,
    addRows,
    removeRow,
    clearInvalid,
    resetAll,
    seedFromCodes,
    seedFromPaste,
    submit,
    isSubmitting,
    validCount,
    invalidCount,
  };
}
