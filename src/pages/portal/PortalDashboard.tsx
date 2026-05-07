import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSupplierContext } from "@/contexts/SupplierContext";

export default function PortalDashboard() {
  const { activeMembership } = useSupplierContext();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground">
          {activeMembership?.supplier_name ?? "Supplier"} — role: {activeMembership?.portal_role}
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {[
          { title: "Open Quotes", value: "—" },
          { title: "PEPPOL Invoices", value: "—" },
          { title: "Outstanding Actions", value: "—" },
        ].map((c) => (
          <Card key={c.title}>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{c.title}</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-semibold">{c.value}</div></CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
