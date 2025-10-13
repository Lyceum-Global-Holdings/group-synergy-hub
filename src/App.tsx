import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/asset/:assetId" element={<PublicAssetView />} />
              <Route path="/request-asset" element={<PublicAssetRequest />} />
              <Route path="/register-supplier" element={<PublicSupplierRegistration />} />
              <Route path="/" element={
                <ProtectedRoute>
                  <CompanyProvider>
                    <AppLayout>
                      <Dashboard />
                    </AppLayout>
                  </CompanyProvider>
                </ProtectedRoute>
              } />
              <Route path="/admin/companies" element={
                <ProtectedRoute>
                  <CompanyProvider>
                    <AppLayout>
                      <CompanyManagement />
                    </AppLayout>
                  </CompanyProvider>
                </ProtectedRoute>
              } />
              <Route path="/admin/users-roles" element={
                <ProtectedRoute>
                  <CompanyProvider>
                    <AppLayout>
                      <UserRoleManagement />
                    </AppLayout>
                  </CompanyProvider>
                </ProtectedRoute>
              } />
              <Route path="/admin/modules" element={
                <ProtectedRoute>
                  <CompanyProvider>
                    <AppLayout>
                      <ModuleAllocation />
                    </AppLayout>
                  </CompanyProvider>
                </ProtectedRoute>
              } />
              <Route path="/admin/warehouse-management" element={
                <ProtectedRoute>
                  <CompanyProvider>
                    <AppLayout>
                      <WarehouseManagement />
                    </AppLayout>
                  </CompanyProvider>
                </ProtectedRoute>
              } />
              <Route path="/procurement/purchase-requisition" element={
                <ProtectedRoute>
                  <CompanyProvider>
                    <AppLayout>
                      <PurchaseRequisition />
                    </AppLayout>
                  </CompanyProvider>
                </ProtectedRoute>
              } />
              <Route path="/procurement/purchase-order" element={
                <ProtectedRoute>
                  <CompanyProvider>
                    <AppLayout>
                      <PurchaseOrder />
                    </AppLayout>
                  </CompanyProvider>
                </ProtectedRoute>
              } />
              <Route path="/tuh-modules/bill-of-materials" element={
                <ProtectedRoute>
                  <CompanyProvider>
                    <AppLayout>
                      <BillOfMaterials />
                    </AppLayout>
                  </CompanyProvider>
                </ProtectedRoute>
              } />
              <Route path="/tuh-modules/customer-master" element={
                <ProtectedRoute>
                  <CompanyProvider>
                    <AppLayout>
                      <CustomerMaster />
                    </AppLayout>
                  </CompanyProvider>
                </ProtectedRoute>
              } />
              <Route path="/tuh-modules/customer-po" element={
                <ProtectedRoute>
                  <CompanyProvider>
                    <AppLayout>
                      <CustomerPO />
                    </AppLayout>
                  </CompanyProvider>
                </ProtectedRoute>
              } />
              {/* Legacy route redirect */}
              <Route path="/procurement/bill-of-materials" element={
                <ProtectedRoute>
                  <CompanyProvider>
                    <AppLayout>
                      <BillOfMaterials />
                    </AppLayout>
                  </CompanyProvider>
                </ProtectedRoute>
              } />
              <Route path="/procurement/material-demand" element={
                <ProtectedRoute>
                  <CompanyProvider>
                    <AppLayout>
                      <MaterialDemandPlanning />
                    </AppLayout>
                  </CompanyProvider>
                </ProtectedRoute>
              } />
              <Route path="/procurement/rfq-rfp" element={
                <ProtectedRoute>
                  <CompanyProvider>
                    <AppLayout>
                      <RfqRfp />
                    </AppLayout>
                  </CompanyProvider>
                </ProtectedRoute>
              } />
              <Route path="/procurement/blanket-po" element={
                <ProtectedRoute>
                  <CompanyProvider>
                    <AppLayout>
                      <BlanketPurchaseOrder />
                    </AppLayout>
                  </CompanyProvider>
                </ProtectedRoute>
              } />
              <Route path="/warehouse/stock-adjustment" element={
                <ProtectedRoute>
                  <CompanyProvider>
                    <AppLayout>
                      <StockAdjustment />
                    </AppLayout>
                  </CompanyProvider>
                </ProtectedRoute>
              } />
              <Route path="/sourcing/supplier-master" element={
                <ProtectedRoute>
                  <CompanyProvider>
                    <AppLayout>
                      <SupplierMaster />
                    </AppLayout>
                  </CompanyProvider>
                </ProtectedRoute>
              } />
              <Route path="/sourcing/supplier-scorecard" element={
                <ProtectedRoute>
                  <CompanyProvider>
                    <AppLayout>
                      <SupplierScorecard />
                    </AppLayout>
                  </CompanyProvider>
                </ProtectedRoute>
              } />
              <Route path="/sourcing/supplier-evaluation" element={
                <ProtectedRoute>
                  <CompanyProvider>
                    <AppLayout>
                      <SupplierEvaluation />
                    </AppLayout>
                  </CompanyProvider>
                </ProtectedRoute>
              } />
              <Route path="/sourcing/supplier-registration" element={
                <ProtectedRoute>
                  <CompanyProvider>
                    <AppLayout>
                      <SupplierRegistration />
                    </AppLayout>
                  </CompanyProvider>
                </ProtectedRoute>
              } />
              <Route path="/sourcing/contracts" element={
                <ProtectedRoute>
                  <CompanyProvider>
                    <AppLayout>
                      <Contracts />
                    </AppLayout>
                  </CompanyProvider>
                </ProtectedRoute>
              } />
              <Route path="/sourcing/blacklist" element={
                <ProtectedRoute>
                  <CompanyProvider>
                    <AppLayout>
                      <SupplierBlacklist />
                    </AppLayout>
                  </CompanyProvider>
                </ProtectedRoute>
              } />
              <Route path="/warehouse/asset-management" element={
                <ProtectedRoute>
                  <CompanyProvider>
                    <AppLayout>
                      <AssetManagement />
                    </AppLayout>
                  </CompanyProvider>
                </ProtectedRoute>
              } />
              <Route path="/warehouse/item-bin-master" element={
                <ProtectedRoute>
                  <CompanyProvider>
                    <AppLayout>
                      <ItemBinMaster />
                    </AppLayout>
                  </CompanyProvider>
                </ProtectedRoute>
              } />
              <Route path="/warehouse/material-issue" element={
                <ProtectedRoute>
                  <CompanyProvider>
                    <AppLayout>
                      <MaterialIssueReturn />
                    </AppLayout>
                  </CompanyProvider>
                </ProtectedRoute>
              } />
              <Route path="/warehouse/grn" element={
                <ProtectedRoute>
                  <CompanyProvider>
                    <AppLayout>
                      <GoodsReceiptNote />
                    </AppLayout>
                  </CompanyProvider>
                </ProtectedRoute>
              } />
              <Route path="/tuh-modules/finished-goods" element={
                <ProtectedRoute>
                  <CompanyProvider>
                    <AppLayout>
                      <FinishedGoods />
                    </AppLayout>
                  </CompanyProvider>
                </ProtectedRoute>
              } />
              <Route path="/warehouse/pick-pack" element={
                <ProtectedRoute>
                  <CompanyProvider>
                    <AppLayout>
                      <PickPackDispatch />
                    </AppLayout>
                  </CompanyProvider>
                </ProtectedRoute>
              } />
              <Route path="/warehouse/putaway" element={
                <ProtectedRoute>
                  <CompanyProvider>
                    <AppLayout>
                      <Putaway />
                    </AppLayout>
                  </CompanyProvider>
                </ProtectedRoute>
              } />
              <Route path="/warehouse/stock-transfer" element={
                <ProtectedRoute>
                  <CompanyProvider>
                    <AppLayout>
                      <StockTransfer />
                    </AppLayout>
                  </CompanyProvider>
                </ProtectedRoute>
              } />
              <Route path="/warehouse/cycle-count" element={
                <ProtectedRoute>
                  <CompanyProvider>
                    <AppLayout>
                      <CycleCount />
                    </AppLayout>
                  </CompanyProvider>
                </ProtectedRoute>
              } />
              <Route path="/warehouse/delivery-order" element={
                <ProtectedRoute>
                  <CompanyProvider>
                    <AppLayout>
                      <DeliveryOrder />
                    </AppLayout>
                  </CompanyProvider>
                </ProtectedRoute>
              } />
              <Route path="/finance/general-ledger" element={
                <ProtectedRoute>
                  <CompanyProvider>
                    <AppLayout>
                      <GeneralLedger />
                    </AppLayout>
                  </CompanyProvider>
                </ProtectedRoute>
              } />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;