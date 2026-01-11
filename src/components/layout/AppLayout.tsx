import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { CompanySidebar } from "@/components/layout/CompanySidebar";
import { CompanySelector } from "@/components/common/CompanySelector";
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
  
  // Try-catch to debug the context issue
  let isViewingAllCompanies = false;
  let companies: any[] = [];
  let isCompaniesLoading = true;
  let isSuperAdmin = false;
  let isSuperAdminLoading = true;
  let isProfileLoading = true;
  let hasError = false;

  try {
    const companyContext = useCompany();
    isViewingAllCompanies = companyContext.isViewingAllCompanies;
    companies = companyContext.companies;
    isCompaniesLoading = companyContext.isLoading;
  } catch (error) {
    console.error('CompanyContext error:', error);
    hasError = true;
  }

  try {
    const superAdminQuery = useSuperAdmin();
    isSuperAdmin = superAdminQuery.data || false;
    isSuperAdminLoading = superAdminQuery.isLoading && !superAdminQuery.isError;
  } catch (error) {
    console.error('SuperAdmin query error:', error);
    hasError = true;
  }

  try {
    const profileQuery = useCurrentUserProfile();
    isProfileLoading = profileQuery.isLoading && !profileQuery.isError;
  } catch (error) {
    console.error('Profile query error:', error);
    hasError = true;
  }

  // Add a timeout fallback to prevent infinite loading
  useEffect(() => {
    const timer = setTimeout(() => {
      setHasTimedOut(true);
    }, 5000); // 5 second timeout
    
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
          <header className="h-16 border-b bg-card flex items-center justify-between px-6 shadow-sm">
            <div className="flex items-center gap-4">
              <SidebarTrigger />
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-primary to-info rounded-lg flex items-center justify-center">
                  <span className="text-primary-foreground font-bold text-sm">ERP</span>
                </div>
                <h1 className="text-xl font-semibold text-foreground">
                  Enterprise Management System
                </h1>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <LiveClock />
              <CompanySelector />
              {isSuperAdmin && !isViewingAllCompanies && companies.length > 1 && (
                <Badge variant="outline" className="text-xs">
                  Viewing as company
                </Badge>
              )}
              <UserProfile />
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