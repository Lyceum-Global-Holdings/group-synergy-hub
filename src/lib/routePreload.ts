/**
 * Centralized route preloading.
 *
 * The sidebar calls `preloadRoute(path)` on hover/focus so the page's JS
 * chunk starts downloading before the user actually clicks. By the time
 * the click lands, the dynamic import usually resolves from cache and
 * navigation feels instant.
 *
 * Each loader here mirrors a `React.lazy(() => import(...))` in App.tsx.
 * Vite/Rollup deduplicate the resulting chunks, so duplicating the import
 * specifier here costs nothing at runtime.
 */

type Loader = () => Promise<unknown>;

// Path prefix → loader. Longest prefix wins so dynamic segments still match
// (e.g. /tuh-modules/customer-po/:cpoId matches /tuh-modules/customer-po).
const loaders: Array<[string, Loader]> = [
  ["/", () => import("@/pages/Dashboard")],

  // Admin
  ["/admin/companies", () => import("@/pages/admin/CompanyManagement")],
  ["/admin/users-roles", () => import("@/pages/admin/UserRoleManagement")],
  ["/admin/modules", () => import("@/pages/admin/ModuleAllocation")],
  ["/admin/warehouse-management", () => import("@/pages/admin/WarehouseManagement")],
  ["/admin/backend", () => import("@/pages/admin/BackendDashboard")],
  ["/admin/test-environment", () => import("@/pages/admin/test-environment/TestEnvironmentPage")],
  ["/admin/performance", () => import("@/pages/admin/PerformanceDashboard")],
  ["/admin/security", () => import("@/pages/admin/SecuritySettings")],
  ["/admin/telegram-reports", () => import("@/pages/admin/TelegramReports")],
  ["/admin/training/module-trainings", () => import("@/pages/admin/training/ModuleTrainings")],
  ["/admin/training/video-library", () => import("@/pages/admin/training/VideoLibrary")],
  ["/admin/training/documentation", () => import("@/pages/admin/training/Documentation")],
  ["/admin/training/training-progress", () => import("@/pages/admin/training/TrainingProgress")],
  ["/admin/training", () => import("@/pages/admin/Training")],

  // Procurement
  ["/procurement/purchase-requisition", () => import("@/pages/procurement/PurchaseRequisition")],
  ["/procurement/purchase-order", () => import("@/pages/procurement/PurchaseOrder")],
  ["/procurement/bill-of-materials", () => import("@/pages/procurement/BillOfMaterials")],
  ["/procurement/material-demand", () => import("@/pages/procurement/MaterialDemandPlanning")],
  ["/procurement/rfq-rfp", () => import("@/pages/sourcing/RfqManagement")],
  ["/procurement/blanket-po", () => import("@/pages/procurement/BlanketPurchaseOrder")],
  ["/procurement/po-amendment", () => import("@/pages/procurement/PoAmendment")],
  ["/procurement/three-way-match", () => import("@/pages/procurement/ThreeWayMatch")],
  ["/procurement/catalogs", () => import("@/pages/procurement/Catalogs")],
  ["/procurement/price-lists", () => import("@/pages/procurement/PriceLists")],

  // TUH modules
  ["/tuh-modules/bill-of-materials", () => import("@/pages/procurement/BillOfMaterials")],
  ["/tuh-modules/customer-master", () => import("@/pages/tuh-modules/CustomerMaster")],
  ["/tuh-modules/customer-po", () => import("@/pages/tuh-modules/CustomerPO")],

  // Warehouse
  ["/warehouse/item-bin-master", () => import("@/pages/warehouse/ItemBinMaster")],
  ["/warehouse/putaway", () => import("@/pages/warehouse/Putaway")],
  ["/warehouse/pick-pack", () => import("@/pages/warehouse/PickPackDispatch")],
  ["/warehouse/material-issue", () => import("@/pages/warehouse/MaterialIssueReturn")],
  ["/warehouse/stock-transfer", () => import("@/pages/warehouse/StockTransfer")],
  ["/warehouse/cycle-count", () => import("@/pages/warehouse/CycleCount")],
  ["/warehouse/stock-adjustment", () => import("@/pages/warehouse/StockAdjustment")],
  ["/warehouse/grn", () => import("@/pages/warehouse/GoodsReceiptNote")],
  ["/warehouse/delivery-order", () => import("@/pages/warehouse/DeliveryOrder")],
  ["/warehouse/inventory-valuation", () => import("@/pages/warehouse/InventoryValuation")],
  ["/warehouse/asset-management", () => import("@/pages/warehouse/AssetManagement")],
  ["/warehouse/tool-management", () => import("@/pages/warehouse/ToolManagement")],
  ["/warehouse/inventory", () => import("@/pages/warehouse/Inventory")],
  ["/warehouse/stock-audit", () => import("@/pages/warehouse/StockAudit")],
  ["/warehouse/bin-allocations", () => import("@/pages/warehouse/BinAllocations")],
  ["/warehouse/batch-management", () => import("@/pages/warehouse/BatchManagement")],
  ["/warehouse/partial-quantities", () => import("@/pages/warehouse/PartialQuantities")],
  ["/warehouse/network", () => import("@/pages/warehouse/WarehouseNetwork")],

  // Sourcing
  ["/sourcing/supplier-master", () => import("@/pages/sourcing/SupplierMaster")],
  ["/sourcing/supplier-allocation", () => import("@/pages/sourcing/SupplierAllocation")],
  ["/sourcing/supplier-registration", () => import("@/pages/sourcing/SupplierRegistration")],
  ["/sourcing/supplier-evaluation", () => import("@/pages/sourcing/SupplierEvaluation")],
  ["/sourcing/rfq-management", () => import("@/pages/sourcing/RfqManagement")],
  ["/sourcing/quotation-comparison", () => import("@/pages/sourcing/QuotationComparison")],
  ["/sourcing/supplier-scorecard", () => import("@/pages/sourcing/SupplierScorecard")],
  ["/sourcing/contracts", () => import("@/pages/sourcing/Contracts")],
  ["/sourcing/blacklist", () => import("@/pages/sourcing/SupplierBlacklist")],

  // Production
  ["/production", () => import("@/pages/production/ProductionModule")],

  // Finance (single page; all subpaths share chunk)
  ["/finance", () => import("@/pages/Accounting")],

  // Sales / TUH extras
  ["/tuh-modules/finished-goods", () => import("@/pages/tuh-modules/FinishedGoods")],

  // Management
  ["/management/dashboards", () => import("@/pages/management/DashboardsKPIs")],
  ["/management/approvals", () => import("@/pages/management/ApprovalConsole")],
  ["/management/audit-logs", () => import("@/pages/management/AuditLogs")],
  ["/management/budget-actual", () => import("@/pages/management/BudgetVsActual")],
  ["/management/exceptions", () => import("@/pages/management/Exceptions")],
  ["/management/reports", () => import("@/pages/management/ReportsCenter")],

  // Construction (paths mirror App.tsx routes)
  ["/construction/project-master", () => import("@/pages/construction/ProjectMaster")],
  ["/construction/work-orders", () => import("@/pages/construction/WorkOrders")],
  ["/construction/site-management", () => import("@/pages/construction/SiteManagement")],
  ["/construction/progress-tracking", () => import("@/pages/construction/ProgressTracking")],
  ["/construction/daily-reports", () => import("@/pages/construction/DailySiteReports")],
  ["/construction/resource-allocation/labour", () => import("@/pages/construction/resources/LabourResources")],
  ["/construction/resource-allocation/inventory", () => import("@/pages/construction/resources/InventoryItems")],
  ["/construction/resource-allocation/subcontractors", () => import("@/pages/construction/resources/SubcontractorResources")],
  ["/construction/resource-allocation", () => import("@/pages/construction/ResourceAllocation")],
  ["/construction/quality-control", () => import("@/pages/construction/QualityControl")],
  ["/construction/safety-management", () => import("@/pages/construction/SafetyManagement")],
  ["/construction/reports-analytics", () => import("@/pages/construction/ReportsAnalytics")],
  ["/construction/project-documents", () => import("@/pages/construction/ProjectDocuments")],
  ["/construction/project-budgeting", () => import("@/pages/construction/ProjectBudgeting")],

  // Social media
  ["/social-media/accounts", () => import("@/pages/social-media/AccountRegistry")],
  ["/social-media/access", () => import("@/pages/social-media/AccessManagement")],
  ["/social-media/nda-compliance", () => import("@/pages/social-media/NDACompliance")],
  ["/social-media/activity-log", () => import("@/pages/social-media/ActivityLog")],
];

// Index sorted longest-first so `/admin/training/module-trainings` matches
// before `/admin/training`.
const sortedLoaders = [...loaders].sort((a, b) => b[0].length - a[0].length);

const inflight = new Set<string>();

function runLoader(key: string, loader: Loader) {
  if (inflight.has(key)) return;
  inflight.add(key);
  // Errors here are non-fatal — actual navigation will surface them.
  loader().catch(() => inflight.delete(key));
}

/** Trigger the dynamic import for a route path (called on hover/focus). */
export function preloadRoute(path: string): void {
  if (!path) return;
  for (const [prefix, loader] of sortedLoaders) {
    if (prefix === "/" ? path === "/" : path === prefix || path.startsWith(prefix + "/")) {
      runLoader(prefix, loader);
      return;
    }
  }
}

/**
 * Warm the most-used pages during idle time after first paint.
 * Cheap: each loader is just a fetch + parse, browser will skip if cached.
 */
export function prefetchCommonRoutesOnIdle(): void {
  if (typeof window === "undefined") return;
  const idle: (cb: () => void) => void =
    (window as any).requestIdleCallback?.bind(window) ??
    ((cb: () => void) => setTimeout(cb, 1500));

  idle(() => {
    [
      "/warehouse/inventory",
      "/warehouse/grn",
      "/warehouse/item-bin-master",
      "/procurement/purchase-order",
      "/management/approvals",
    ].forEach(preloadRoute);
  });
}

/**
 * Idle-warm the sibling routes most likely to be visited next, based on
 * the current path. Cheap because each loader resolves from cache after
 * the first call. Keeps total prefetch traffic bounded to one module group.
 */
const NEIGHBORS: Array<[string, string[]]> = [
  [
    "/warehouse",
    [
      "/warehouse/inventory",
      "/warehouse/item-bin-master",
      "/warehouse/bin-allocations",
      "/warehouse/grn",
      "/warehouse/material-issue",
      "/warehouse/stock-transfer",
    ],
  ],
  [
    "/admin",
    [
      "/admin/backend",
      "/admin/users-roles",
      "/admin/companies",
      "/admin/modules",
      "/admin/warehouse-management",
    ],
  ],
  [
    "/procurement",
    [
      "/procurement/purchase-requisition",
      "/procurement/purchase-order",
      "/procurement/three-way-match",
    ],
  ],
  [
    "/construction",
    [
      "/construction/project-master",
      "/construction/site-management",
      "/construction/daily-reports",
    ],
  ],
];

export function prefetchNeighborRoutesOnIdle(currentPath: string): void {
  if (typeof window === "undefined" || !currentPath) return;
  const group = NEIGHBORS.find(([prefix]) => currentPath.startsWith(prefix));
  if (!group) return;
  const idle: (cb: () => void) => void =
    (window as any).requestIdleCallback?.bind(window) ??
    ((cb: () => void) => setTimeout(cb, 1500));
  idle(() => group[1].forEach(preloadRoute));
}

