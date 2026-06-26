import type { Costume } from "@/types/costumeRental";

export interface SizeOption {
  size: string; // "" = unspecified
  total: number; // non-retired units
  available: number; // status === 'available'
}

// Derive the size variants of a costume from its physical units, with counts.
export function costumeSizeOptions(costume?: Costume | null): SizeOption[] {
  const units = costume?.units ?? [];
  const map = new Map<string, SizeOption>();
  for (const u of units) {
    const size = u.size ?? "";
    const cur = map.get(size) ?? { size, total: 0, available: 0 };
    if (u.status !== "retired") cur.total += 1;
    if (u.status === "available") cur.available += 1;
    map.set(size, cur);
  }
  return Array.from(map.values()).sort((a, b) => a.size.localeCompare(b.size));
}

export const sizeLabel = (size: string) => (size === "" ? "One size" : size);
