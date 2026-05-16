/**
 * Stage 6b helper: PostgREST embeds of `warehouse_items` now nest the
 * master attributes under `catalog`. Flatten them back onto the parent so
 * existing consumers (`wi.item_code`, `wi.name`, …) keep working.
 */
export function flattenCatalog<T extends Record<string, any> | null | undefined>(wi: T): T {
  if (!wi) return wi;
  const catalog = (wi as any).catalog ?? (wi as any).catalog_item;
  if (!catalog) return wi;
  const { catalog: _c, catalog_item: _ci, ...rest } = wi as any;
  return { ...catalog, ...rest } as T;
}

/** Map a row that has a single `warehouse_item` embed. */
export function flattenWarehouseItem<R extends { warehouse_item?: any }>(row: R): R {
  if (!row) return row;
  return { ...row, warehouse_item: flattenCatalog(row.warehouse_item) } as R;
}

/** Same as above for `warehouse_items` (plural pluck convention) */
export function flattenWarehouseItems<R extends { warehouse_items?: any }>(row: R): R {
  if (!row) return row;
  return { ...row, warehouse_items: flattenCatalog(row.warehouse_items) } as R;
}
