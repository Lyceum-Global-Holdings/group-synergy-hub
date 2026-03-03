// App version: 1.0.2 - Code splitting for performance
import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Outlet } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { CompanyProvider } from "@/contexts/CompanyContext";
import { LocationFilterProvider } from "@/contexts/LocationFilterContext";
import ProtectedRoute from "./components/common/ProtectedRoute";
import { AdminRoute } from "./components/auth/AdminRoute";
import AppLayout from "./components/layout/AppLayout";
import { Loader2 } from "lucide-react";

// Lazy load all page components for code splitting
const Dashboard = lazy(() => import("./pages/Dashboard"));
const CompanyManagement = lazy(() => import("./pages/admin/CompanyManagement"));
const UserRoleManagement = lazy(() => import("./pages/admin/UserRoleManagement"));
const ModuleAllocation = lazy(() => import("./pages/admin/ModuleAllocation"));
const WarehouseManagement = lazy(() => import("./pages/admin/WarehouseManagement"));
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
const GeneralLedger = lazy(() => import("./pages/finance/GeneralLedger"));
const AccountsPayable = lazy(() => import("./pages/finance/AccountsPayable"));
const AccountsReceivable = lazy(() => import("./pages/finance/AccountsReceivable"));
const CashBank = lazy(() => import("./pages/finance/CashBank"));
const FixedAssets = lazy(() => import("./pages/finance/FixedAssets"));
const Budgeting = lazy(() => import("./pages/finance/Budgeting"));
const CostCenters = lazy(() => import("./pages/finance/CostCenters"));
const FinancialReporting = lazy(() => import("./pages/finance/FinancialReporting"));
const BankReconciliation = lazy(() => import("./pages/finance/BankReconciliation"));
const Payments = lazy(() => import("./pages/finance/Payments"));
const FinanceSettings = lazy(() => import("./pages/finance/FinanceSettings"));
const Auth = lazy(() => import("./pages/Auth"));
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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 0, // Always fetch fresh data to prevent stale cache issues
      gcTime: 5 * 60 * 1000, // Keep unused data in cache for 5 minutes for quick navigation
      refetchOnWindowFocus: true, // Refetch when user returns to tab
      refetchOnMount: 'always', // Always refetch when component mounts
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
                <Route path="/finance/general-ledger" element={<GeneralLedger />} />
                <Route path="/finance/accounts-payable" element={<AccountsPayable />} />
                <Route path="/finance/accounts-receivable" element={<AccountsReceivable />} />
                <Route path="/finance/cash-bank" element={<CashBank />} />
                <Route path="/finance/fixed-assets" element={<FixedAssets />} />
                <Route path="/finance/budgeting" element={<Budgeting />} />
                <Route path="/finance/cost-centers" element={<CostCenters />} />
                <Route path="/finance/reporting" element={<FinancialReporting />} />
                <Route path="/finance/bank-reconciliation" element={<BankReconciliation />} />
                <Route path="/finance/payments" element={<Payments />} />
                <Route path="/finance/settings" element={<FinanceSettings />} />
                <Route path="/management/dashboards" element={<DashboardsKPIs />} />
                <Route path="/management/dashboards/:id/edit" element={<DashboardEdit />} />
                <Route path="/management/dashboards/:id" element={<DashboardView />} />
                <Route path="/management/approvals" element={<ApprovalConsole />} />
                <Route path="/management/audit-logs" element={<AuditLogs />} />
                <Route path="/management/budget-actual" element={<BudgetVsActual />} />
                <Route path="/management/exceptions" element={<Exceptions />} />
                
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
