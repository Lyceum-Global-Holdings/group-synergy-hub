import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { CompanySidebar } from "@/components/layout/CompanySidebar";
import { GlobalSearch } from "@/components/layout/GlobalSearch";
import { QuickCreateMenu } from "@/components/layout/QuickCreateMenu";
import { LocationSelector } from "@/components/common/LocationSelector";
import { UserProfile } from "@/components/common/UserProfile";
import { LiveClock } from "@/components/common/LiveClock";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCompany } from "@/contexts/CompanyContext";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { useCurrentUserProfile } from "@/hooks/useCurrentUserProfile";
import { RealtimeBusProvider } from "@/hooks/useRealtimeBus";
import { Loader2, SlidersHorizontal } from "lucide-react";
import { useState, useEffect } from "react";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [hasTimedOut, setHasTimedOut] = useState(false);

  const companyContext = useCompany();
  const superAdminQuery = useSuperAdmin();
  const profileQuery = useCurrentUserProfile();

  const isCompaniesLoading = companyContext.isLoading;
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
      {/* Shell: sidebar + header sit on the soft grey frame; each page renders
          inside the rounded panel below (the single canonical scroll region). */}
      <div className="h-svh flex w-full bg-shell overflow-hidden">
        <CompanySidebar />

        <div className="flex-1 flex flex-col min-w-0 h-svh md:peer-data-[state=collapsed]:pl-3">
          <header className="h-16 flex items-center gap-2 sm:gap-3 px-3 md:pl-0 md:pr-3 shrink-0">
            <SidebarTrigger
              className="h-9 w-9 shrink-0 rounded-full text-muted-foreground hover:bg-card hover:text-foreground"
              aria-label="Toggle navigation"
            />
            <GlobalSearch />

            <div className="ml-auto flex items-center gap-2 shrink-0">
              {/* Desktop */}
              <div className="hidden lg:flex items-center gap-3">
                <LiveClock />
                <LocationSelector />
              </div>

              {/* Tablet / phone — secondary controls in a popover */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="lg:hidden h-10 w-10 rounded-full border-border/70 bg-card"
                    aria-label="Location and time"
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-[280px] rounded-2xl p-3 space-y-3">
                  <LiveClock />
                  <LocationSelector triggerClassName="w-full" />
                </PopoverContent>
              </Popover>

              <UserProfile />
              <QuickCreateMenu />
            </div>
          </header>

          <main
            id="app-scroll-container"
            className="flex-1 min-h-0 overflow-auto overscroll-contain bg-background p-4 sm:p-5 md:mb-3 md:mr-3 md:rounded-[24px] md:border md:border-border/60 md:shadow-[0_1px_3px_hsl(220_25%_10%/0.05)]"
          >
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
    </RealtimeBusProvider>
  );
}
