import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";
import Dashboard from "./pages/Dashboard";
import CompanyManagement from "./pages/admin/CompanyManagement";
import UserRoleManagement from "./pages/admin/UserRoleManagement";
import ModuleAllocation from "./pages/admin/ModuleAllocation";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={
            <AppLayout>
              <Dashboard />
            </AppLayout>
          } />
          <Route path="/admin/companies" element={
            <AppLayout>
              <CompanyManagement />
            </AppLayout>
          } />
          <Route path="/admin/users-roles" element={
            <AppLayout>
              <UserRoleManagement />
            </AppLayout>
          } />
          <Route path="/admin/modules" element={
            <AppLayout>
              <ModuleAllocation />
            </AppLayout>
          } />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
