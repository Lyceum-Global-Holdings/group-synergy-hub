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
import PurchaseRequisition from "./pages/procurement/PurchaseRequisition";
import PurchaseOrder from "./pages/procurement/PurchaseOrder";
import BillOfMaterials from "./pages/procurement/BillOfMaterials";
import CustomerMaster from "./pages/tuh-modules/CustomerMaster";
import CustomerPO from "./pages/tuh-modules/CustomerPO";
import MaterialDemandPlanning from "./pages/procurement/MaterialDemandPlanning";
import { SupplierMaster } from "./pages/sourcing/SupplierMaster";
import SupplierScorecard from "./pages/sourcing/SupplierScorecard";
import AssetManagement from "./pages/warehouse/AssetManagement";
import ItemBinMaster from "./pages/warehouse/ItemBinMaster";
import MaterialIssueReturn from "./pages/warehouse/MaterialIssueReturn";
import GoodsReceiptNote from "./pages/warehouse/GoodsReceiptNote";
import FinishedGoods from "./pages/tuh-modules/FinishedGoods";
import PickPackDispatch from "./pages/warehouse/PickPackDispatch";
import PublicAssetView from "./pages/PublicAssetView";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CompanyProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/auth" element={<Auth />} />
                <Route path="/asset/:assetId" element={<PublicAssetView />} />
                <Route path="/" element={
                  <ProtectedRoute>
                    <AppLayout>
                      <Dashboard />
                    </AppLayout>
                  </ProtectedRoute>
                } />
                <Route path="/admin/companies" element={
                  <ProtectedRoute>
                    <AppLayout>
                      <CompanyManagement />
                    </AppLayout>
                  </ProtectedRoute>
                } />
                <Route path="/admin/users-roles" element={
                  <ProtectedRoute>
                    <AppLayout>
                      <UserRoleManagement />
                    </AppLayout>
                  </ProtectedRoute>
                } />
                <Route path="/admin/modules" element={
                  <ProtectedRoute>
                    <AppLayout>
                      <ModuleAllocation />
                    </AppLayout>
                  </ProtectedRoute>
                } />
                <Route path="/procurement/purchase-requisition" element={
                  <ProtectedRoute>
                    <AppLayout>
                      <PurchaseRequisition />
                    </AppLayout>
                  </ProtectedRoute>
                } />
                <Route path="/procurement/purchase-order" element={
                  <ProtectedRoute>
                    <AppLayout>
                      <PurchaseOrder />
                    </AppLayout>
                  </ProtectedRoute>
                } />
                <Route path="/tuh-modules/bill-of-materials" element={
                  <ProtectedRoute>
                    <AppLayout>
                      <BillOfMaterials />
                    </AppLayout>
                  </ProtectedRoute>
                } />
                <Route path="/tuh-modules/customer-master" element={
                  <ProtectedRoute>
                    <AppLayout>
                      <CustomerMaster />
                    </AppLayout>
                  </ProtectedRoute>
                } />
                <Route path="/tuh-modules/customer-po" element={
                  <ProtectedRoute>
                    <AppLayout>
                      <CustomerPO />
                    </AppLayout>
                  </ProtectedRoute>
                } />
                {/* Legacy route redirect */}
                <Route path="/procurement/bill-of-materials" element={
                  <ProtectedRoute>
                    <AppLayout>
                      <BillOfMaterials />
                    </AppLayout>
                  </ProtectedRoute>
                } />
                <Route path="/procurement/material-demand" element={
                  <ProtectedRoute>
                    <AppLayout>
                      <MaterialDemandPlanning />
                    </AppLayout>
                  </ProtectedRoute>
                } />
                <Route path="/sourcing/supplier-master" element={
                  <ProtectedRoute>
                    <AppLayout>
                      <SupplierMaster />
                    </AppLayout>
                  </ProtectedRoute>
                } />
                <Route path="/sourcing/supplier-scorecard" element={
                  <ProtectedRoute>
                    <AppLayout>
                      <SupplierScorecard />
                    </AppLayout>
                  </ProtectedRoute>
                } />
                <Route path="/warehouse/asset-management" element={
                  <ProtectedRoute>
                    <AppLayout>
                      <AssetManagement />
                    </AppLayout>
                  </ProtectedRoute>
                } />
                <Route path="/warehouse/item-bin-master" element={
                  <ProtectedRoute>
                    <AppLayout>
                      <ItemBinMaster />
                    </AppLayout>
                  </ProtectedRoute>
                } />
                <Route path="/warehouse/material-issue" element={
                  <ProtectedRoute>
                    <AppLayout>
                      <MaterialIssueReturn />
                    </AppLayout>
                  </ProtectedRoute>
                } />
                <Route path="/warehouse/grn" element={
                  <ProtectedRoute>
                    <AppLayout>
                      <GoodsReceiptNote />
                    </AppLayout>
                  </ProtectedRoute>
                } />
                <Route path="/tuh-modules/finished-goods" element={
                  <ProtectedRoute>
                    <AppLayout>
                      <FinishedGoods />
                    </AppLayout>
                  </ProtectedRoute>
                } />
                <Route path="/warehouse/pick-pack" element={
                  <ProtectedRoute>
                    <AppLayout>
                      <PickPackDispatch />
                    </AppLayout>
                  </ProtectedRoute>
                } />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </CompanyProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;