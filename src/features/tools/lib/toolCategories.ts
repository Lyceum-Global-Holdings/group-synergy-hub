import type { ItemCategory } from '@/types/itemBin';

/**
 * Tool category roots (Hand Tools, Power Tools) — referenced by mnemonic
 * code so this remains stable across companies/environments.
 *
 * Standards alignment:
 *  - SAP MM "Material → Equipment" promotion pattern (reuse master data)
 *  - ISO 55000 single source of truth for asset master data
 */
export const TOOL_ROOT_CODES = ['TOO-HND', 'TOO-PWR'] as const;

export interface ToolCategoryOption {
  category: ItemCategory;
  /** Visual indentation depth — capped at 2 in the picker for readability. */
  depth: 0 | 1 | 2;
}

/**
 * Returns the Tools subtree (Level 0 roots + ALL descendants at any depth),
 * flattened in display order with a depth marker for indentation.
 *
 * Phase 9: previously only included direct children, which silently dropped
 * deep tool categories (e.g. TOO-HND-HAM/specialty leaves). The picker now
 * walks the parent_id graph recursively.
 */
export function buildToolCategoryOptions(
  categories: ItemCategory[],
): ToolCategoryOption[] {
  const roots = categories.filter(
    (c) => c.code != null && (TOOL_ROOT_CODES as readonly string[]).includes(c.code),
  );

  // Index children by parent_id for O(N) traversal across the whole tree.
  const childrenByParent = new Map<string, ItemCategory[]>();
  categories.forEach((c) => {
    if (!c.parent_id) return;
    const arr = childrenByParent.get(c.parent_id);
    if (arr) arr.push(c);
    else childrenByParent.set(c.parent_id, [c]);
  });

  const result: ToolCategoryOption[] = [];

  const walk = (node: ItemCategory, depth: 0 | 1 | 2) => {
    result.push({ category: node, depth });
    const kids = (childrenByParent.get(node.id) ?? [])
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));
    const nextDepth: 0 | 1 | 2 = depth >= 2 ? 2 : ((depth + 1) as 1 | 2);
    kids.forEach((k) => walk(k, nextDepth));
  };

  roots
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach((root) => walk(root, 0));

  return result;
}

/**
 * Quick membership check — true if the given category id is in the Tools subtree.
 */
export function isToolCategoryId(
  id: string | null | undefined,
  categories: ItemCategory[],
): boolean {
  if (!id) return false;
  return buildToolCategoryOptions(categories).some((o) => o.category.id === id);
}

/**
 * Returns ids for the entire Tools subtree (roots + every descendant).
 * Used by the candidate RPC to filter `warehouse_item_catalog.category_id`
 * with an exact `= ANY(...)` predicate, so deep leaves must be enumerated.
 */
export function getToolCategoryIds(categories: ItemCategory[]): string[] {
  return buildToolCategoryOptions(categories).map((o) => o.category.id);
}
