import React from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSupplierContext } from "@/contexts/SupplierContext";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { LayoutDashboard, Building2, Users, FileText, Receipt, Globe2, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/portal", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/portal/profile", label: "Company Profile", icon: Building2 },
  { to: "/portal/users", label: "Users", icon: Users },
  { to: "/portal/peppol-ids", label: "PEPPOL IDs", icon: Globe2 },
  { to: "/portal/quotes", label: "Quotes", icon: FileText },
  { to: "/portal/invoices", label: "E-Invoices", icon: Receipt },
];

export const PortalLayout: React.FC = () => {
  const { user, signOut } = useAuth();
  const { memberships, activeSupplierId, setActiveSupplierId, activeMembership } = useSupplierContext();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-muted/20 flex">
      <aside className="w-64 bg-card border-r border-border hidden md:flex flex-col">
        <div className="p-4 border-b">
          <Link to="/portal" className="font-semibold text-lg">Supplier Portal</Link>
          <p className="text-xs text-muted-foreground mt-1">Lyceum Global Holdings</p>
        </div>
        <div className="p-4 border-b">
          <label className="text-xs text-muted-foreground">Active supplier</label>
          <Select value={activeSupplierId ?? undefined} onValueChange={setActiveSupplierId}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="Select supplier" /></SelectTrigger>
            <SelectContent>
              {memberships.map((m) => (
                <SelectItem key={m.supplier_id} value={m.supplier_id}>
                  {m.supplier_name ?? m.supplier_id.slice(0, 8)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {activeMembership && (
            <p className="mt-2 text-xs text-muted-foreground capitalize">Role: {activeMembership.portal_role}</p>
          )}
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => cn(
                "flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
                isActive ? "bg-primary text-primary-foreground" : "hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t text-xs text-muted-foreground">
          <div className="truncate mb-2">{user?.email}</div>
          <Button variant="outline" size="sm" className="w-full"
            onClick={async () => { await signOut(); navigate("/portal/login"); }}>
            <LogOut className="h-4 w-4 mr-2" /> Sign out
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <div className="p-6 max-w-6xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
