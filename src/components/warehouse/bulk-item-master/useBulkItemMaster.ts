import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useWarehouseItemCatalog } from '@/hooks/useWarehouseItemCatalog';
import { useItemCategories } from '@/hooks/useItemCategories';
import { useItemUnits } from '@/hooks/useItemUnits';
import { useInvalidateWarehouseStock } from '@/hooks/useInvalidateWarehouseStock';
import { allocateItemCodes } from '@/utils/itemCodeGenerator';
import { classifyItem } from '@/lib/itemMaster/autoClassify';
import type { BulkItemMasterRow, DuplicatePolicy } from './types';
import type { CreateCatalogItemData } from '@/types/itemBin';

let _rid = 0;
const nextRowId = () => `r${++_rid}_${Date.now().toString(36)}`;

function emptyRow(): BulkItemMasterRow {
  return {
    rowId: nextRowId(),
    name: '',
    description: '',
    brand: '',
    category_id: null,
    unit_id: null,
    item_code: '',
    auto_item_code: '',
    code_manual: false,
    classify_confidence: 'none',
    suggested_family: null,
    existing_catalog_id: null,
    status: 'pending',
    errors: [],
    warnings: [],
  };
}

export interface UseBulkItemMasterReturn {
  rows: BulkItemMasterRow[];
  setRow: (rowId: string, patch: Partial<BulkItemMasterRow>) => void;
  addRows: (n: number) => void;
  removeRow: (rowId: string) => void;
  clearInvalid: () => void;
  resetAll: () => void;
  seedFromNames: (names: string[]) => void;
  autoClassifyAll: () => void;
  resetCode: (rowId: string) => void;
  submit: () => Promise<{ created: number; updated: number; skipped: number; failed: number }>;
  isSubmitting: boolean;
  validCount: number;
  invalidCount: number;
  skippedCount: number;
  duplicatePolicy: DuplicatePolicy;
  setDuplicatePolicy: (p: DuplicatePolicy) => void;
  categories: ReturnType<typeof useItemCategories>['categories'];
  units: ReturnType<typeof useItemUnits>['units'];
}

export function useBulkItemMaster(): UseBulkItemMasterReturn {
  const { toast } = useToast();
  const { categories } = useItemCategories();
  const { units } = useItemUnits();
  const { items: existingItems, bulkCreateItemsAsync, updateItemAsync, isBulkCreating } =
    useWarehouseItemCatalog();
  const invalidateStock = useInvalidateWarehouseStock();

  const [duplicatePolicy, setDuplicatePolicy] = useState<DuplicatePolicy>('fail');

  const [rows, setRows] = useState<BulkItemMasterRow[]>(() =>
    Array.from({ length: 5 }, emptyRow),
  );

  const existingCodeToId = useMemo(() => {
    const map = new Map<string, string>();
    existingItems.forEach((it) => {
      if (it.item_code) map.set(it.item_code.toLowerCase(), it.id);
    });
    return map;
  }, [existingItems]);

  const maxByCategoryCode = useMemo(() => {
    const map = new Map<string, number>();
    existingItems.forEach((it) => {
      const code = it.item_code || '';
      const m = code.match(/^INV-([A-Z0-9]+)-(\d+)/i);
      if (!m) return;
      const cat = m[1].toUpperCase();
      const seq = Number(m[2]);
      if (!Number.isFinite(seq)) return;
      if ((map.get(cat) ?? 0) < seq) map.set(cat, seq);
    });
    return map;
  }, [existingItems]);

  const categoryById = useMemo(() => {
    const m = new Map<string, { id: string; name: string; code?: string | null }>();
    categories.forEach((c) => m.set(c.id, c));
    return m;
  }, [categories]);

  const recompute = useCallback(
    (input: BulkItemMasterRow[]): BulkItemMasterRow[] => {
      const counters = new Map<string, number>();
      const codesSeen = new Map<string, number>();
      const out: BulkItemMasterRow[] = [];

      input.forEach((row, idx) => {
        const next: BulkItemMasterRow = { ...row, errors: [], warnings: [] };

        const cat = next.category_id ? categoryById.get(next.category_id) : null;
        const catCode = cat?.code?.trim().toUpperCase() || '';

        let autoPreview = '';
        if (catCode) {
          const startedAt = counters.get(catCode) ?? (maxByCategoryCode.get(catCode) ?? 0);
          const nextSeq = startedAt + 1;
          counters.set(catCode, nextSeq);
          autoPreview = `INV-${catCode}-${String(nextSeq).padStart(3, '0')}`;
        }
        next.auto_item_code = autoPreview;

        if (!next.code_manual) {
          next.item_code = autoPreview;
        }

        if (next.suggested_family && !next.category_id) {
          next.warnings.push(
            `Suggested category "${next.suggested_family}" — pick a tenant category.`,
          );
        }

        const hasAnyInput =
          next.name.trim() || next.description.trim() || next.brand.trim() || next.item_code;
        if (!hasAnyInput) {
          next.status = 'pending';
          out.push(next);
          return;
        }

        if (!next.name.trim()) next.errors.push('Name is required');
        if (!next.category_id) next.errors.push('Category is required');
        if (!next.unit_id) next.errors.push('UoM is required');

        if (!next.item_code) {
          if (next.category_id && !catCode) {
            next.errors.push(
              `Category "${cat?.name ?? ''}" has no 3-letter code — cannot generate item code`,
            );
          } else if (!next.category_id) {
            next.errors.push('Item code cannot be generated without a category');
          }
        } else {
          if (next.code_manual && !/^[A-Z0-9][A-Z0-9._\-/]{1,49}$/i.test(next.item_code)) {
            next.errors.push('Item code has invalid characters');
          }
          if (existingCodes.has(next.item_code.toLowerCase())) {
            next.errors.push('Item code already exists in the catalog');
          }
          const lower = next.item_code.toLowerCase();
          if (codesSeen.has(lower)) {
            next.errors.push('Duplicate item code in this batch');
          } else {
            codesSeen.set(lower, idx);
          }
        }

        if (next.status !== 'imported' && next.status !== 'error') {
          next.status = next.errors.length > 0 ? 'invalid' : 'valid';
        }

        out.push(next);
      });

      return out;
    },
    [categoryById, existingCodes, maxByCategoryCode],
  );

  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  useEffect(() => {
    setRows((prev) => recompute(prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recompute]);

  const applyPatch = useCallback(
    (rowId: string, patch: Partial<BulkItemMasterRow>) => {
      setRows((prev) => {
        const updated = prev.map((r) => {
          if (r.rowId !== rowId) return r;
          const merged: BulkItemMasterRow = { ...r, ...patch };
          if ('item_code' in patch && patch.code_manual === undefined) {
            const isAutoMatch =
              !!merged.auto_item_code &&
              merged.item_code.toUpperCase() === merged.auto_item_code.toUpperCase();
            merged.code_manual = !isAutoMatch && merged.item_code.trim().length > 0;
          }
          return merged;
        });
        return recompute(updated);
      });
    },
    [recompute],
  );

  const setRow = useCallback(
    (rowId: string, patch: Partial<BulkItemMasterRow>) => {
      if ('name' in patch && patch.name && patch.name.trim()) {
        setRows((prev) => {
          const target = prev.find((r) => r.rowId === rowId);
          if (!target) return prev;
          const cls = classifyItem({
            name: String(patch.name),
            categories: categories.map((c) => ({ id: c.id, name: c.name, code: c.code })),
            units: units.map((u) => ({ id: u.id, name: u.name, abbreviation: u.abbreviation })),
          });
          const next = prev.map((r) => {
            if (r.rowId !== rowId) return r;
            return {
              ...r,
              ...patch,
              category_id: r.category_id ?? cls.category_id,
              unit_id: r.unit_id ?? cls.unit_id,
              classify_confidence: cls.confidence,
              suggested_family: cls.category_family,
            };
          });
          return recompute(next);
        });
        return;
      }
      applyPatch(rowId, patch);
    },
    [applyPatch, categories, units, recompute],
  );

  const addRows = useCallback((n: number) => {
    setRows((prev) => recompute([...prev, ...Array.from({ length: n }, emptyRow)]));
  }, [recompute]);

  const removeRow = useCallback((rowId: string) => {
    setRows((prev) => recompute(prev.filter((r) => r.rowId !== rowId)));
  }, [recompute]);

  const clearInvalid = useCallback(() => {
    setRows((prev) => recompute(prev.filter((r) => r.status !== 'invalid')));
  }, [recompute]);

  const resetAll = useCallback(() => {
    setRows(Array.from({ length: 5 }, emptyRow));
  }, []);

  const seedFromNames = useCallback(
    (names: string[]) => {
      const clean = names.map((n) => n.trim()).filter(Boolean);
      if (clean.length === 0) return;
      setRows((prev) => {
        const placeholders = prev.filter(
          (r) => !r.name.trim() && !r.description.trim() && !r.brand.trim() && !r.code_manual,
        );
        const others = prev.filter((r) => !placeholders.includes(r));
        const placeholderQueue = [...placeholders];
        const newRows: BulkItemMasterRow[] = [];

        clean.forEach((name) => {
          const cls = classifyItem({
            name,
            categories: categories.map((c) => ({ id: c.id, name: c.name, code: c.code })),
            units: units.map((u) => ({ id: u.id, name: u.name, abbreviation: u.abbreviation })),
          });
          const base = placeholderQueue.shift() ?? emptyRow();
          newRows.push({
            ...base,
            name,
            category_id: cls.category_id,
            unit_id: cls.unit_id,
            classify_confidence: cls.confidence,
            suggested_family: cls.category_family,
          });
        });

        return recompute([...others, ...newRows, ...placeholderQueue]);
      });
    },
    [categories, units, recompute],
  );

  const autoClassifyAll = useCallback(() => {
    setRows((prev) => {
      const next = prev.map((r) => {
        if (!r.name.trim()) return r;
        const cls = classifyItem({
          name: r.name,
          categories: categories.map((c) => ({ id: c.id, name: c.name, code: c.code })),
          units: units.map((u) => ({ id: u.id, name: u.name, abbreviation: u.abbreviation })),
        });
        return {
          ...r,
          category_id: r.category_id ?? cls.category_id,
          unit_id: r.unit_id ?? cls.unit_id,
          classify_confidence: cls.confidence,
          suggested_family: cls.category_family,
        };
      });
      return recompute(next);
    });
  }, [categories, units, recompute]);

  const resetCode = useCallback(
    (rowId: string) => {
      setRows((prev) =>
        recompute(
          prev.map((r) =>
            r.rowId === rowId ? { ...r, code_manual: false, item_code: r.auto_item_code } : r,
          ),
        ),
      );
    },
    [recompute],
  );

  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = useCallback(async () => {
    const valid = rows.filter((r) => r.status === 'valid');
    if (valid.length === 0) return { ok: 0, failed: 0 };

    setIsSubmitting(true);
    try {
      const autoTargets = valid.filter((r) => !r.code_manual);
      const byCatCode = new Map<string, BulkItemMasterRow[]>();
      autoTargets.forEach((r) => {
        const cat = categoryById.get(r.category_id!);
        const code = cat?.code?.trim().toUpperCase();
        if (!code) return;
        if (!byCatCode.has(code)) byCatCode.set(code, []);
        byCatCode.get(code)!.push(r);
      });

      const finalCodes = new Map<string, string>();
      for (const [catCode, group] of byCatCode.entries()) {
        const codes = await allocateItemCodes({
          categoryCode: catCode,
          count: group.length,
          scope: 'catalog',
        });
        group.forEach((r, i) => finalCodes.set(r.rowId, codes[i]));
      }

      const payloads: Array<CreateCatalogItemData & { _rowId: string }> = valid.map((r) => {
        const code = r.code_manual ? r.item_code : (finalCodes.get(r.rowId) ?? r.item_code);
        return {
          _rowId: r.rowId,
          item_code: code,
          name: r.name.trim(),
          description: r.description.trim() || undefined,
          brand: r.brand.trim() || undefined,
          category_id: r.category_id!,
          unit_id: r.unit_id!,
          status: 'active',
        };
      });

      const insertData = payloads.map(({ _rowId, ...p }) => p);
      try {
        await bulkCreateItemsAsync(insertData);
        setRows((prev) =>
          prev.map((r) => {
            if (r.status !== 'valid') return r;
            const finalCode = payloads.find((p) => p._rowId === r.rowId)?.item_code;
            return {
              ...r,
              item_code: finalCode ?? r.item_code,
              status: 'imported' as const,
              errors: [],
            };
          }),
        );
        invalidateStock();
        toast({
          title: 'Items created',
          description: `${valid.length} item${valid.length === 1 ? '' : 's'} added to the master.`,
        });
        return { ok: valid.length, failed: 0 };
      } catch (e: any) {
        setRows((prev) =>
          prev.map((r) =>
            r.status === 'valid'
              ? { ...r, status: 'error' as const, errors: [e?.message ?? 'Insert failed'] }
              : r,
          ),
        );
        return { ok: 0, failed: valid.length };
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [rows, categoryById, bulkCreateItemsAsync, invalidateStock, toast]);

  const validCount = rows.filter((r) => r.status === 'valid').length;
  const invalidCount = rows.filter((r) => r.status === 'invalid').length;

  return {
    rows,
    setRow,
    addRows,
    removeRow,
    clearInvalid,
    resetAll,
    seedFromNames,
    autoClassifyAll,
    resetCode,
    submit,
    isSubmitting: isSubmitting || isBulkCreating,
    validCount,
    invalidCount,
    categories,
    units,
  };
}
