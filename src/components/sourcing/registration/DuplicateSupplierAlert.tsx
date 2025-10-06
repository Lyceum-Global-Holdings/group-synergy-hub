import { useEffect } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { useCheckDuplicates } from "@/hooks/useSupplierRegistration";

interface DuplicateSupplierAlertProps {
  supplierName: string;
  email?: string;
  phone?: string;
  taxId?: string;
}

export default function DuplicateSupplierAlert({ 
  supplierName, 
  email, 
  phone, 
  taxId 
}: DuplicateSupplierAlertProps) {
  const checkDuplicates = useCheckDuplicates();

  useEffect(() => {
    if (supplierName && supplierName.length > 3) {
      const timer = setTimeout(() => {
        checkDuplicates.mutate({
          supplier_name: supplierName,
          email,
          phone,
          tax_id: taxId,
        });
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [supplierName, email, phone, taxId]);

  if (!checkDuplicates.data || checkDuplicates.data.length === 0) {
    return null;
  }

  return (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Potential Duplicate Suppliers Found</AlertTitle>
      <AlertDescription>
        <p className="mb-2">The following suppliers may be duplicates:</p>
        <ul className="list-disc list-inside space-y-1">
          {checkDuplicates.data.map((dup) => (
            <li key={dup.id}>
              {dup.supplier_name} - Matched by {dup.match_reason}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-sm">Please verify this is not a duplicate before continuing.</p>
      </AlertDescription>
    </Alert>
  );
}
