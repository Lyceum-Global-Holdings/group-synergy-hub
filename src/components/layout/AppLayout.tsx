import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { CompanySidebar } from "@/components/layout/CompanySidebar";
import { CompanySelector } from "@/components/common/CompanySelector";
import { LocationSelector } from "@/components/common/LocationSelector";
import { UserProfile } from "@/components/common/UserProfile";
import { LiveClock } from "@/components/common/LiveClock";
import { Badge } from "@/components/ui/badge";
import { useCompany } from "@/contexts/CompanyContext";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { useCurrentUserProfile } from "@/hooks/useCurrentUserProfile";
import { Loader2 } from "lucide-react";
import { useState, useEffect } from "react";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [hasTimedOut, setHasTimedOut] = useState(false);

  // Call ALL hooks unconditionally at the top level (React Rules of Hooks)
  const companyContext = useCompany();
  const superAdminQuery = useSuperAdmin();
  const profileQuery = useCurrentUserProfile();

  // Extract values with safe fallbacks
  const isViewingAllCompanies = companyContext.isViewingAllCompanies;
  const companies = companyContext.companies;
  const isCompaniesLoading = companyContext.isLoading;
  const isSuperAdmin = superAdminQuery.data ?? false;
  const isSuperAdminLoading = superAdminQuery.isLoading && !superAdminQuery.isError;
  const isProfileLoading = profileQuery.isLoading && !profileQuery.isError;
  
  // Check for errors using query error states
  const hasError = superAdminQuery.isError || profileQuery.isError;

  // Add a timeout fallback to prevent infinite loading
  useEffect(() => {
    const timer = setTimeout(() => {
      setHasTimedOut(true);
    }, 5000);
    
    return () => clearTimeout(timer);
  }, []);

  const isStillLoading = isProfileLoading || isCompaniesLoading || isSuperAdminLoading;

  // Show loading only if still loading and hasn't timed out, and no errors
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
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <CompanySidebar />
        
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <header className="border-b bg-card px-6 py-2 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <SidebarTrigger />
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 bg-gradient-to-br from-primary to-info rounded-lg flex items-center justify-center shrink-0">
                    <span className="text-primary-foreground font-bold text-sm">ERP</span>
                  </div>
                  <h1 className="text-xl font-semibold text-foreground truncate">
                    Enterprise Management System
                  </h1>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <LiveClock />
                <CompanySelector />
                <LocationSelector />
                {isSuperAdmin && !isViewingAllCompanies && companies.length > 1 && (
                  <Badge variant="outline" className="text-xs">
                    Viewing as company
                  </Badge>
                )}
                <UserProfile />
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 p-6">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}