// Lightweight Scanner shell mounted at hosts starting with `scan.` (e.g.
// scan.lgh.lk). Exposes ONLY two field-worker actions — scan to adjust stock
// and scan to move asset — plus the supporting public bin/asset routes.
// All RLS, RPCs, dialogs, Turnstile and MFA logic are reused from the main
// app; nothing here is forked.
import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { CompanyProvider } from "@/contexts/CompanyContext";
import { LocationFilterProvider } from "@/contexts/LocationFilterContext";
import ProtectedRoute from "@/components/common/ProtectedRoute";
import MfaEnforcementGate from "@/components/auth/MfaEnforcementGate";
import ScrollToTop from "@/components/layout/ScrollToTop";
import { Loader2 } from "lucide-react";
import ScannerLayout from "./ScannerLayout";
import { SCANNER_BASENAME } from "@/lib/scannerShell";
import RootErrorBoundary from "@/components/common/RootErrorBoundary";

const Auth = lazy(() => import("@/pages/Auth"));
const MfaChallenge = lazy(() => import("@/pages/auth/MfaChallenge"));
const MfaSetup = lazy(() => import("@/pages/auth/MfaSetup"));
const ScannerHome = lazy(() => import("@/pages/scanner/ScannerHome"));
const ScanQR = lazy(() => import("@/pages/ScanQR"));
const PublicBinAllocation = lazy(() => import("@/pages/PublicBinAllocation"));
const PublicAssetView = lazy(() => import("@/pages/PublicAssetView"));

// Same React Query tuning as the main app — important so live-stock hooks
// behave identically when invoked from scanner dialogs.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnMount: true,
    },
  },
});

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

const ProtectedShell = () => (
  <AuthProvider>
    <ProtectedRoute>
      <CompanyProvider>
        <LocationFilterProvider>
          <MfaEnforcementGate>
            <ScannerLayout>
              <Suspense fallback={<PageLoader />}>
                <Outlet />
              </Suspense>
            </ScannerLayout>
          </MfaEnforcementGate>
        </LocationFilterProvider>
      </CompanyProvider>
    </ProtectedRoute>
  </AuthProvider>
);

export default function ScannerApp() {
  return (
    <RootErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter
          basename={SCANNER_BASENAME}
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <ScrollToTop />
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Public auth surfaces */}
              <Route
                path="/auth"
                element={
                  <AuthProvider>
                    <Auth />
                  </AuthProvider>
                }
              />
              <Route
                path="/auth/mfa"
                element={
                  <AuthProvider>
                    <MfaChallenge />
                  </AuthProvider>
                }
              />

              {/* Public QR landing pages — handle their own auth gating */}
              <Route path="/asset/:assetId" element={<PublicAssetView />} />
              <Route path="/a/:assetId" element={<PublicAssetView />} />
              <Route
                path="/b/:id"
                element={
                  <AuthProvider>
                    <PublicBinAllocation />
                  </AuthProvider>
                }
              />

              {/* Authenticated scanner shell */}
              <Route element={<ProtectedShell />}>
                <Route path="/" element={<ScannerHome />} />
                <Route path="/scan" element={<ScanQR />} />
                <Route path="/account/mfa" element={<MfaSetup />} />
              </Route>

              {/* Anything else collapses back to home — scanner has no other surfaces */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
    </RootErrorBoundary>
  );
}
