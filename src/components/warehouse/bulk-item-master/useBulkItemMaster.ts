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

  const [duplicatePolicy, setDuplicatePolicy] = useState<DuplicatePolicy>('skip');

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

  // Codes follow the standard XXX-XXX-XXX-NNNN format:
  //   INV-{PARENT_CAT}-{LEAF_CAT}-{NNNN}
  // (If the leaf category has no parent, the leaf code is used for both
  //  the second and third segments so the shape is preserved.)
  const maxByCategoryCode = useMemo(() => {
    const map = new Map<string, number>();
    existingItems.forEach((it) => {
      const code = it.item_code || '';
      // New 4-segment format
      let m = code.match(/^INV-([A-Z0-9]+)-([A-Z0-9]+)-(\d+)$/i);
      let key = '';
      let seq = NaN;
      if (m) {
        key = `${m[1].toUpperCase()}-${m[2].toUpperCase()}`;
        seq = Number(m[3]);
      } else {
        // Legacy 3-segment format INV-CAT-NNN — treat as parent=leaf=CAT
        m = code.match(/^INV-([A-Z0-9]+)-(\d+)$/i);
        if (m) {
          const cat = m[1].toUpperCase();
          key = `${cat}-${cat}`;
          seq = Number(m[2]);
        }
      }
      if (!key || !Number.isFinite(seq)) return;
      if ((map.get(key) ?? 0) < seq) map.set(key, seq);
    });
    return map;
  }, [existingItems]);

  const categoryById = useMemo(() => {
    const m = new Map<string, { id: string; name: string; code?: string | null; parent_id?: string | null }>();
    categories.forEach((c: any) => m.set(c.id, c));
    return m;
  }, [categories]);

  /** Resolve a category to its (parent3, leaf3) code pair, uppercased. */
  const resolveCategoryCodes = useCallback(
    (categoryId: string | null): { parent: string; leaf: string } | null => {
      if (!categoryId) return null;
      const leaf = categoryById.get(categoryId);
      const leafCode = leaf?.code?.trim().toUpperCase();
      if (!leafCode) return null;
      const parent = leaf?.parent_id ? categoryById.get(leaf.parent_id) : null;
      const parentCode = parent?.code?.trim().toUpperCase() || leafCode;
      return { parent: parentCode, leaf: leafCode };
    },
    [categoryById],
  );

  const recompute = useCallback(
    (input: BulkItemMasterRow[]): BulkItemMasterRow[] => {
      const counters = new Map<string, number>();
      const codesSeen = new Map<string, number>();
      const out: BulkItemMasterRow[] = [];

      input.forEach((row, idx) => {
        const next: BulkItemMasterRow = { ...row, errors: [], warnings: [] };

        const cat = next.category_id ? categoryById.get(next.category_id) : null;
        const codes = resolveCategoryCodes(next.category_id);
        const catKey = codes ? `${codes.parent}-${codes.leaf}` : '';

        let autoPreview = '';
        if (codes) {
          // Auto-generate per ISO/IEC 8000 + GS1 sequencing in the
          // standard XXX-XXX-XXX-NNNN shape: INV-{parent}-{leaf}-{NNNN}.
          // Skip any sequence already taken by the catalog or by an
          // earlier row in this batch.
          let seq = (counters.get(catKey) ?? (maxByCategoryCode.get(catKey) ?? 0)) + 1;
          for (let guard = 0; guard < 10000; guard++) {
            const candidate = `INV-${codes.parent}-${codes.leaf}-${String(seq).padStart(4, '0')}`;
            const lower = candidate.toLowerCase();
            if (!existingCodeToId.has(lower) && !codesSeen.has(lower)) {
              autoPreview = candidate;
              break;
            }
            seq += 1;
          }
          counters.set(catKey, seq);
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
          if (next.category_id && !codes) {
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
          const lower = next.item_code.toLowerCase();
          const existingId = existingCodeToId.get(lower) ?? null;
          next.existing_catalog_id = existingId;
          if (existingId) {
            if (duplicatePolicy === 'fail') {
              next.errors.push('Item code already exists in the catalog');
            } else if (duplicatePolicy === 'skip') {
              next.warnings.push('Skipped — code already exists in catalog');
            } else {
              next.warnings.push('Will update existing catalog item');
            }
          }
          if (codesSeen.has(lower)) {
            next.errors.push('Duplicate item code in this batch');
          } else {
            codesSeen.set(lower, idx);
          }
        }

        if (next.status !== 'imported' && next.status !== 'updated' && next.status !== 'error') {
          if (next.errors.length > 0) {
            next.status = 'invalid';
          } else if (next.existing_catalog_id && duplicatePolicy === 'skip') {
            next.status = 'skipped';
          } else {
            next.status = 'valid';
          }
        }

        out.push(next);
      });

      return out;
    },
    [categoryById, existingCodeToId, maxByCategoryCode, duplicatePolicy, resolveCategoryCodes],
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
            // Normalize manual codes to the canonical XXX-XXX-XXX-NNNN
            // shape: if the user typed something that matches the trailing
            // three segments (cat-sub-seq) without the leading prefix,
            // prepend "INV-" automatically.
            const raw = merged.item_code.trim().toUpperCase();
            if (/^[A-Z0-9]{2,4}-[A-Z0-9]{2,4}-\d{3,5}$/.test(raw)) {
              merged.item_code = `INV-${raw}`;
            } else {
              merged.item_code = raw;
            }
            const isAutoMatch =
              !!merged.auto_item_code &&
              merged.item_code.toUpperCase() === merged.auto_item_code.toUpperCase();
            merged.code_manual = !isAutoMatch && merged.item_code.length > 0;
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
    if (valid.length === 0) return { created: 0, updated: 0, skipped: 0, failed: 0 };

    const skippedNow = rows.filter((r) => r.status === 'skipped').length;
    const creates = valid.filter((r) => !r.existing_catalog_id);
    const updates = valid.filter((r) => !!r.existing_catalog_id);

    setIsSubmitting(true);
    try {
      // ---- allocate auto codes for creates only ----
      const autoTargets = creates.filter((r) => !r.code_manual);
      const byCatCode = new Map<string, BulkItemMasterRow[]>();
      autoTargets.forEach((r) => {
        const codes = resolveCategoryCodes(r.category_id);
        if (!codes) return;
        const key = `${codes.parent}-${codes.leaf}`;
        if (!byCatCode.has(key)) byCatCode.set(key, []);
        byCatCode.get(key)!.push(r);
      });

      const finalCodes = new Map<string, string>();
      for (const [compoundKey, group] of byCatCode.entries()) {
        const codes = await allocateItemCodes({
          categoryCode: compoundKey, // "PARENT-LEAF"
          count: group.length,
          scope: 'catalog',
          padWidth: 4,
        });
        group.forEach((r, i) => finalCodes.set(r.rowId, codes[i]));
      }

      const createPayloads: Array<CreateCatalogItemData & { _rowId: string }> = creates.map((r) => {
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

      // ---- run create + update in parallel ----
      const createPromise =
        createPayloads.length > 0
          ? bulkCreateItemsAsync(createPayloads.map(({ _rowId, ...p }) => p))
          : Promise.resolve(null);

      const updateResults = await Promise.allSettled(
        updates.map((r) =>
          updateItemAsync({
            id: r.existing_catalog_id!,
            name: r.name.trim(),
            description: r.description.trim() || undefined,
            brand: r.brand.trim() || undefined,
            category_id: r.category_id!,
            unit_id: r.unit_id!,
          } as any).then(() => r.rowId),
        ),
      );

      let createOk = false;
      let createErr: any = null;
      try {
        await createPromise;
        createOk = true;
      } catch (e) {
        createErr = e;
      }

      const updatedRowIds = new Set(
        updateResults.filter((res) => res.status === 'fulfilled').map((res: any) => res.value),
      );
      const failedUpdateIds = new Set(
        updates
          .map((r, i) => (updateResults[i].status === 'rejected' ? r.rowId : null))
          .filter((v): v is string => !!v),
      );

      setRows((prev) =>
        prev.map((r) => {
          if (r.status !== 'valid') return r;
          if (r.existing_catalog_id) {
            if (updatedRowIds.has(r.rowId)) {
              return { ...r, status: 'updated' as const, errors: [] };
            }
            if (failedUpdateIds.has(r.rowId)) {
              const res = updateResults[updates.findIndex((u) => u.rowId === r.rowId)];
              const msg = res && res.status === 'rejected' ? (res.reason?.message ?? 'Update failed') : 'Update failed';
              return { ...r, status: 'error' as const, errors: [msg] };
            }
            return r;
          }
          // create row
          if (createOk) {
            const finalCode = createPayloads.find((p) => p._rowId === r.rowId)?.item_code;
            return { ...r, item_code: finalCode ?? r.item_code, status: 'imported' as const, errors: [] };
          }
          return { ...r, status: 'error' as const, errors: [createErr?.message ?? 'Insert failed'] };
        }),
      );

      invalidateStock();

      const createdN = createOk ? createPayloads.length : 0;
      const updatedN = updatedRowIds.size;
      const failedN = (createOk ? 0 : createPayloads.length) + failedUpdateIds.size;

      const parts: string[] = [];
      if (createdN) parts.push(`Imported ${createdN}`);
      if (updatedN) parts.push(`updated ${updatedN}`);
      if (skippedNow) parts.push(`skipped ${skippedNow}`);
      if (failedN) parts.push(`failed ${failedN}`);
      toast({
        title: failedN > 0 ? 'Completed with errors' : 'Items processed',
        description: parts.join(', ') || 'Nothing to do',
        variant: failedN > 0 ? 'destructive' : undefined,
      });

      return { created: createdN, updated: updatedN, skipped: skippedNow, failed: failedN };
    } finally {
      setIsSubmitting(false);
    }
  }, [rows, categoryById, bulkCreateItemsAsync, updateItemAsync, invalidateStock, toast]);

  const validCount = rows.filter((r) => r.status === 'valid').length;
  const invalidCount = rows.filter((r) => r.status === 'invalid').length;
  const skippedCount = rows.filter((r) => r.status === 'skipped').length;

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
    skippedCount,
    duplicatePolicy,
    setDuplicatePolicy,
    categories,
    units,
  };
}
