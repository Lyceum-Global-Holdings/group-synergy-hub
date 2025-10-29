import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Outlet } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { CompanyProvider } from "@/contexts/CompanyContext";
import ProtectedRoute from "./components/common/ProtectedRoute";
import { AdminRoute } from "./components/auth/AdminRoute";
import AppLayout from "./components/layout/AppLayout";
import Dashboard from "./pages/Dashboard";
import CompanyManagement from "./pages/admin/CompanyManagement";
import UserRoleManagement from "./pages/admin/UserRoleManagement";
import ModuleAllocation from "./pages/admin/ModuleAllocation";
import WarehouseManagement from "./pages/admin/WarehouseManagement";
import PurchaseRequisition from "./pages/procurement/PurchaseRequisition";
import PurchaseOrder from "./pages/procurement/PurchaseOrder";
import BillOfMaterials from "./pages/procurement/BillOfMaterials";
import CustomerMaster from "./pages/tuh-modules/CustomerMaster";
import CustomerPO from "./pages/tuh-modules/CustomerPO";
import CustomerPoView from "./pages/tuh-modules/CustomerPoView";
import MaterialDemandPlanning from "./pages/procurement/MaterialDemandPlanning";
import RfqRfp from "./pages/procurement/RfqRfp";
import BlanketPurchaseOrder from "./pages/procurement/BlanketPurchaseOrder";
import StockAdjustment from "./pages/warehouse/StockAdjustment";
import { SupplierMaster } from "./pages/sourcing/SupplierMaster";
import SupplierAllocation from "./pages/sourcing/SupplierAllocation";
import SupplierScorecard from "./pages/sourcing/SupplierScorecard";
import SupplierEvaluation from "./pages/sourcing/SupplierEvaluation";
import SupplierRegistration from "./pages/sourcing/SupplierRegistration";
import PublicSupplierRegistration from "./pages/PublicSupplierRegistration";
import Contracts from "./pages/sourcing/Contracts";
import SupplierBlacklist from "./pages/sourcing/SupplierBlacklist";
import AssetManagement from "./pages/warehouse/AssetManagement";
import ItemBinMaster from "./pages/warehouse/ItemBinMaster";
import MaterialIssueReturn from "./pages/warehouse/MaterialIssueReturn";
import FinishedGoods from "./pages/tuh-modules/FinishedGoods";
import PickPackDispatch from "./pages/warehouse/PickPackDispatch";
import Putaway from "./pages/warehouse/Putaway";
import StockTransfer from "./pages/warehouse/StockTransfer";
import CycleCount from "./pages/warehouse/CycleCount";
import DeliveryOrder from "./pages/warehouse/DeliveryOrder";
import GoodsReceiptNote from "./pages/warehouse/GoodsReceiptNote";
import InventoryValuation from "./pages/warehouse/InventoryValuation";
import PublicAssetView from "./pages/PublicAssetView";
import PoEmailApproval from "./pages/procurement/PoEmailApproval";
import GeneralLedger from "./pages/finance/GeneralLedger";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import Training from "./pages/admin/Training";
import ModuleTrainings from "./pages/admin/training/ModuleTrainings";
import VideoLibrary from "./pages/admin/training/VideoLibrary";
import Documentation from "./pages/admin/training/Documentation";
import TrainingProgress from "./pages/admin/training/TrainingProgress";
import DashboardsKPIs from "./pages/management/DashboardsKPIs";
import DashboardView from "./pages/management/DashboardView";
import DashboardEdit from "./pages/management/DashboardEdit";
import ApprovalConsole from "./pages/management/ApprovalConsole";

const queryClient = new QueryClient();

// Protected layout wrapper component
const ProtectedLayout = () => (
  <AuthProvider>
    <ProtectedRoute>
      <CompanyProvider>
        <AppLayout>
          <Outlet />
        </AppLayout>
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
              <Route path="/warehouse/item-bin-master" element={<ItemBinMaster />} />
              <Route path="/warehouse/material-issue" element={<MaterialIssueReturn />} />
              <Route path="/tuh-modules/finished-goods" element={<FinishedGoods />} />
              <Route path="/warehouse/pick-pack" element={<PickPackDispatch />} />
              <Route path="/warehouse/putaway" element={<Putaway />} />
              <Route path="/warehouse/stock-transfer" element={<StockTransfer />} />
              <Route path="/warehouse/cycle-count" element={<CycleCount />} />
              <Route path="/warehouse/delivery-order" element={<DeliveryOrder />} />
              <Route path="/warehouse/inventory-valuation" element={<InventoryValuation />} />
              <Route path="/finance/general-ledger" element={<GeneralLedger />} />
              <Route path="/management/dashboards" element={<DashboardsKPIs />} />
              <Route path="/management/dashboards/:id/edit" element={<DashboardEdit />} />
              <Route path="/management/dashboards/:id" element={<DashboardView />} />
              <Route path="/management/approvals" element={<ApprovalConsole />} />
            </Route>
            
            {/* Catch-all 404 route */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;