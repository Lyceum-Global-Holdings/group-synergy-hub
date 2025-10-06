import { UseFormReturn } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ReviewStepProps {
  form: UseFormReturn<any>;
}

export default function ReviewStep({ form }: ReviewStepProps) {
  const data = form.getValues();

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Review Registration</h3>
      <p className="text-sm text-muted-foreground">
        Please review all information before submitting for approval.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium">Supplier Name</p>
              <p className="text-sm text-muted-foreground">{data.supplier_name || "-"}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Type</p>
              <Badge variant="outline">{data.supplier_type || "-"}</Badge>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium">Email</p>
              <p className="text-sm text-muted-foreground">{data.email || "-"}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Phone</p>
              <p className="text-sm text-muted-foreground">{data.phone || "-"}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium">Tax ID</p>
              <p className="text-sm text-muted-foreground">{data.tax_id || "-"}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Registration Number</p>
              <p className="text-sm text-muted-foreground">{data.registration_number || "-"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Business Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium">Category</p>
              <p className="text-sm text-muted-foreground">{data.category || "-"}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Material Type</p>
              <p className="text-sm text-muted-foreground">{data.material_type || "-"}</p>
            </div>
          </div>
          <div>
            <p className="text-sm font-medium">Address</p>
            <p className="text-sm text-muted-foreground">
              {[data.street_address, data.city, data.state_province, data.postal_code, data.country]
                .filter(Boolean)
                .join(", ") || "-"}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Banking & Contact</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium">Bank Name</p>
              <p className="text-sm text-muted-foreground">{data.bank_name || "-"}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Payment Terms</p>
              <p className="text-sm text-muted-foreground">{data.payment_terms || "-"}</p>
            </div>
          </div>
          <div>
            <p className="text-sm font-medium">Primary Contact</p>
            <p className="text-sm text-muted-foreground">
              {data.primary_contact_name || "-"} ({data.primary_contact_email || "-"})
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
