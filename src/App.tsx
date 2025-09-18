import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/common/ProtectedRoute";
import AppLayout from "./components/layout/AppLayout";
import Dashboard from "./pages/Dashboard";
import CompanyManagement from "./pages/admin/CompanyManagement";
import UserRoleManagement from "./pages/admin/UserRoleManagement";
import ModuleAllocation from "./pages/admin/ModuleAllocation";
import PurchaseRequisition from "./pages/procurement/PurchaseRequisition";
import PurchaseOrder from "./pages/procurement/PurchaseOrder";
import { SupplierMaster } from "./pages/sourcing/SupplierMaster";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
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
            <Route path="/sourcing/supplier-master" element={
              <ProtectedRoute>
                <AppLayout>
                  <SupplierMaster />
                </AppLayout>
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

export default App;
