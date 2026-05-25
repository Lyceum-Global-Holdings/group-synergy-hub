import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { CompanySidebar } from "@/components/layout/CompanySidebar";
import { CompanySelector } from "@/components/common/CompanySelector";
import { LocationSelector } from "@/components/common/LocationSelector";
import { UserProfile } from "@/components/common/UserProfile";
import { LiveClock } from "@/components/common/LiveClock";
import { InstallAppButton } from "@/components/common/InstallAppButton";
import { Badge } from "@/components/ui/badge";
import { useCompany } from "@/contexts/CompanyContext";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { useCurrentUserProfile } from "@/hooks/useCurrentUserProfile";
import { RealtimeBusProvider } from "@/hooks/useRealtimeBus";
import { Loader2 } from "lucide-react";
import { useState, useEffect } from "react";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [hasTimedOut, setHasTimedOut] = useState(false);

  const companyContext = useCompany();
  const superAdminQuery = useSuperAdmin();
  const profileQuery = useCurrentUserProfile();

  const isViewingAllCompanies = companyContext.isViewingAllCompanies;
  const companies = companyContext.companies;
  const isCompaniesLoading = companyContext.isLoading;
  const isSuperAdmin = superAdminQuery.data ?? false;
  const isSuperAdminLoading = superAdminQuery.isLoading && !superAdminQuery.isError;
  const isProfileLoading = profileQuery.isLoading && !profileQuery.isError;
  
  const hasError = superAdminQuery.isError || profileQuery.isError;

  useEffect(() => {
    const timer = setTimeout(() => {
      setHasTimedOut(true);
    }, 5000);
    
    return () => clearTimeout(timer);
  }, []);

  const isStillLoading = isProfileLoading || isCompaniesLoading || isSuperAdminLoading;

  if (isStillLoading && !hasTimedOut && !hasError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <RealtimeBusProvider>
    <SidebarProvider>
      <div className="h-svh flex w-full bg-background overflow-hidden">
        <CompanySidebar />
        
        <div className="flex-1 flex flex-col min-w-0 h-svh">
          {/* Header — clean enterprise shell bar (viewport-locked) */}
          <header className="h-14 flex items-center justify-between bg-card px-5 shadow-[var(--shadow-sm)] border-b border-border/40 shrink-0 sticky top-0 z-20">
            <div className="flex items-center gap-3 min-w-0">
              <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
              <div className="h-5 w-px bg-border/60" />
              <h1 className="text-sm font-semibold text-foreground truncate tracking-tight">
                Enterprise Management System
              </h1>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <LiveClock />
              <div className="h-5 w-px bg-border/60" />
              <CompanySelector />
              <LocationSelector />
              {isSuperAdmin && !isViewingAllCompanies && companies.length > 1 && (
                <Badge variant="outline" className="text-xs">
                  Viewing as company
                </Badge>
              )}
              <InstallAppButton />
              <UserProfile />
            </div>
          </header>

          {/* Main Content — the single canonical scroll region */}
          <main
            id="app-scroll-container"
            className="flex-1 p-5 overflow-auto min-h-0 overscroll-contain"
          >
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
    </RealtimeBusProvider>
  );
}
