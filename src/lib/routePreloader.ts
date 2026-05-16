/**
 * Stage 2 — Route-aware preloader.
 *
 * When a user hovers / focuses a sidebar link, we kick off the dynamic import
 * for the destination route's chunk so it's already in the browser cache by
 * the time they click. This cuts perceived LCP on navigation, especially for
 * the heavy warehouse and finance pages.
 *
 * Standards reference: Chrome "speculation rules" / W3C Resource Hints —
 * `modulepreload` semantics, but driven by user intent (hover/focus) so we
 * never waste bandwidth on links the user doesn't engage with.
 *
 * Keep this map narrow: only the top hot routes. Anything not listed falls
 * back to the existing React `lazy()` import on click — same as before, no
 * regression.
 */

type Loader = () => Promise<unknown>;

// Map the longest matching prefix to its lazy import. Webpack/Vite dedupe
// repeated dynamic imports, so calling these on hover is cheap.
const PRELOADERS: Array<[string, Loader]> = [
  ["/warehouse/inventory", () => import("@/pages/warehouse/Inventory")],
  ["/warehouse/bin-allocations", () => import("@/pages/warehouse/BinAllocations")],
  ["/warehouse/grn", () => import("@/pages/warehouse/GRN")],
  ["/warehouse/item-bin-master", () => import("@/pages/warehouse/ItemBinMaster")],
  ["/warehouse/batch-management", () => import("@/pages/warehouse/BatchManagement")],
  ["/warehouse/stock-audit", () => import("@/pages/warehouse/StockAudit")],
  ["/warehouse/partial-quantities", () => import("@/pages/warehouse/PartialQuantities")],
  ["/sourcing/supplier-registration", () => import("@/pages/sourcing/SupplierRegistration")],
];

const seen = new Set<string>();

export function preloadRoute(path: string): void {
  if (typeof window === "undefined") return;
  // Respect users on metered or save-data connections.
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (conn?.saveData) return;

  for (const [prefix, loader] of PRELOADERS) {
    if (path === prefix || path.startsWith(prefix + "/")) {
      if (seen.has(prefix)) return;
      seen.add(prefix);
      // Fire-and-forget. Swallow errors so a failed preload never surfaces
      // — the real navigation will retry with proper error handling.
      loader().catch(() => seen.delete(prefix));
      return;
    }
  }
}
