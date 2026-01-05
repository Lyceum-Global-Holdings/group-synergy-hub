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

export default function AppLayout({ children }: { children: React.ReactNode }) {
  // Try-catch to debug the context issue
  let isViewingAllCompanies = false;
  let companies: any[] = [];
  let isCompaniesLoading = true;
  let isSuperAdmin = false;
  let isSuperAdminLoading = true;
  let isProfileLoading = true;

  try {
    const companyContext = useCompany();
    isViewingAllCompanies = companyContext.isViewingAllCompanies;
    companies = companyContext.companies;
    isCompaniesLoading = companyContext.isLoading;
  } catch (error) {
    console.error('CompanyContext error:', error);
    // Return loading state if context is not available
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  try {
    const superAdminQuery = useSuperAdmin();
    isSuperAdmin = superAdminQuery.data || false;
    isSuperAdminLoading = superAdminQuery.isLoading;
  } catch (error) {
    console.error('SuperAdmin query error:', error);
  }

  try {
    const profileQuery = useCurrentUserProfile();
    isProfileLoading = profileQuery.isLoading;
  } catch (error) {
    console.error('Profile query error:', error);
  }
  
  // Wait for initial data to load
  if (isProfileLoading || isCompaniesLoading || isSuperAdminLoading) {
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