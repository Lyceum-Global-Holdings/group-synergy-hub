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
  depth: 0 | 1;
}

/**
 * Returns the Tools subtree (Level 0 roots + their direct Level 1 children),
 * flattened in display order with a depth marker for indentation.
 */
export function buildToolCategoryOptions(
  categories: ItemCategory[],
): ToolCategoryOption[] {
  const roots = categories.filter(
    (c) => c.code != null && (TOOL_ROOT_CODES as readonly string[]).includes(c.code),
  );

  const result: ToolCategoryOption[] = [];

  roots
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach((root) => {
      result.push({ category: root, depth: 0 });
      categories
        .filter((c) => c.parent_id === root.id)
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach((child) => result.push({ category: child, depth: 1 }));
    });

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
 * Returns just the category ids in the Tools subtree — useful for filtering
 * `warehouse_items` queries on `category_id`.
 */
export function getToolCategoryIds(categories: ItemCategory[]): string[] {
  return buildToolCategoryOptions(categories).map((o) => o.category.id);
}
