import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Outlet } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { CompanyProvider } from "./contexts/CompanyContext";
import ProtectedRoute from "./components/common/ProtectedRoute";
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
import MaterialDemandPlanning from "./pages/procurement/MaterialDemandPlanning";
import RfqRfp from "./pages/procurement/RfqRfp";
import BlanketPurchaseOrder from "./pages/procurement/BlanketPurchaseOrder";
import StockAdjustment from "./pages/warehouse/StockAdjustment";
import { SupplierMaster } from "./pages/sourcing/SupplierMaster";
import SupplierScorecard from "./pages/sourcing/SupplierScorecard";
import SupplierEvaluation from "./pages/sourcing/SupplierEvaluation";
import SupplierRegistration from "./pages/sourcing/SupplierRegistration";
import PublicSupplierRegistration from "./pages/PublicSupplierRegistration";
import Contracts from "./pages/sourcing/Contracts";
import SupplierBlacklist from "./pages/sourcing/SupplierBlacklist";
import AssetManagement from "./pages/warehouse/AssetManagement";
import ItemBinMaster from "./pages/warehouse/ItemBinMaster";
import MaterialIssueReturn from "./pages/warehouse/MaterialIssueReturn";
import GoodsReceiptNote from "./pages/warehouse/GoodsReceiptNote";
import FinishedGoods from "./pages/tuh-modules/FinishedGoods";
import PickPackDispatch from "./pages/warehouse/PickPackDispatch";
import Putaway from "./pages/warehouse/Putaway";
import StockTransfer from "./pages/warehouse/StockTransfer";
import CycleCount from "./pages/warehouse/CycleCount";
import DeliveryOrder from "./pages/warehouse/DeliveryOrder";
import PublicAssetView from "./pages/PublicAssetView";
import PublicAssetRequest from "./pages/PublicAssetRequest";
import GeneralLedger from "./pages/finance/GeneralLedger";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

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
            <Route path="/auth" element={<Auth />} />
            <Route path="/asset/:assetId" element={<PublicAssetView />} />
            <Route path="/request-asset" element={<PublicAssetRequest />} />
            <Route path="/register-supplier" element={<PublicSupplierRegistration />} />
            
            {/* Protected routes - all wrapped with auth/company context */}
            <Route element={<ProtectedLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/admin/companies" element={<CompanyManagement />} />
              <Route path="/admin/users-roles" element={<UserRoleManagement />} />
              <Route path="/admin/modules" element={<ModuleAllocation />} />
              <Route path="/admin/warehouse-management" element={<WarehouseManagement />} />
              <Route path="/procurement/purchase-requisition" element={<PurchaseRequisition />} />
              <Route path="/procurement/purchase-order" element={<PurchaseOrder />} />
              <Route path="/tuh-modules/bill-of-materials" element={<BillOfMaterials />} />
              <Route path="/tuh-modules/customer-master" element={<CustomerMaster />} />
              <Route path="/tuh-modules/customer-po" element={<CustomerPO />} />
              <Route path="/procurement/bill-of-materials" element={<BillOfMaterials />} />
              <Route path="/procurement/material-demand" element={<MaterialDemandPlanning />} />
              <Route path="/procurement/rfq-rfp" element={<RfqRfp />} />
              <Route path="/procurement/blanket-po" element={<BlanketPurchaseOrder />} />
              <Route path="/warehouse/stock-adjustment" element={<StockAdjustment />} />
              <Route path="/sourcing/supplier-master" element={<SupplierMaster />} />
              <Route path="/sourcing/supplier-scorecard" element={<SupplierScorecard />} />
              <Route path="/sourcing/supplier-evaluation" element={<SupplierEvaluation />} />
              <Route path="/sourcing/supplier-registration" element={<SupplierRegistration />} />
              <Route path="/sourcing/contracts" element={<Contracts />} />
              <Route path="/sourcing/blacklist" element={<SupplierBlacklist />} />
              <Route path="/warehouse/asset-management" element={<AssetManagement />} />
              <Route path="/warehouse/item-bin-master" element={<ItemBinMaster />} />
              <Route path="/warehouse/material-issue" element={<MaterialIssueReturn />} />
              <Route path="/warehouse/grn" element={<GoodsReceiptNote />} />
              <Route path="/tuh-modules/finished-goods" element={<FinishedGoods />} />
              <Route path="/warehouse/pick-pack" element={<PickPackDispatch />} />
              <Route path="/warehouse/putaway" element={<Putaway />} />
              <Route path="/warehouse/stock-transfer" element={<StockTransfer />} />
              <Route path="/warehouse/cycle-count" element={<CycleCount />} />
              <Route path="/warehouse/delivery-order" element={<DeliveryOrder />} />
              <Route path="/finance/general-ledger" element={<GeneralLedger />} />
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