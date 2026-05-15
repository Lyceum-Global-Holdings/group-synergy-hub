import type { WarehouseLocation } from '@/types/warehouse';

export interface LocationOption {
  location: WarehouseLocation;
  depth: 0 | 1 | 2;
  /** Pre-formatted breadcrumb label, e.g. "LNNB › 9th Floor" */
  breadcrumb: string;
}

const TYPE_RANK: Record<string, number> = {
  location: 0,
  sublocation: 1,
  department: 2,
};

/**
 * Build a flat, indented option list of warehouse locations covering all
 * hierarchy levels (location → sublocation → department).
 *
 * Mirrors SAP EWM storage-type / GS1 sub-GLN semantics: every level is a
 * first-class storage target. Use in pickers where the user must be able to
 * place stock at the exact level they intend (parent OR child OR grandchild).
 */
export function buildLocationOptions(
  locations: WarehouseLocation[],
  opts: { activeOnly?: boolean } = {},
): LocationOption[] {
  const { activeOnly = false } = opts;
  const pool = activeOnly
    ? locations.filter((l) => (l.status ?? 'active') === 'active')
    : locations.slice();

  const byId = new Map(pool.map((l) => [l.id, l] as const));
  const childrenOf = new Map<string | null, WarehouseLocation[]>();
  for (const loc of pool) {
    const key = loc.parent_id ?? null;
    if (!childrenOf.has(key)) childrenOf.set(key, []);
    childrenOf.get(key)!.push(loc);
  }
  for (const arr of childrenOf.values()) {
    arr.sort((a, b) => a.name.localeCompare(b.name));
  }

  const result: LocationOption[] = [];

  const walk = (parentId: string | null, depth: 0 | 1 | 2, trail: string[]) => {
    const kids = childrenOf.get(parentId) ?? [];
    for (const loc of kids) {
      const label = loc.location_code ? `${loc.name} (${loc.location_code})` : loc.name;
      const nextTrail = [...trail, label];
      result.push({
        location: loc,
        depth,
        breadcrumb: nextTrail.join(' › '),
      });
      if (depth < 2) {
        walk(loc.id, (depth + 1) as 0 | 1 | 2, nextTrail);
      }
    }
  };

  // Roots: any node whose parent_id is null OR whose parent isn't in the pool.
  const roots = pool
    .filter((l) => !l.parent_id || !byId.has(l.parent_id))
    .sort((a, b) => {
      const ra = TYPE_RANK[a.type ?? 'location'] ?? 0;
      const rb = TYPE_RANK[b.type ?? 'location'] ?? 0;
      if (ra !== rb) return ra - rb;
      return a.name.localeCompare(b.name);
    });

  for (const root of roots) {
    const label = root.location_code ? `${root.name} (${root.location_code})` : root.name;
    result.push({ location: root, depth: 0, breadcrumb: label });
    walk(root.id, 1, [label]);
  }

  return result;
}

export function locationTypeLabel(type: string | null | undefined): string {
  switch (type) {
    case 'sublocation':
      return 'Sub-location';
    case 'department':
      return 'Department';
    case 'location':
    default:
      return 'Location';
  }
}
