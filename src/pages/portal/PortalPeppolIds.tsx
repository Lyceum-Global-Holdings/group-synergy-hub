import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PortalPeppolIds() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">PEPPOL Identifiers</h1>
      <Card>
        <CardHeader><CardTitle>Participant IDs</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            PEPPOL participant management (registry lookup, scheme + ID, document type capabilities) ships in Phase 3
            once Storecove transmission is wired up.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
