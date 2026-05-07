import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSupplierContext } from "@/contexts/SupplierContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export default function PortalProfile() {
  const { activeSupplierId, activeMembership } = useSupplierContext();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<any>({});

  const canEdit = activeMembership && ["owner", "admin"].includes(activeMembership.portal_role);

  useEffect(() => {
    if (!activeSupplierId) return;
    setLoading(true);
    supabase
      .from("supplier_profiles_extended")
      .select("*")
      .eq("supplier_id", activeSupplierId)
      .maybeSingle()
      .then(({ data }) => { setProfile(data ?? { supplier_id: activeSupplierId }); setLoading(false); });
  }, [activeSupplierId]);

  const save = async () => {
    if (!activeSupplierId) return;
    setSaving(true);
    const payload = { ...profile, supplier_id: activeSupplierId };
    const { error } = await supabase.from("supplier_profiles_extended").upsert(payload, { onConflict: "supplier_id" });
    setSaving(false);
    if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
    else toast({ title: "Saved" });
  };

  if (loading) return <Loader2 className="h-6 w-6 animate-spin" />;

  const field = (key: string, label: string, type = "text") => (
    <div className="space-y-1">
      <label className="text-sm text-muted-foreground">{label}</label>
      <Input type={type} value={profile?.[key] ?? ""} disabled={!canEdit}
        onChange={(e) => setProfile({ ...profile, [key]: e.target.value })} />
    </div>
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Company Profile</h1>
      <Card>
        <CardHeader><CardTitle>Legal & Tax</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {field("legal_name", "Legal name")}
          {field("tax_id", "Tax / VAT ID")}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Banking</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {field("bank_account_name", "Account name")}
          {field("bank_account_number", "Account number")}
          {field("bank_iban", "IBAN")}
          {field("bank_swift", "SWIFT/BIC")}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Defaults</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {field("default_currency", "Default currency (3 letters)")}
          {field("default_payment_terms_days", "Default payment terms (days)", "number")}
        </CardContent>
      </Card>
      {canEdit && (
        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save changes
          </Button>
        </div>
      )}
    </div>
  );
}
