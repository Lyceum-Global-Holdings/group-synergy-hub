import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { CompanySidebar } from "@/components/layout/CompanySidebar";
import { CompanySelector } from "@/components/common/CompanySelector";
import { UserProfile } from "@/components/common/UserProfile";

export default function AppLayout({ children }: { children: React.ReactNode }) {
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
              <CompanySelector />
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