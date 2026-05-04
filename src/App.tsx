// App version: 1.0.2 - Code splitting for performance
import { Suspense, lazy } from "react";

// Auto-recover from stale chunk references after a new deploy.
// When index.html is cached but references chunks that no longer exist,
// dynamic imports throw "Failed to fetch dynamically imported module".
// We reload once to pick up the fresh index.html + chunk hashes.
if (typeof window !== "undefined") {
  const handleChunkError = (message: string | undefined) => {
    if (!message) return;
    const isChunkError =
      message.includes("Failed to fetch dynamically imported module") ||
      message.includes("Importing a module script failed") ||
      message.includes("error loading dynamically imported module");
    if (!isChunkError) return;
    const key = "__chunk_reload_attempt__";
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    window.location.reload();
  };
  window.addEventListener("error", (e) => handleChunkError(e.message));
  window.addEventListener("unhandledrejection", (e) =>
    handleChunkError(e.reason?.message ?? String(e.reason ?? ""))
  );
  // Clear the reload guard after a successful load.
  window.addEventListener("load", () => {
    setTimeout(() => sessionStorage.removeItem("__chunk_reload_attempt__"), 2000);
  });
}

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Outlet, useLocation } from "react-router-dom";
import { useEffect } from "react";
import ScrollToTop from "@/components/layout/ScrollToTop";
import { AuthProvider } from "@/contexts/AuthContext";
import { CompanyProvider } from "@/contexts/CompanyContext";
import { LocationFilterProvider } from "@/contexts/LocationFilterContext";
import ProtectedRoute from "./components/common/ProtectedRoute";
import { AdminRoute } from "./components/auth/AdminRoute";
import { SuperAdminRoute } from "./components/auth/SuperAdminRoute";
import AppLayout from "./components/layout/AppLayout";
import { Loader2 } from "lucide-react";
import { PerfOverlay } from "@/components/dev/PerfOverlay";
import { markRouteChange } from "@/lib/perfTelemetry";

// Lazy load all page components for code splitting
const Dashboard = lazy(() => import("./pages/Dashboard"));
const CompanyManagement = lazy(() => import("./pages/admin/CompanyManagement"));
const UserRoleManagement = lazy(() => import("./pages/admin/UserRoleManagement"));
const ModuleAllocation = lazy(() => import("./pages/admin/ModuleAllocation"));
const WarehouseManagement = lazy(() => import("./pages/admin/WarehouseManagement"));
const BackendDashboard = lazy(() => import("./pages/admin/BackendDashboard"));
const PurchaseRequisition = lazy(() => import("./pages/procurement/PurchaseRequisition"));
const PurchaseOrder = lazy(() => import("./pages/procurement/PurchaseOrder"));
const BillOfMaterials = lazy(() => import("./pages/procurement/BillOfMaterials"));
const CustomerMaster = lazy(() => import("./pages/tuh-modules/CustomerMaster"));
const CustomerPO = lazy(() => import("./pages/tuh-modules/CustomerPO"));
const CustomerPoView = lazy(() => import("./pages/tuh-modules/CustomerPoView"));
const MaterialDemandPlanning = lazy(() => import("./pages/procurement/MaterialDemandPlanning"));
const RfqRfp = lazy(() => import("./pages/procurement/RfqRfp"));
const BlanketPurchaseOrder = lazy(() => import("./pages/procurement/BlanketPurchaseOrder"));
const StockAdjustment = lazy(() => import("./pages/warehouse/StockAdjustment"));
const SupplierMaster = lazy(() => import("./pages/sourcing/SupplierMaster").then(m => ({ default: m.SupplierMaster })));
const SupplierAllocation = lazy(() => import("./pages/sourcing/SupplierAllocation"));
const SupplierScorecard = lazy(() => import("./pages/sourcing/SupplierScorecard"));
const SupplierEvaluation = lazy(() => import("./pages/sourcing/SupplierEvaluation"));
const SupplierRegistration = lazy(() => import("./pages/sourcing/SupplierRegistration"));
const PublicSupplierRegistration = lazy(() => import("./pages/PublicSupplierRegistration"));
const Contracts = lazy(() => import("./pages/sourcing/Contracts"));
const SupplierBlacklist = lazy(() => import("./pages/sourcing/SupplierBlacklist"));
const AssetManagement = lazy(() => import("./pages/warehouse/AssetManagement"));
const ItemBinMaster = lazy(() => import("./pages/warehouse/ItemBinMaster"));
const MaterialIssueReturn = lazy(() => import("./pages/warehouse/MaterialIssueReturn"));
const FinishedGoods = lazy(() => import("./pages/tuh-modules/FinishedGoods"));
const PickPackDispatch = lazy(() => import("./pages/warehouse/PickPackDispatch"));
const Putaway = lazy(() => import("./pages/warehouse/Putaway"));
const StockTransfer = lazy(() => import("./pages/warehouse/StockTransfer"));
const CycleCount = lazy(() => import("./pages/warehouse/CycleCount"));
const DeliveryOrder = lazy(() => import("./pages/warehouse/DeliveryOrder"));
const GoodsReceiptNote = lazy(() => import("./pages/warehouse/GoodsReceiptNote"));
const InventoryValuation = lazy(() => import("./pages/warehouse/InventoryValuation"));
const BatchManagement = lazy(() => import("./pages/warehouse/BatchManagement"));
const PublicAssetView = lazy(() => import("./pages/PublicAssetView"));
const ToolManagement = lazy(() => import("./pages/warehouse/ToolManagement"));
const PoEmailApproval = lazy(() => import("./pages/procurement/PoEmailApproval"));
const Accounting = lazy(() => import("./pages/Accounting"));
const Auth = lazy(() => import("./pages/Auth"));
const MfaChallenge = lazy(() => import("./pages/auth/MfaChallenge"));
const MfaSetup = lazy(() => import("./pages/auth/MfaSetup"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Training = lazy(() => import("./pages/admin/Training"));
const ModuleTrainings = lazy(() => import("./pages/admin/training/ModuleTrainings"));
const VideoLibrary = lazy(() => import("./pages/admin/training/VideoLibrary"));
const Documentation = lazy(() => import("./pages/admin/training/Documentation"));
const TrainingProgress = lazy(() => import("./pages/admin/training/TrainingProgress"));
const DashboardsKPIs = lazy(() => import("./pages/management/DashboardsKPIs"));
const DashboardView = lazy(() => import("./pages/management/DashboardView"));
const DashboardEdit = lazy(() => import("./pages/management/DashboardEdit"));
const ApprovalConsole = lazy(() => import("./pages/management/ApprovalConsole"));
const ProjectMaster = lazy(() => import("./pages/construction/ProjectMaster"));
const WorkOrders = lazy(() => import("./pages/construction/WorkOrders"));
const SiteManagement = lazy(() => import("./pages/construction/SiteManagement"));
const ProgressTracking = lazy(() => import("./pages/construction/ProgressTracking"));
const DailySiteReports = lazy(() => import("./pages/construction/DailySiteReports"));
const ResourceAllocation = lazy(() => import("./pages/construction/ResourceAllocation"));
const LabourResources = lazy(() => import("./pages/construction/resources/LabourResources"));
const InventoryItems = lazy(() => import("./pages/construction/resources/InventoryItems"));
const SubcontractorResources = lazy(() => import("./pages/construction/resources/SubcontractorResources"));
const QualityControl = lazy(() => import("./pages/construction/QualityControl"));
const SafetyManagement = lazy(() => import("./pages/construction/SafetyManagement"));
const ProductionModule = lazy(() => import("./pages/production/ProductionModule"));

// Missing module pages
const RfqManagement = lazy(() => import("./pages/sourcing/RfqManagement"));
const QuotationComparison = lazy(() => import("./pages/sourcing/QuotationComparison"));
const PoAmendment = lazy(() => import("./pages/procurement/PoAmendment"));
const ThreeWayMatch = lazy(() => import("./pages/procurement/ThreeWayMatch"));
const Catalogs = lazy(() => import("./pages/procurement/Catalogs"));
const PriceLists = lazy(() => import("./pages/procurement/PriceLists"));
const AuditLogs = lazy(() => import("./pages/management/AuditLogs"));
const BudgetVsActual = lazy(() => import("./pages/management/BudgetVsActual"));
const Exceptions = lazy(() => import("./pages/management/Exceptions"));
const ReportsCenter = lazy(() => import("./pages/management/ReportsCenter"));
const SocialMediaAccounts = lazy(() => import("./pages/social-media/AccountRegistry"));
const SocialMediaAccess = lazy(() => import("./pages/social-media/AccessManagement"));
const SocialMediaNDA = lazy(() => import("./pages/social-media/NDACompliance"));
const SocialMediaActivityLog = lazy(() => import("./pages/social-media/ActivityLog"));
const TestEnvironmentPage = lazy(() => import("./pages/admin/test-environment/TestEnvironmentPage"));
const PerformanceDashboard = lazy(() => import("./pages/admin/PerformanceDashboard"));

// Phase 5 — fires markRouteChange on every SPA navigation so vitals tag the right route.
function RouteChangeTracker() {
  const location = useLocation();
  useEffect(() => {
    markRouteChange(location.pathname);
  }, [location.pathname]);
  return null;
}

// Tiered freshness policy: stale-while-revalidate by default for performance.
// Live-critical hooks (stock, approvals, dashboards/KPIs) opt into staleTime:0
// per-hook. Realtime subscriptions remain authoritative for cross-tab updates.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000, // 30s SWR window cuts duplicate refetches on navigation
      gcTime: 5 * 60 * 1000, // Keep unused data 5 min for quick back-navigation
      refetchOnWindowFocus: false, // Disabled globally; per-hook opt-in if needed
      refetchOnMount: true, // Refetch on mount only when stale
    },
  },
});

// Loading fallback component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

// Protected layout wrapper component
const ProtectedLayout = () => (
  <AuthProvider>
    <ProtectedRoute>
      <CompanyProvider>
        <LocationFilterProvider>
          <AppLayout>
            <Suspense fallback={<PageLoader />}>
              <Outlet />
            </Suspense>
          </AppLayout>
        </LocationFilterProvider>
      </CompanyProvider>
    </ProtectedRoute>
  </AuthProvider>
);

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ScrollToTop />
          <RouteChangeTracker />
          <PerfOverlay />
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Public routes - no auth required */}
              <Route path="/auth" element={
                <AuthProvider>
                  <Auth />
                </AuthProvider>
              } />
              <Route path="/asset/:assetId" element={<PublicAssetView />} />
              <Route path="/register-supplier" element={<PublicSupplierRegistration />} />
              <Route path="/procurement/po-email-approval" element={<PoEmailApproval />} />
              
              {/* Protected routes - all wrapped with auth/company context */}
              <Route element={<ProtectedLayout />}>
                <Route path="/" element={<Dashboard />} />
                
                {/* Admin routes - protected by AdminRoute */}
                <Route path="/admin/companies" element={<AdminRoute><CompanyManagement /></AdminRoute>} />
                <Route path="/admin/users-roles" element={<AdminRoute><UserRoleManagement /></AdminRoute>} />
                <Route path="/admin/modules" element={<AdminRoute><ModuleAllocation /></AdminRoute>} />
                <Route path="/admin/warehouse-management" element={<AdminRoute><WarehouseManagement /></AdminRoute>} />
                <Route path="/admin/backend" element={<SuperAdminRoute><BackendDashboard /></SuperAdminRoute>} />
                <Route path="/admin/test-environment" element={<SuperAdminRoute><TestEnvironmentPage /></SuperAdminRoute>} />
                <Route path="/admin/performance" element={<AdminRoute><PerformanceDashboard /></AdminRoute>} />
                <Route path="/admin/training" element={<Training />} />
                <Route path="/admin/training/module-trainings" element={<ModuleTrainings />} />
                <Route path="/admin/training/video-library" element={<VideoLibrary />} />
                <Route path="/admin/training/documentation" element={<Documentation />} />
                <Route path="/admin/training/training-progress" element={<TrainingProgress />} />
                <Route path="/procurement/purchase-requisition" element={<PurchaseRequisition />} />
                <Route path="/procurement/purchase-order" element={<PurchaseOrder />} />
                <Route path="/tuh-modules/bill-of-materials" element={<BillOfMaterials />} />
                <Route path="/tuh-modules/customer-master" element={<CustomerMaster />} />
                <Route path="/tuh-modules/customer-po" element={<CustomerPO />} />
                <Route path="/tuh-modules/customer-po/:cpoId" element={<CustomerPoView />} />
                <Route path="/procurement/bill-of-materials" element={<BillOfMaterials />} />
                <Route path="/procurement/material-demand" element={<MaterialDemandPlanning />} />
                <Route path="/procurement/rfq-rfp" element={<RfqRfp />} />
                <Route path="/procurement/blanket-po" element={<BlanketPurchaseOrder />} />
                <Route path="/warehouse/stock-adjustment" element={<StockAdjustment />} />
                <Route path="/warehouse/grn" element={<GoodsReceiptNote />} />
                <Route path="/sourcing/supplier-master" element={<SupplierMaster />} />
                <Route path="/sourcing/supplier-allocation" element={<SupplierAllocation />} />
                <Route path="/sourcing/supplier-scorecard" element={<SupplierScorecard />} />
                <Route path="/sourcing/supplier-evaluation" element={<SupplierEvaluation />} />
                <Route path="/sourcing/supplier-registration" element={<SupplierRegistration />} />
                <Route path="/sourcing/contracts" element={<Contracts />} />
                <Route path="/sourcing/blacklist" element={<SupplierBlacklist />} />
                <Route path="/warehouse/asset-management" element={<AssetManagement />} />
                <Route path="/warehouse/tool-management" element={<ToolManagement />} />
                <Route path="/warehouse/item-bin-master" element={<ItemBinMaster />} />
                <Route path="/warehouse/material-issue" element={<MaterialIssueReturn />} />
                <Route path="/tuh-modules/finished-goods" element={<FinishedGoods />} />
                <Route path="/warehouse/pick-pack" element={<PickPackDispatch />} />
                <Route path="/warehouse/putaway" element={<Putaway />} />
                <Route path="/warehouse/stock-transfer" element={<StockTransfer />} />
                <Route path="/warehouse/cycle-count" element={<CycleCount />} />
                <Route path="/warehouse/delivery-order" element={<DeliveryOrder />} />
                <Route path="/warehouse/inventory-valuation" element={<InventoryValuation />} />
                <Route path="/warehouse/batch-management" element={<BatchManagement />} />
                <Route path="/finance" element={<Accounting />} />
                <Route path="/finance/*" element={<Accounting />} />
                <Route path="/management/dashboards" element={<DashboardsKPIs />} />
                <Route path="/management/dashboards/:id/edit" element={<DashboardEdit />} />
                <Route path="/management/dashboards/:id" element={<DashboardView />} />
                <Route path="/management/approvals" element={<ApprovalConsole />} />
                <Route path="/management/audit-logs" element={<AuditLogs />} />
                <Route path="/management/budget-actual" element={<BudgetVsActual />} />
                <Route path="/management/exceptions" element={<Exceptions />} />
                <Route path="/management/reports" element={<ReportsCenter />} />
                
                {/* Additional Sourcing routes */}
                <Route path="/sourcing/rfq-management" element={<RfqManagement />} />
                <Route path="/sourcing/quotation-comparison" element={<QuotationComparison />} />
                
                {/* Additional Procurement routes */}
                <Route path="/procurement/po-amendment" element={<PoAmendment />} />
                <Route path="/procurement/three-way-match" element={<ThreeWayMatch />} />
                <Route path="/procurement/catalogs" element={<Catalogs />} />
                <Route path="/procurement/price-lists" element={<PriceLists />} />
                
                {/* Construction routes */}
                <Route path="/construction/project-master" element={<ProjectMaster />} />
                <Route path="/construction/work-orders" element={<WorkOrders />} />
                <Route path="/construction/site-management" element={<SiteManagement />} />
                <Route path="/construction/progress-tracking" element={<ProgressTracking />} />
                <Route path="/construction/daily-reports" element={<DailySiteReports />} />
                <Route path="/construction/resource-allocation" element={<ResourceAllocation />} />
                <Route path="/construction/resource-allocation/labour" element={<LabourResources />} />
                <Route path="/construction/resource-allocation/inventory" element={<InventoryItems />} />
                <Route path="/construction/resource-allocation/subcontractors" element={<SubcontractorResources />} />
                <Route path="/construction/quality-control" element={<QualityControl />} />
                <Route path="/construction/safety-management" element={<SafetyManagement />} />
                
                {/* Production routes */}
                <Route path="/production" element={<ProductionModule />} />
                
                {/* Social Media routes */}
                <Route path="/social-media/accounts" element={<SocialMediaAccounts />} />
                <Route path="/social-media/access" element={<SocialMediaAccess />} />
                <Route path="/social-media/nda-compliance" element={<SocialMediaNDA />} />
                <Route path="/social-media/activity-log" element={<SocialMediaActivityLog />} />
              </Route>
              
              {/* Catch-all 404 route */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
